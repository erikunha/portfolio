#!/usr/bin/env python3
"""Command-position-aware block detector for bash-guard.sh.

Reads the PreToolUse JSON payload on stdin, extracts the Bash command, and
decides whether it must be blocked. Matching is on shell TOKENS at command
position (not raw substrings) so it resists quote / whitespace / no-space-chain
/ wrapper / subshell evasions AND does not false-block a dangerous string that
appears only inside a quoted argument such as a commit message body.

Exit codes: 2 = block (reason on stdout), 0 = analyzed and clean,
3 = could not analyze (parse failure / unbalanced quotes) -> caller runs a
coarse fail-closed fallback.
"""
import json
import shlex
import sys

WRAPPERS = {
    "env", "command", "sudo", "nice", "time", "nohup", "xargs",
    "builtin", "exec", "then", "do", "else", "stdbuf", "setsid",
}
GIT_ADD_BROAD = {"-A", "--all", ".", ":/", "*"}
FORCE_FLAGS = {"--force", "-f", "--force-with-lease"}
PUNCT = ";&|<>()"


def block(msg):
    sys.stdout.write(msg + "\n")
    sys.exit(2)


def is_op(tok):
    return tok != "" and all(c in PUNCT for c in tok)


def normalize_newlines(s):
    """Turn UNQUOTED newlines into ';' so newline-separated commands segment,
    while newlines inside a quoted argument (a multi-line commit message) stay
    part of that argument. A backslash escapes the next char outside single
    quotes (covers backslash-newline line continuations too)."""
    out = []
    quote = None
    esc = False
    for ch in s:
        if esc:
            out.append(ch)
            esc = False
            continue
        if quote != "'" and ch == "\\":
            out.append(ch)
            esc = True
            continue
        if quote:
            out.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
            out.append(ch)
        elif ch == "\n":
            out.append(";")
        else:
            out.append(ch)
    return "".join(out)


def strip_prefix(seg):
    """Drop leading VAR=val assignments and command wrappers (env/command/...)."""
    i = 0
    while i < len(seg):
        t = seg[i]
        if t in WRAPPERS or ("=" in t and t.split("=", 1)[0].isidentifier()):
            i += 1
        else:
            break
    return seg[i:]


def check(seg):
    s = strip_prefix(seg)
    if not s:
        return
    if len(s) >= 2 and s[0] == "git" and s[1] == "add":
        for a in s[2:]:
            if a in GIT_ADD_BROAD or a.startswith(":") or a == "*":
                block(
                    "[BLOCKED] Broad git add detected.\n"
                    "CLAUDE.md: use git add -u or git add <specific files> only.\n"
                    "git add . / -A / --all / :/ / * stages unintended files "
                    "(screenshots, worktree artifacts)."
                )
    if s[0] in ("npm", "yarn"):
        block(
            "[BLOCKED] npm/yarn detected. This project uses pnpm only.\n"
            "Use instead: pnpm " + " ".join(s[1:])
        )
    if len(s) >= 3 and s[0] == "gh" and s[1] == "pr" and s[2] == "merge":
        block(
            "[BLOCKED] gh pr merge called directly.\n"
            "AI agents must run: pnpm ready-to-merge [pr-number]\n"
            "The repo owner may run gh pr merge directly in an external terminal to bypass."
        )
    if s[0] == "git" and "push" in s and any(f in s for f in FORCE_FLAGS) and any("main" in t for t in s):
        block(
            "[BLOCKED] Force push to main is not allowed.\n"
            "Rebase the feature branch onto main and merge via PR instead."
        )


def main():
    raw = sys.stdin.read()
    try:
        d = json.loads(raw)
        cmd = d.get("tool_input", {}).get("command", "") or d.get("command", "")
    except Exception:
        cmd = ""
    if not cmd or not cmd.strip():
        # No command to analyze. If stdin carried something we could not parse,
        # signal the caller to run its coarse fail-closed fallback.
        sys.exit(3 if raw.strip() else 0)

    try:
        lex = shlex.shlex(normalize_newlines(cmd), posix=True, punctuation_chars=PUNCT)
        lex.whitespace_split = True
        toks = list(lex)
    except ValueError:
        sys.exit(3)

    seg = []
    for t in toks:
        if is_op(t):
            if seg:
                check(seg)
                seg = []
        else:
            seg.append(t)
    if seg:
        check(seg)
    sys.exit(0)


if __name__ == "__main__":
    main()
