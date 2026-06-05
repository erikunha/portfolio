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
  # WHY second-granularity (not ms): the ordering check (agentDispatchedAfter) is
  # STRICTLY after, so a security-auditor dispatch in the SAME wall-clock second
  # as this edit is treated as NOT-after and will NOT clear the marker. That is
  # the SAFE direction (over-block: re-dispatch or the audit genuinely post-dates
  # by >=1s in any real edit-then-audit flow). Do NOT "upgrade" to ms precision
  # without re-checking that the dangerous direction (pre-edit audit clearing a
  # later edit) stays prevented.
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  mkdir -p .claude 2>/dev/null
  printf '%s\t%s\t%s\n' "$TS" "$HEAD_SHA" "$FILE" >> .claude/.api-edit-pending 2>/dev/null || true
  printf '[api-edit-marker] Recorded API-surface edit: %s\n' "$FILE"
  printf 'Dispatch security-auditor before pushing. The push guard will block until you do.\n'
fi
exit 0
