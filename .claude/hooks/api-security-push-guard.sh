#!/usr/bin/env bash
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(d.get('tool_input',{}).get('command','') or d.get('command',''))
except Exception: print('')
" 2>/dev/null || echo "")
# Same raw-payload fallback as bash-guard.sh: a malformed payload still
# carrying a git-push token must not silently fail open.
if [ -z "$CMD" ] && [ -n "$INPUT" ]; then
  CMD="$INPUT"
fi
TRANSCRIPT=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('transcript_path',''))
except Exception: print('')
" 2>/dev/null || echo "")

printf '%s' "$CMD" | grep -qE '(^|[[:space:]])git([[:space:]]|$)' \
  && printf '%s' "$CMD" | grep -qE '(^|[[:space:]])push([[:space:]]|$)' || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
MARKER="$ROOT/.claude/.api-edit-pending"
[ -s "$MARKER" ] || exit 0

if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] Unaudited API edit pending and transcript unreadable (fail-closed).\n' >&2
  printf 'Pending:\n' >&2; cat "$MARKER" >&2
  printf 'Dispatch security-auditor, then retry the push.\n' >&2
  exit 2
fi
MARKER_TS=$(tail -n 1 "$MARKER" | cut -f1)
AUDITED=$(node -e "
const { pathToFileURL } = require('node:url');
import(pathToFileURL(process.argv[1] + '/scripts/lib/transcript.mjs').href).then(m => {
  const recs = m.readTranscript(process.argv[2]);
  const ran = m.agentDispatchedAfter(recs, 'security-auditor', process.argv[3]);
  process.stdout.write(ran ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" "$MARKER_TS" 2>/dev/null || echo "no")
if [ "$AUDITED" = "yes" ]; then
  rm -f "$MARKER"   # verified audit clears the marker so it never blocks forever
  exit 0
fi
printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
cat "$MARKER" >&2
printf 'Dispatch security-auditor (CLAUDE.md Ch.9), then retry the push.\n' >&2
exit 2
