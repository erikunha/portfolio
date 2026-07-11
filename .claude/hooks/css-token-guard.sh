#!/usr/bin/env bash

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$FILE" | grep -qE 'app/css/.*\.css$|\.module\.css$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

  RESULT=$("$REPO_ROOT/node_modules/.bin/tsx" "$REPO_ROOT/scripts/lint-css-tokens.ts" 2>&1)
  if [ $? -ne 0 ]; then
    printf '\n[css-token-guard] Raw hex in CSS (use an app/css/theme.css token):\n%s\n' "$RESULT"
  fi
fi

exit 0
