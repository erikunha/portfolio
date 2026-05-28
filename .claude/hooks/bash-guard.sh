#!/usr/bin/env bash
# PreToolUse hook for Bash tool.
# Receives tool input JSON on stdin. Exit 0 = allow. Exit non-zero = block.
# Output is shown to Claude as the blocking reason.

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  print(json.load(sys.stdin).get('command', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# ── Block: gh pr merge called directly by an AI agent ───────────────────────
# The repo owner may bypass by running gh pr merge in an external terminal.
# AI agents must use pnpm ready-to-merge which enforces the full gate chain.
if printf '%s' "$CMD" | grep -qE 'gh pr merge'; then
  printf '[BLOCKED] gh pr merge called directly.\n'
  printf 'AI agents must run: pnpm ready-to-merge [pr-number]\n'
  printf 'This enforces: ci:local + branch-protection + Copilot review gate + resolved threads.\n'
  printf 'The repo owner may run gh pr merge directly in an external terminal to bypass.\n'
  exit 1
fi

# ── Block: force push to main ────────────────────────────────────────────────
if printf '%s' "$CMD" | grep -qP 'git push.*(--force|-f)\b.*\bmain\b|git push.*\bmain\b.*(--force|-f)\b' 2>/dev/null || \
   printf '%s' "$CMD" | grep -E 'git push.*(--force|--force-with-lease).*main|git push.*main.*(--force|--force-with-lease)' > /dev/null 2>&1; then
  printf '[BLOCKED] Force push to main is not allowed.\n'
  printf 'Rebase the feature branch onto main and merge via PR instead.\n'
  exit 1
fi

# ── Warn: commit header > 100 chars ─────────────────────────────────────────
# commitlint enforces this post-hoc; catching it here avoids the wasted round-trip.
if printf '%s' "$CMD" | grep -qE "git commit.*-m"; then
  HEADER=$(python3 -c "
import sys, shlex
cmd = sys.argv[1] if len(sys.argv) > 1 else ''
try:
    parts = shlex.split(cmd)
    for i, p in enumerate(parts):
        if p == '-m' and i + 1 < len(parts):
            print(parts[i + 1].split(chr(10))[0])
            break
except Exception:
    pass
" "$CMD" 2>/dev/null || echo "")
  HEADER_LEN=${#HEADER}
  if [ -n "$HEADER" ] && [ "$HEADER_LEN" -gt 100 ]; then
    printf '[WARN] Commit header is %s chars (limit: 100). commitlint will reject this.\n' "$HEADER_LEN"
    printf 'Shorten the subject line to 100 chars or fewer before running.\n'
  fi
fi

# ── Warn: gh pr create without ready-for-pr ──────────────────────────────────
# Not a hard block — the user may have already run ready-for-pr manually.
# The warning surfaces in Claude's context so it can confirm before proceeding.
if printf '%s' "$CMD" | grep -qE 'gh pr create'; then
  printf '[WARN] Before gh pr create, verify:\n'
  printf '  1. pnpm ready-for-pr passed (ci:local + pr-size)\n'
  printf '  2. pr-review-toolkit:review-pr ran — Critical/Important findings addressed\n'
  printf 'If both are done, proceed. Otherwise stop and run them.\n'
  # exit 0 = warn only, tool still runs
fi

exit 0
