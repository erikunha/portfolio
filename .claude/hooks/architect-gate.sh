#!/usr/bin/env bash
INPUT=$(cat)
SKILL=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(d.get('tool_input',{}).get('skill','') or d.get('skill',''))
except Exception: print('')
" 2>/dev/null || echo "")
TRANSCRIPT=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('transcript_path',''))
except Exception: print('')
" 2>/dev/null || echo "")

[ "$SKILL" = "superpowers:writing-plans" ] || exit 0

if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] writing-plans requires a prior architect-reviewer PASS; transcript unreadable (fail-closed).\n' >&2
  printf 'Dispatch architect-reviewer first (must return GATE_RESULT: PASS).\n' >&2
  exit 2
fi
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SESSION_ID=$(basename "$TRANSCRIPT")
SESSION_ID="${SESSION_ID%.jsonl}"
PASSED=$(node -e "
const { pathToFileURL } = require('node:url');
import(pathToFileURL(process.argv[1] + '/scripts/lib/transcript.mjs').href).then(m => {
  const recs = m.readTranscript(process.argv[2]);
  const ok = m.agentResultContains(recs, 'architect-reviewer', 'GATE_RESULT: PASS', undefined, process.argv[3]);
  process.stdout.write(ok ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" "$SESSION_ID" 2>/dev/null || echo "no")
if [ "$PASSED" = "yes" ]; then exit 0; fi
printf '[BLOCKED] writing-plans blocked — no architect-reviewer GATE_RESULT: PASS this session.\n' >&2
printf 'Dispatch architect-reviewer against the spec first; it must return GATE_RESULT: PASS.\n' >&2
exit 2
