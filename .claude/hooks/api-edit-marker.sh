#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools (WS4 API-edit security gate, part 1).
# Records a "dirty" marker when the API surface is edited. ALWAYS exits 0
# (a PostToolUse recorder must never block the edit; fail-open by design).
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
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  mkdir -p .claude 2>/dev/null
  printf '%s\t%s\t%s\n' "$TS" "$HEAD_SHA" "$FILE" >> .claude/.api-edit-pending 2>/dev/null || true
  printf '[api-edit-marker] Recorded API-surface edit: %s\n' "$FILE"
  printf 'Dispatch security-auditor before pushing. The push guard will block until you do.\n'
fi
exit 0
