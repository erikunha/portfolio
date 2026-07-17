#!/usr/bin/env bash
cat >/dev/null 2>&1 || true   # consume stdin defensively; SessionStart has no tool input

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" 2>/dev/null || exit 0

command -v timeout >/dev/null 2>&1 && TIMEOUT="timeout 5" || TIMEOUT=""

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

AHEAD=0; BEHIND=0
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  read -r BEHIND AHEAD < <(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null || echo "0 0")
fi

UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
LAST_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || echo "")

CTX=$(printf '[session-context]\nbranch: %s (%s ahead, %s behind)\nuncommitted: %s files\nlast commit: %s' \
  "$BRANCH" "$AHEAD" "$BEHIND" "$UNCOMMITTED" "$LAST_SUBJECT")

if command -v gh >/dev/null 2>&1; then
  PRS=$($TIMEOUT gh pr list --state open --json number,headRefName \
        --jq 'if length==0 then "none" else (map("#\(.number) \(.headRefName)") | join(", ")) end' 2>/dev/null) || PRS=""
  CI=$($TIMEOUT gh run list --branch "$BRANCH" --limit 1 \
        --json status,conclusion,headSha \
        --jq '.[0] | "\(.conclusion // .status) (\(.headSha[0:7]))"' 2>/dev/null) || CI=""
  if [ -n "$PRS" ]; then
    CTX=$(printf '%s\nopen PRs: %s' "$CTX" "$PRS")
  fi
  if [ -n "$CI" ]; then
    CTX=$(printf '%s\nlast CI: %s' "$CTX" "$CI")
  fi
fi

printf '%s' "$CTX" | python3 -c "
import json, sys
ctx = sys.stdin.read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': ctx}}, separators=(',', ':')))
" 2>/dev/null || true

exit 0
