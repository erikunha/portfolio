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
if printf '%s' "$FILE" | grep -qE 'app/api/|lib/rate-limit\.ts$|(^|/)proxy\.ts$'; then
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  TS=$(node -e 'process.stdout.write(new Date().toISOString())' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.000Z)
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  mkdir -p "$ROOT/.claude" 2>/dev/null
  printf '%s\t%s\t%s\n' "$TS" "$HEAD_SHA" "$FILE" >> "$ROOT/.claude/.api-edit-pending" 2>/dev/null || true
  printf '[api-edit-marker] Recorded API-surface edit: %s\n' "$FILE"
  printf 'Dispatch security-auditor before pushing. The push guard will block until you do.\n'
fi
exit 0
