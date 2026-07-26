#!/usr/bin/env bash
# PostToolUse on Bash. Fires the convergence loop after a push to a branch that
# already has an open PR, which is the exact moment the loop must re-enter and
# the moment it was skipped: fix, push, move on, leaving threads unanswered and
# a stale verdict standing.
#
# Advisory by construction. PostToolUse runs AFTER the command, so blocking here
# cannot un-push anything; the merge is already gated by `pnpm ready-to-merge`.
# What this adds is the per-push heartbeat that turns "remember to invoke the
# skill" into a line in the terminal. It always exits 0 for that reason — a
# non-zero exit would be a warning the runtime renders as a failed hook without
# stopping anything, which trains the operator to ignore it.
INPUT=$(cat)

CMD=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('tool_input', {}).get('command', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# Fail quiet, not closed: a missed reminder costs one skipped nudge, while a
# false one on every unrelated Bash call spends the budget that makes the real
# one worth reading.
printf '%s' "$CMD" | grep -qE '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)' || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ -z "$BRANCH" ] && exit 0
[ "$BRANCH" = "main" ] && exit 0

PR=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null) || exit 0
[ -z "$PR" ] && exit 0

if OUT=$(pnpm review:converge 2>&1); then
  printf '[review-converge] PR #%s is converged.\n' "$PR"
  exit 0
fi

printf '\n%s\n' "$OUT" | grep -v '^>' | grep -v '^$'
printf '[review-converge] The loop is not done. Run `pnpm review:converge` after each step.\n\n'
exit 0
