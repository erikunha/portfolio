#!/usr/bin/env bash
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(d.get('tool_input',{}).get('command','') or d.get('command',''))
except Exception: print('')
" 2>/dev/null || echo "")
TRANSCRIPT=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('transcript_path',''))
except Exception: print('')
" 2>/dev/null || echo "")

MATCHED_BY_CONTAINMENT=""
if [ -n "$CMD" ]; then
  printf '%s' "$CMD" | grep -qE '(^|[[:space:]])git([[:space:]]|$)' \
    && printf '%s' "$CMD" | grep -qE '(^|[[:space:]])push([[:space:]]|$)' || exit 0
else
  MATCHED_BY_CONTAINMENT="yes"
  # Extraction failed, so the raw payload is JSON text, not a command line:
  # word boundaries are unreachable there (\ngit, push\", "git) and every
  # normalization pass so far has left another adjacency open. Containment has
  # no boundary to get wrong, and over-blocking is the safe direction here.
  HAY=$(printf '%s' "$INPUT" | sed 's/"transcript_path"[^,}]*//g; s/"cwd"[^,}]*//g')
  printf '%s' "$HAY" | grep -qF 'git' \
    && printf '%s' "$HAY" | grep -qF 'push' || exit 0
fi
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
MARKER="$ROOT/.codex/.api-edit-pending"
[ -s "$MARKER" ] || exit 0

if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] Unaudited API edit pending and transcript unreadable (fail-closed).\n' >&2
  printf 'Pending:\n' >&2; cat "$MARKER" >&2
  printf 'Dispatch security-auditor, then retry the push.\n' >&2
  printf 'If the transcript stays unreadable (python3 or node unavailable), no dispatch\n' >&2
  printf 'can clear this: audit the files above by hand, then rm %s\n' "$MARKER" >&2
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
if [ -n "$MATCHED_BY_CONTAINMENT" ]; then
  printf '[BLOCKED] Payload unparseable and mentions git/push — blocking conservatively.\n' >&2
else
  printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
fi
cat "$MARKER" >&2
printf 'Dispatch security-auditor (AGENTS.md Ch.9), then retry the push.\n' >&2
exit 2
