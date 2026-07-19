#!/usr/bin/env python3
"""Command block detector for bash-guard.sh.

Parses the shell command with the vendored bashlex parser and inspects the name
of every command node, including those inside substitutions, compound commands,
pipelines and redirections. A quoted argument (a commit-message body) is never a
command node, so it never matches. Exit codes bash-guard.sh depends on:
2 = block (reason on stdout), 0 = clean, 3 = could not parse -> coarse fallback.

GPLv3+: imports the vendored GPLv3 bashlex, so this file is likewise GPLv3+.
See vendor/bashlex/VENDORED.txt.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))
try:
    import bashlex
except Exception:
    bashlex = None

WRAPPERS = {
    "env", "command", "sudo", "doas", "nice", "time", "nohup", "xargs",
    "builtin", "exec", "stdbuf", "setsid", "timeout", "script", "flock",
    "watch", "parallel", "ionice", "chrt", "caffeinate", "arch", "xcrun",
}
SHELL_INTERP = {
    "bash", "sh", "zsh", "dash", "ksh", "ash", "mksh", "rbash",
    "fish", "csh", "tcsh",
}
OTHER_INTERP = {"python", "python3", "node", "nodejs", "perl", "ruby", "php"}
MAX_DEPTH = 6
MAX_CMD_LEN = 100_000
_reparse_budget = [400]

NPM_MSG = "[BLOCKED] npm/yarn detected. This project uses pnpm only.\nUse pnpm instead."
MERGE_MSG = (
    "[BLOCKED] gh pr merge called directly.\n"
    "AI agents must run: pnpm ready-to-merge [pr-number]\n"
    "The repo owner may run gh pr merge directly in an external terminal to bypass."
)
ADD_MSG = "[BLOCKED] Broad git add detected.\nCLAUDE.md: use git add -u or git add <specific files> only."
PUSH_MSG = "[BLOCKED] Force push to main is not allowed.\nRebase the feature branch onto main and merge via PR instead."
NEST_MSG = "[BLOCKED] Command nesting too deep to analyze safely."


EMIT_MODE = False
EMITTED = []
EMIT_GIT_PROGRAM = re.compile(r"^git(-|$)")
EXEC_ENV = (
    "EDITOR", "VISUAL", "SSH_ASKPASS", "BASH_ENV", "ENV",
    "PROMPT_COMMAND", "LD_PRELOAD", "DYLD_INSERT_LIBRARIES",
    "PAGER", "LESSOPEN",
)
EXEC_ENV_SHAPE = re.compile(r"^(BASH_FUNC_.*%%|LD_[A-Z_]+|DYLD_[A-Z_]+)$")
TRAP_SIGNAL = re.compile(r"^(--?[A-Za-z]*|[0-9]+|SIG[A-Z0-9]+|EXIT|DEBUG|ERR|RETURN)$")
OPAQUE_WORD = re.compile(r"[$`]")
ASSIGN_WORD = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
WRAPPER_OPERAND = re.compile(r"^[-0-9]")
SPLIT_STRING = re.compile(r"^(-S|--split-string=?)")
# flags whose value IS a shell command, keyed by wrapper
PAYLOAD_FLAGS = {
    "flock": {"-c", "--command"},
    "script": {"-c", "--command"},
}
# wrappers whose first non-flag OPERAND is a shell string, not a program
SHELL_OPERAND_WRAPPERS = {"watch", "parallel"}
# Flags whose VALUE is a separate word, keyed by wrapper: the same short flag
# means different things per program (`sudo -n` is boolean, `nice -n` takes a
# value), and skipping a boolean flag's successor skips the program itself.
VALUE_FLAGS = {
    "env": {"-u", "-C", "-S", "-P", "--unset", "--chdir", "--split-string"},
    "sudo": {"-u", "-g", "-U", "-C", "-p", "-r", "-t", "-T", "-D", "-R", "-h",
             "--user", "--group", "--chdir", "--chroot", "--host", "--prompt",
             "--role", "--type", "--command-timeout", "--other-user"},
    "doas": {"-u", "-C", "-a"},
    "timeout": {"-s", "-k", "--signal", "--kill-after"},
    "nice": {"-n", "--adjustment"},
    "ionice": {"-c", "-n", "-p", "--class", "--classdata", "--pid"},
    "chrt": {"-p", "--pid"},
    "stdbuf": {"-i", "-o", "-e", "--input", "--output", "--error"},
    "flock": {"-w", "-E", "--wait", "--timeout", "--conflict-exit-code"},
    "xargs": {"-n", "-P", "-a", "-d", "-s", "-I", "-E", "-L", "--max-args",
              "--max-procs", "--arg-file", "--delimiter", "--max-chars",
              "--replace", "--max-lines"},
    "script": {"-F", "-t", "--flush", "--timing"},
    "watch": {"-n", "--interval"},
    "parallel": {"-j", "-P", "--jobs", "-S", "--sshlogin", "--slf"},
    "time": {"-f", "-o", "--format", "--output"},
    "setsid": set(),
    "nohup": set(),
    "command": set(),
    "builtin": set(),
    "exec": {"-a"},
    "caffeinate": {"-t", "-w"},
    "arch": {"-arch"},
    "xcrun": {"-sdk", "-toolchain", "--sdk", "--toolchain"},
}
ASSIGN_SHAPED = re.compile(r"^[A-Za-z_][^=]*=")
ASSIGN_RECORD = "#assign"
# bashlex's own node vocabulary. These are the highest-stakes literals in the
# file: a typo yields an empty match, so the walk sees nothing and fails OPEN
# with no error. Naming them means one spelling, checked once.
NODE_WORD = "word"
NODE_ASSIGNMENT = "assignment"
NODE_REDIRECT = "redirect"
HEREDOC_PREFIX = "<<"
# programs and builtins the walk treats specially
PKG_MANAGERS = ("npm", "yarn", "yarnpkg")
SCRIPT_READERS = ("source", ".")
DECLARE_BUILTINS = ("export", "declare", "typeset", "local", "readonly")
PROG_GH, PROG_GIT, PROG_EVAL = "gh", "git", "eval"
PROG_TRAP, PROG_FIND, PROG_XARGS = "trap", "find", "xargs"
GH_PR_SUBCOMMAND, GH_MERGE_ACTION = "pr", "merge"
FIND_EXEC_FLAGS = ("-exec", "-execdir")
FIND_EXEC_TERMINATORS = (";", "+")
# git policy vocabularies
PROTECTED_BRANCH = "main"
PROTECTED_REF = f"refs/heads/{PROTECTED_BRANCH}"
FORCE_FLAGS = ("--force", "-f", "--force-with-lease")
GIT_ADD_ALIASES = ("add", "stage")
BROAD_ADD_PATHSPECS = ("-A", "--all", ".", ":/", ":", "*")


def block(msg):
    if EMIT_MODE:
        return
    sys.stdout.write(msg + "\n")
    sys.exit(2)


MAX_EXPANSIONS = 64


def brace_expand(word):
    # bashlex does not expand braces; a `{npm,i}` word runs `npm` at runtime.
    m = re.search(r"\{([^{}]*,[^{}]*)\}", word)
    if not m:
        return [word]
    pre, post = word[: m.start()], word[m.end():]
    out = []
    for alt in m.group(1).split(","):
        out.extend(brace_expand(pre + alt + post))
        if len(out) > MAX_EXPANSIONS:
            break
    return out


def expand_words(words):
    # Expand each word independently. If one word has more brace alternatives than
    # the cap, keep it raw rather than dropping it (or, worse, the words after it) —
    # a padded filler word must never strand the real argument that follows.
    out = []
    for w in words:
        exp = brace_expand(w)
        out.extend(exp if len(exp) <= MAX_EXPANSIONS else [w])
    return out


def main_ref(tok):
    return tok == PROTECTED_BRANCH or PROTECTED_REF in tok or bool(re.search(r"(^|[:/+])main$", tok))


def git_add_broad(operands):
    for a in operands:
        norm = a.rstrip("/")  # ./ , .// , :/ collapse to their broad form
        if norm in BROAD_ADD_PATHSPECS:
            return True
        if norm.startswith(":") or norm == "*":
            return True
        if re.fullmatch(r"-[A-Za-z]*A[A-Za-z]*", a):
            return True
        if a.startswith("--pathspec-from-file"):
            return True
    return False


def is_force_flag(a):
    if a in FORCE_FLAGS:
        return True
    if a.startswith("--force-with-lease") or a.startswith("--force="):
        return True
    return bool(re.fullmatch(r"-[A-Za-z]*f[A-Za-z]*", a)) and not a.startswith("--")


def git_add_check(args):
    # subcommand-position-tolerant ('add' may sit behind global flags: git -C .);
    # 'stage' is git's built-in synonym for 'add'.
    for sub in GIT_ADD_ALIASES:
        if sub in args and git_add_broad(args[args.index(sub) + 1:]):
            block(ADD_MSG)


def dash_c_index(args):
    # index of a `-c` token or a bundled short-flag cluster containing c anywhere
    # (bash -lc, -cx, -xc all take the following word as the -c script).
    for i, a in enumerate(args):
        if a == "-c" or re.fullmatch(r"-[A-Za-z]*c[A-Za-z]*", a):
            return i
    return -1


def gh_merge_check(args):
    for i in range(len(args) - 1):
        if args[i] == GH_PR_SUBCOMMAND and args[i + 1] == GH_MERGE_ACTION:
            block(MERGE_MSG)


def is_force_push(args):
    if "push" not in args:
        return False
    forced = any(is_force_flag(a) for a in args) or any(a.startswith("+") and main_ref(a) for a in args)
    return forced and any(main_ref(a) for a in args)


def coarse_scan(script):
    # non-shell interpreter (-c/-e) payload: cannot bash-parse another language,
    # so substring-scan for the guarded commands. Over-blocks are acceptable here.
    if re.search(r"\b(npm|yarn)\b", script):
        block(NPM_MSG)
    if re.search(r"\bgh\b[^\n]*\bpr\b[^\n]*\bmerge\b", script):
        block(MERGE_MSG)
    if re.search(r"\bgit\b[^\n]*\badd\b[^\n]*(-A\b|--all\b|(^|\s)\.(\s|$)|:/|\*)", script):
        block(ADD_MSG)
    if re.search(r"\bgit\b[^\n]*\bpush\b[^\n]*(--force|-f\b)[^\n]*\bmain\b", script):
        block(PUSH_MSG)


def interp_script(name, args):
    if name == PROG_EVAL:
        return " ".join(args)
    if name in SHELL_INTERP:
        j = dash_c_index(args)
        if j >= 0 and j + 1 < len(args):
            return args[j + 1]
    return None


def is_config_assign(word):
    name = word.split("=")[0]
    return (
        word.startswith("GIT_")
        or name in EXEC_ENV
        or bool(EXEC_ENV_SHAPE.match(name))
        or bool(OPAQUE_WORD.search(name))
    )


def inspect(name, args, depth):
    # match on the basename so /usr/bin/npm, /opt/homebrew/bin/git, ./node_modules/.bin/…
    # and other path-prefixed spellings of the same binary are still caught.
    base = os.path.basename(name)
    if EMIT_MODE:
        EMITTED.append([base] + list(args))
    if base in PKG_MANAGERS:
        block(NPM_MSG)
    if base == PROG_GH:
        gh_merge_check(args)
    if base == PROG_GIT:
        git_add_check(args)
        if is_force_push(args):
            block(PUSH_MSG)
    script = interp_script(base, args)
    if script is not None:
        reparse(script, depth)
    if EMIT_MODE and base in DECLARE_BUILTINS:
        env_words = [a for a in args if is_config_assign(a)]
        if env_words:
            EMITTED.append([ASSIGN_RECORD] + env_words)
    if base == PROG_TRAP:
        for a in args:
            if not TRAP_SIGNAL.match(a):
                reparse(a, depth)
    if EMIT_MODE and ASSIGN_SHAPED.match(name) and is_config_assign(name):
        EMITTED.append([ASSIGN_RECORD, name])
    if EMIT_MODE and base in SCRIPT_READERS:
        sys.exit(3)
    if base == PROG_XARGS and EMIT_MODE and any(
        a == "-I" or a.startswith("-I") or a.startswith("--replace") for a in args
    ):
        sys.exit(3)
    if base in OTHER_INTERP:
        # -c (python/ruby/node), -e (node/perl/ruby), -r (php) carry inline code,
        # in spaced (`-c 'x'`), bundled (`-Bc 'x'`) and attached (`-Bc'x'`) forms.
        for i, a in enumerate(args):
            m = re.match(r"-[A-Za-z]*?[cer](.*)", a)
            if m:
                if EMIT_MODE:
                    sys.exit(3)
                if m.group(1):
                    coarse_scan(m.group(1))
                elif i + 1 < len(args):
                    coarse_scan(args[i + 1])
    if base == PROG_FIND:
        for kw in FIND_EXEC_FLAGS:
            if kw in args:
                j = args.index(kw)
                sub = []
                for a in args[j + 1:]:
                    if a in FIND_EXEC_TERMINATORS:
                        break
                    sub.append(a)
                if sub:
                    inspect(sub[0], sub[1:], depth)
    if base in WRAPPERS:
        inspect_wrapper(args, depth, base)


def inspect_wrapper(args, depth, wrapper=None):
    skip_operand = False
    # a wrapper (env/sudo/...) execs another command bashlex parses as plain
    # word-args, not a nested node; scan those words by presence and re-parse any
    # interpreter payload they carry.
    bases = [os.path.basename(a) for a in args]
    if EMIT_MODE:
        env_assigns = [a for a in args if is_config_assign(a)]
        if env_assigns:
            EMITTED.append([ASSIGN_RECORD] + env_assigns)
        for i, b in enumerate(bases):
            if EMIT_GIT_PROGRAM.match(b):
                EMITTED.append([b] + list(args[i + 1:]))
                break
    if any(b in PKG_MANAGERS for b in bases):
        block(NPM_MSG)
    gh_merge_check(args)
    if PROG_GIT in bases:
        rest = args[bases.index(PROG_GIT) + 1:]
        git_add_check(rest)
        if is_force_push(rest):
            block(PUSH_MSG)
    for i, a in enumerate(args):
        b = os.path.basename(a)
        if wrapper in PAYLOAD_FLAGS and a in PAYLOAD_FLAGS[wrapper]:
            if i + 1 < len(args):
                reparse(args[i + 1], depth)
            return
        if wrapper in SHELL_OPERAND_WRAPPERS:
            if skip_operand:
                skip_operand = False
            elif a.startswith("-"):
                skip_operand = a in VALUE_FLAGS.get(wrapper, ())
            elif not WRAPPER_OPERAND.match(a):
                reparse(a, depth)
                return
        if wrapper == "env" and SPLIT_STRING.match(a):
            # env -S'...' glues the command to the flag; env -S '...' puts it in
            # the next word, where sub() leaves an empty string and reparse("")
            # is a no-op that used to abandon the whole scan
            payload = SPLIT_STRING.sub("", a, count=1)
            if not payload and i + 1 < len(args):
                payload = args[i + 1]
            reparse(payload, depth)
            return
        if b == PROG_EVAL:
            reparse(" ".join(args[i + 1:]), depth)
            return
        if b in SHELL_INTERP:
            sub = args[i + 1:]
            j = dash_c_index(sub)
            if j >= 0 and j + 1 < len(sub):
                reparse(sub[j + 1], depth)
            return
        if b in OTHER_INTERP:
            inspect(a, list(args[i + 1:]), depth)
            return
    for i, a in enumerate(args):
        if os.path.basename(a) in WRAPPERS or ASSIGN_WORD.match(a) or WRAPPER_OPERAND.match(a):
            continue
        inspect(a, list(args[i + 1:]), depth)
        break


_candidate_budget = [512]


def resolve_programs(words):
    """Every index a wrapper chain could plausibly exec, nearest first.

    The flag table is an allowlist that cannot be complete, and every gap in it
    fails OPEN, so an ambiguous flag yields BOTH readings rather than a guess.
    """
    if _candidate_budget[0] <= 0:
        block(NEST_MSG)
        sys.exit(3)
    _candidate_budget[0] -= 1
    out = []
    i = 0
    wrapper = None
    while i < len(words):
        w = words[i]
        b = os.path.basename(w)
        if b in WRAPPERS:
            wrapper = b
            i += 1
            continue
        if ASSIGN_WORD.match(w):
            i += 1
            continue
        if w.startswith("-"):
            if w in VALUE_FLAGS.get(wrapper, ()):
                i += 2
            elif (
                (len(w) == 2 or (w.startswith("--") and "=" not in w))
                and i + 1 < len(words)
                and not words[i + 1].startswith("-")
            ):
                # unknown flag of a known wrapper: it either takes the next word
                # or it does not, and guessing wrong loses either way. An
                # ATTACHED short form (-oL) already carries its value, so it is
                # not ambiguous and must not widen.
                out.extend(j + i + 2 for j in resolve_programs(words[i + 2:]))
                i += 1
            else:
                i += 1
            continue
        if WRAPPER_OPERAND.match(w):
            out.extend(j + i + 1 for j in resolve_programs(words[i + 1:]))
            out.insert(0, i)
            return sorted(set(out))
        out.insert(0, i)
        return sorted(set(out))
    return sorted(set(out))


def resolve_program(words):
    """The nearest plausible program index, or -1."""
    c = resolve_programs(words)
    return c[0] if c else -1


def reparse(script, depth):
    # bound both the nesting chain (depth) and total reparse work across the whole
    # tree (budget), so a branching bash -c payload cannot blow up to O(branch^depth).
    if depth <= 0 or _reparse_budget[0] <= 0:
        block(NEST_MSG)
        sys.exit(3)
    _reparse_budget[0] -= 1
    if not script or not script.strip():
        return
    try:
        trees = bashlex.parse(script)
    except Exception:
        block(NEST_MSG)
        sys.exit(3)
    v = Visitor(depth - 1)
    for t in trees:
        v.visit(t)


if bashlex is not None:

    class Visitor(bashlex.ast.nodevisitor):
        def __init__(self, depth=MAX_DEPTH):
            self.depth = depth

        def visitcommand(self, n, parts):
            words = expand_words([p.word for p in parts if p.kind == NODE_WORD])
            if EMIT_MODE:
                assigns = [p.word for p in parts if p.kind == NODE_ASSIGNMENT and is_config_assign(p.word)]
                if assigns:
                    EMITTED.append([ASSIGN_RECORD] + assigns)
            if words:
                if EMIT_MODE and OPAQUE_WORD.search(words[0]):
                    sys.exit(3)
                inspect(words[0], words[1:], self.depth)
            # here-string / here-doc feeding a shell interpreter (no -c): the body
            # is a redirect node, not a word, so re-parse it explicitly.
            shell_i = -1
            for c in resolve_programs(words):
                if os.path.basename(words[c]) in SHELL_INTERP:
                    shell_i = c
                    break
            if shell_i >= 0 and dash_c_index(words[shell_i + 1:]) < 0:
                if EMIT_MODE and not any(
                    p.kind == NODE_REDIRECT and str(p.type).startswith(HEREDOC_PREFIX) for p in parts
                ):
                    sys.exit(3)
                for p in parts:
                    if p.kind == NODE_REDIRECT and str(p.type).startswith(HEREDOC_PREFIX):
                        # bashlex puts a here-DOC body on .heredoc and only the
                        # delimiter on .output.word; a here-STRING has no .heredoc.
                        hd = getattr(p, "heredoc", None)
                        body = getattr(hd, "value", None) or getattr(hd, "word", None)
                        if body is None:
                            body = getattr(getattr(p, "output", None), "word", None)
                        if body:
                            reparse(body, self.depth)
                        elif EMIT_MODE:
                            sys.exit(3)


def main():
    global EMIT_MODE
    EMIT_MODE = "--emit-commands" in sys.argv[1:]
    raw = sys.stdin.read()
    try:
        d = json.loads(raw)
        cmd = d.get("tool_input", {}).get("command", "") or d.get("command", "")
    except Exception:
        cmd = ""
    if not cmd or not cmd.strip():
        sys.exit(3 if raw.strip() else 0)
    if bashlex is None:
        sys.exit(4)
    if len(cmd) > MAX_CMD_LEN:
        sys.exit(3)
    try:
        trees = bashlex.parse(cmd)
    except Exception:
        sys.exit(3)
    visitor = Visitor()
    try:
        for tree in trees:
            visitor.visit(tree)
    except SystemExit:
        raise
    except BaseException:
        sys.exit(3)
    if EMIT_MODE:
        for words in EMITTED:
            sys.stdout.write("\t".join(words) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
