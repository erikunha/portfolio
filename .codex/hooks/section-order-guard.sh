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

if printf '%s' "$FILE" | grep -qE 'components/sections/.*\.tsx$|AppShell/AppShell\.module\.css$'; then
  RESULT=$(node scripts/check-section-order.mjs 2>&1)
  EXIT=$?
  if [ $EXIT -ne 0 ]; then
    printf '\n[section-order-guard] %s\n' "$RESULT"
    printf 'A section component was modified but AppShell.module.css is missing a mobile order entry.\n'
    printf 'Run: node scripts/check-section-order.mjs for details.\n'
  fi
fi

exit 0
