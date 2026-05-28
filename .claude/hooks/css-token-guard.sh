#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools.
# When a CSS module or global CSS file is edited, runs token-boundary and
# no-magic-values lints immediately (~60ms each) to catch raw hex values,
# primitive token references, and magic spacing before the next step.
# Both scripts are already in pnpm verify — this surfaces violations at
# edit time instead of waiting for CI.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$FILE" | grep -qE '\.module\.css$|app/css/.*\.css$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

  TOKEN_RESULT=$(node "$REPO_ROOT/scripts/lint-token-boundary.mjs" 2>&1)
  TOKEN_EXIT=$?

  MAGIC_RESULT=$(node "$REPO_ROOT/scripts/lint-no-magic-values.mjs" 2>&1)
  MAGIC_EXIT=$?

  if [ $TOKEN_EXIT -ne 0 ]; then
    printf '\n[css-token-guard] Token boundary violation in %s:\n%s\n' "$FILE" "$TOKEN_RESULT"
  fi
  if [ $MAGIC_EXIT -ne 0 ]; then
    printf '\n[css-token-guard] Magic value detected in %s:\n%s\n' "$FILE" "$MAGIC_RESULT"
  fi
fi

exit 0
