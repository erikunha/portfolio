#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools.
# Receives tool input JSON on stdin.
# When a section component or AppShell.module.css is modified, runs
# check-section-order.mjs to catch missing mobile order entries immediately.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  # PostToolUse payload: path is nested under tool_input.file_path
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# Only trigger for section components or AppShell layout file
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
