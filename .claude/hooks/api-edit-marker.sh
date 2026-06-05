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
  # MILLISECOND-precision ISO timestamp (same shape as transcript record times),
  # so the strictly-after ordering check (agentDispatchedAfter) compares exactly.
  # A SECOND-floored time (`date +%S`) rounds the EDIT time DOWN, so a
  # security-auditor dispatch earlier in the SAME second would compare as "after"
  # the marker and FALSELY clear it (the dangerous direction). node's toISOString
  # is portable where `date` ms-formatting (`%N`) is not (BSD/macOS).
  TS=$(node -e 'process.stdout.write(new Date().toISOString())' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.000Z)
  # Write to a $ROOT-anchored path so the marker is cwd-independent — the
  # push-guard reads the same absolute path (a cwd-relative marker would be
  # invisible to a hook running from a subdirectory).
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  mkdir -p "$ROOT/.claude" 2>/dev/null
  printf '%s\t%s\t%s\n' "$TS" "$HEAD_SHA" "$FILE" >> "$ROOT/.claude/.api-edit-pending" 2>/dev/null || true
  printf '[api-edit-marker] Recorded API-surface edit: %s\n' "$FILE"
  printf 'Dispatch security-auditor before pushing. The push guard will block until you do.\n'
fi
exit 0
