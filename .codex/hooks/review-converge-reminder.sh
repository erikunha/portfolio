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

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Reuse the AST detector the push guard already uses rather than hand-rolling a
# second, weaker predicate: a regex over the raw string misses `git -C <dir> push`
# and `sh -c 'git push'`, and a missed push means the heartbeat silently never
# fires for it. Fail quiet, not closed — a false nudge on every unrelated Bash
# call spends the budget that makes the real one worth reading, and the merge is
# gated regardless by `pnpm ready-to-merge`.
# Decide PER RECORD, never over the whole emitted set. --emit-commands writes one
# tab-separated record per command with every argument as a field, so two
# independent greps over the joined output fire on `git commit -m "push the fix"`
# and on `grep -r "git push" .` — each false hit costs a gh round-trip and prints
# the nudge this file's own budget argument says must stay scarce.
DET=$(printf '%s' "$INPUT" | python3 "$HOOK_DIR/bash-guard-detect.py" --emit-commands 2>/dev/null) || exit 0
printf '%s\n' "$DET" | awk -F'\t' '
  {
    prog = $1
    sub(/^.*\//, "", prog)
    if (prog != "git") next
    for (i = 2; i <= NF; i++) if ($i == "push") { found = 1; exit }
  }
  END { exit(found ? 0 : 1) }
' || exit 0

# A real push and an undetected one both exit 0 silently, so the predicate above
# is otherwise unobservable and untestable. This mode reports it and stops, so
# the fixtures pin the live awk rather than a copy of it that can drift.
if [ -n "${REVIEW_CONVERGE_DETECT_ONLY:-}" ]; then
  printf 'DETECTED\n'
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ -z "$BRANCH" ] && exit 0
[ "$BRANCH" = "main" ] && exit 0

PR=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null) || exit 0
[ -z "$PR" ] && exit 0

# Gate on the script's own sentinel, not merely on exit 0. review-converge exits
# 0 on its "no open PR" path too, and this hook has ALREADY confirmed a PR is
# open — so treating any zero exit as success would print "converged" for a
# lookup that never read a thread.
OUT=$(pnpm review:converge 2>&1)
case "$OUT" in
  *"[review-converge] OK"*)
    printf '[review-converge] PR #%s is converged.\n' "$PR"
    exit 0
    ;;
esac

printf '\n%s\n' "$OUT" | grep -v '^>' | grep -v '^$'
printf '[review-converge] The loop is not done. Run `pnpm review:converge` after each step.\n\n'
exit 0
