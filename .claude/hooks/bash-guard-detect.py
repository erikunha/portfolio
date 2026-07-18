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
    "watch", "parallel", "ionice", "chrt",
}
SHELL_INTERP = {"bash", "sh", "zsh", "dash", "ksh", "ash", "mksh", "rbash"}
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
EMIT_PROGRAMS = ("git",)
OPAQUE_WORD = re.compile(r"[$`]")


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
    return tok == "main" or "refs/heads/main" in tok or bool(re.search(r"(^|[:/+])main$", tok))


def git_add_broad(operands):
    for a in operands:
        norm = a.rstrip("/")  # ./ , .// , :/ collapse to their broad form
        if norm in ("-A", "--all", ".", ":/", ":", "*"):
            return True
        if norm.startswith(":") or norm == "*":
            return True
        if re.fullmatch(r"-[A-Za-z]*A[A-Za-z]*", a):
            return True
        if a.startswith("--pathspec-from-file"):
            return True
    return False


def is_force_flag(a):
    if a in ("--force", "-f", "--force-with-lease"):
        return True
    if a.startswith("--force-with-lease") or a.startswith("--force="):
        return True
    return bool(re.fullmatch(r"-[A-Za-z]*f[A-Za-z]*", a)) and not a.startswith("--")


def git_add_check(args):
    # subcommand-position-tolerant ('add' may sit behind global flags: git -C .);
    # 'stage' is git's built-in synonym for 'add'.
    for sub in ("add", "stage"):
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
        if args[i] == "pr" and args[i + 1] == "merge":
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
    if name == "eval":
        return " ".join(args)
    if name in SHELL_INTERP:
        j = dash_c_index(args)
        if j >= 0 and j + 1 < len(args):
            return args[j + 1]
    return None


def inspect(name, args, depth):
    # match on the basename so /usr/bin/npm, /opt/homebrew/bin/git, ./node_modules/.bin/…
    # and other path-prefixed spellings of the same binary are still caught.
    base = os.path.basename(name)
    if EMIT_MODE:
        EMITTED.append([base] + list(args))
    if base in ("npm", "yarn", "yarnpkg"):
        block(NPM_MSG)
    if base == "gh":
        gh_merge_check(args)
    if base == "git":
        git_add_check(args)
        if is_force_push(args):
            block(PUSH_MSG)
    script = interp_script(base, args)
    if script is not None:
        reparse(script, depth)
    if base == "xargs" and EMIT_MODE and any(
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
    if base == "find":
        for kw in ("-exec", "-execdir"):
            if kw in args:
                j = args.index(kw)
                sub = []
                for a in args[j + 1:]:
                    if a in (";", "+"):
                        break
                    sub.append(a)
                if sub:
                    inspect(sub[0], sub[1:], depth)
    if base in WRAPPERS:
        inspect_wrapper(args, depth)


def inspect_wrapper(args, depth):
    # a wrapper (env/sudo/...) execs another command bashlex parses as plain
    # word-args, not a nested node; scan those words by presence and re-parse any
    # interpreter payload they carry.
    bases = [os.path.basename(a) for a in args]
    if EMIT_MODE:
        for i, b in enumerate(bases):
            if b in EMIT_PROGRAMS:
                EMITTED.append([b] + list(args[i + 1:]))
                break
    if "npm" in bases or "yarn" in bases or "yarnpkg" in bases:
        block(NPM_MSG)
    gh_merge_check(args)
    if "git" in bases:
        rest = args[bases.index("git") + 1:]
        git_add_check(rest)
        if is_force_push(rest):
            block(PUSH_MSG)
    for i, a in enumerate(args):
        b = os.path.basename(a)
        if b == "eval":
            reparse(" ".join(args[i + 1:]), depth)
            break
        if b in SHELL_INTERP:
            sub = args[i + 1:]
            j = dash_c_index(sub)
            if j >= 0 and j + 1 < len(sub):
                reparse(sub[j + 1], depth)


def effective_program(words):
    # the real program a command runs, after skipping leading wrapper words
    # (env/sudo/...) and VAR=val assignments. Matches how inspect_wrapper resolves
    # the target, so a here-doc/here-string body feeding `/bin/sh`, `sudo bash`, or
    # `VAR=1 sh` is recognized as shell input the same way inspect() basenames names.
    for w in words:
        b = os.path.basename(w)
        if b in WRAPPERS or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w):
            continue
        return b
    return None


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
            words = expand_words([p.word for p in parts if p.kind == "word"])
            if words:
                if EMIT_MODE and OPAQUE_WORD.search(words[0]):
                    sys.exit(3)
                inspect(words[0], words[1:], self.depth)
            # here-string / here-doc feeding a shell interpreter (no -c): the body
            # is a redirect node, not a word, so re-parse it explicitly.
            if words and effective_program(words) in SHELL_INTERP and "-c" not in words:
                if EMIT_MODE and not any(
                    p.kind == "redirect" and str(p.type).startswith("<<") for p in parts
                ):
                    sys.exit(3)
                for p in parts:
                    if p.kind == "redirect" and str(p.type).startswith("<<"):
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
    if bashlex is None or len(cmd) > MAX_CMD_LEN:
        sys.exit(3)
    try:
        trees = bashlex.parse(cmd)
    except Exception:
        sys.exit(3)
    visitor = Visitor()
    for tree in trees:
        visitor.visit(tree)
    if EMIT_MODE:
        for words in EMITTED:
            sys.stdout.write("\t".join(words) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
