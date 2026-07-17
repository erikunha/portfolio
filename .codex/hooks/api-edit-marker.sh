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
# Decide whether this edit touches the API surface. On a clean parse, match the
# extracted path (anchored). On a parse failure (malformed JSON / missing python3)
# FILE is empty but INPUT is not — fail closed by scanning the raw payload with
# relaxed patterns, so an unparsed API-surface edit still records a marker instead
# of silently disabling the security-auditor-before-push gate downstream.
API_HIT=""
if [ -n "$FILE" ]; then
  printf '%s' "$FILE" | grep -qE 'app/api/|lib/rate-limit\.ts$|(^|/)proxy\.ts$' && API_HIT="$FILE"
elif [ -n "$INPUT" ]; then
  printf '%s' "$INPUT" | grep -qE 'app/api/|lib/rate-limit\.ts|(^|/|")proxy\.ts' && API_HIT="<unparsed edit payload matching an API-surface path>"
fi

if [ -n "$API_HIT" ]; then
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  TS=$(node -e 'process.stdout.write(new Date().toISOString())' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.000Z)
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  mkdir -p "$ROOT/.codex" 2>/dev/null
  printf '%s\t%s\t%s\n' "$TS" "$HEAD_SHA" "$API_HIT" >> "$ROOT/.codex/.api-edit-pending" 2>/dev/null || true
  printf '[api-edit-marker] Recorded API-surface edit: %s\n' "$API_HIT"
  printf 'Dispatch security-auditor before pushing. The push guard will block until you do.\n'
fi
exit 0
