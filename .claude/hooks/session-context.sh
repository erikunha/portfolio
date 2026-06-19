#!/usr/bin/env bash
# SessionStart hook (fast-feedback Unit A, hook 2 of 2).
# Injects live git + PR + CI state as `additionalContext` at session start —
# additive to the .remember/ handoff and plugin SessionStart hooks (which carry
# work-state, not live git/CI state). Closes the "acting on a stale branch /
# unaware CI is red" error class. `gh` calls are bounded by `timeout 5` and fall
# back to git-only on any failure / unauthenticated gh. Outside a git repo: emits
# nothing. ALWAYS exits 0 — a SessionStart hook must never error the session.
# History: created 2026-06-19 (Unit A). See DECISIONS.md.
cat >/dev/null 2>&1 || true   # consume stdin defensively; SessionStart has no tool input

# Repo guard: outside a git repo, emit nothing.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" 2>/dev/null || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# ahead/behind vs upstream (0/0 when no upstream is set).
AHEAD=0; BEHIND=0
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  read -r BEHIND AHEAD < <(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null || echo "0 0")
fi

UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -c . || echo 0)
LAST_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || echo "")

# git-only base block (always present).
CTX=$(printf '[session-context]\nbranch: %s (%s ahead, %s behind)\nuncommitted: %s files\nlast commit: %s' \
  "$BRANCH" "$AHEAD" "$BEHIND" "$UNCOMMITTED" "$LAST_SUBJECT")

# Best-effort gh enrichment (open PRs + CI), bounded and fail-silent.
if command -v gh >/dev/null 2>&1; then
  PRS=$(timeout 5 gh pr list --state open --json number,headRefName \
        --jq 'if length==0 then "none" else (map("#\(.number) \(.headRefName)") | join(", ")) end' 2>/dev/null) || PRS=""
  CI=$(timeout 5 gh run list --branch "$BRANCH" --limit 1 \
        --json status,conclusion,headSha \
        --jq '.[0] | "\(.conclusion // .status) (\(.headSha[0:7]))"' 2>/dev/null) || CI=""
  if [ -n "$PRS" ]; then
    CTX=$(printf '%s\nopen PRs: %s' "$CTX" "$PRS")
  fi
  if [ -n "$CI" ]; then
    CTX=$(printf '%s\nlast CI: %s' "$CTX" "$CI")
  fi
fi

# Emit the SessionStart additionalContext envelope as a single-line JSON object.
printf '%s' "$CTX" | python3 -c "
import json, sys
ctx = sys.stdin.read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': ctx}}, separators=(',', ':')))
" 2>/dev/null || true

exit 0
