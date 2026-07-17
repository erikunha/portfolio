#!/usr/bin/env python3
"""Command block detector for bash-guard.sh.

Parses the shell command with the vendored bashlex parser and inspects the name
of every command node, including those inside substitutions, compound commands,
pipelines and redirections. A quoted argument (a commit-message body) is never a
command node, so it never matches. Exit codes bash-guard.sh depends on:
2 = block (reason on stdout), 0 = clean, 3 = could not parse -> coarse fallback.
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
    "builtin", "exec", "stdbuf", "setsid", "timeout",
}
FORCE_FLAGS = {"--force", "-f", "--force-with-lease"}

NPM_MSG = (
    "[BLOCKED] npm/yarn detected. This project uses pnpm only.\n"
    "Use pnpm instead."
)
MERGE_MSG = (
    "[BLOCKED] gh pr merge called directly.\n"
    "AI agents must run: pnpm ready-to-merge [pr-number]\n"
    "The repo owner may run gh pr merge directly in an external terminal to bypass."
)
ADD_MSG = (
    "[BLOCKED] Broad git add detected.\n"
    "CLAUDE.md: use git add -u or git add <specific files> only."
)
PUSH_MSG = (
    "[BLOCKED] Force push to main is not allowed.\n"
    "Rebase the feature branch onto main and merge via PR instead."
)


def block(msg):
    sys.stdout.write(msg + "\n")
    sys.exit(2)


def main_ref(tok):
    return tok == "main" or "refs/heads/main" in tok or bool(re.search(r"(^|[:/+])main$", tok))


def git_add_broad(operands):
    for a in operands:
        if a in ("-A", "--all", ".", ":/", "*"):
            return True
        if a.startswith(":") or a == "*":
            return True
        if re.fullmatch(r"-[A-Za-z]*A[A-Za-z]*", a):
            return True
        if a.startswith("--pathspec-from-file"):
            return True
    return False


def is_force_push(args):
    if "push" not in args:
        return False
    forced = any(f in args for f in FORCE_FLAGS) or any(a.startswith("+") and main_ref(a) for a in args)
    return forced and any(main_ref(a) for a in args)


def inspect(name, args):
    if name in ("npm", "yarn"):
        block(NPM_MSG)
    if name == "gh" and len(args) >= 2 and args[0] == "pr" and args[1] == "merge":
        block(MERGE_MSG)
    if name == "git" and args and args[0] == "add" and git_add_broad(args[1:]):
        block(ADD_MSG)
    if name == "git" and is_force_push(args):
        block(PUSH_MSG)


def inspect_wrapper(args):
    # A wrapper (env/sudo/...) execs another command that bashlex parses as plain
    # word-args, not a nested command node; scan those words by presence.
    if "npm" in args or "yarn" in args:
        block(NPM_MSG)
    for i in range(len(args) - 2):
        if args[i] == "gh" and args[i + 1] == "pr" and args[i + 2] == "merge":
            block(MERGE_MSG)
    if "git" in args:
        rest = args[args.index("git") + 1:]
        if rest and rest[0] == "add" and git_add_broad(rest[1:]):
            block(ADD_MSG)
        if is_force_push(rest):
            block(PUSH_MSG)


if bashlex is not None:

    class Visitor(bashlex.ast.nodevisitor):
        def visitcommand(self, n, parts):
            words = [p.word for p in parts if p.kind == "word"]
            if not words:
                return
            name, args = words[0], words[1:]
            inspect(name, args)
            if name in WRAPPERS:
                inspect_wrapper(args)


def main():
    raw = sys.stdin.read()
    try:
        d = json.loads(raw)
        cmd = d.get("tool_input", {}).get("command", "") or d.get("command", "")
    except Exception:
        cmd = ""
    if not cmd or not cmd.strip():
        sys.exit(3 if raw.strip() else 0)
    if bashlex is None:
        sys.exit(3)
    try:
        trees = bashlex.parse(cmd)
    except Exception:
        sys.exit(3)
    visitor = Visitor()
    for tree in trees:
        visitor.visit(tree)
    sys.exit(0)


if __name__ == "__main__":
    main()
