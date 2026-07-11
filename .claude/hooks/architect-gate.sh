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
PASSED=$(node -e "
const { pathToFileURL } = require('node:url');
import(pathToFileURL(process.argv[1] + '/scripts/lib/transcript.mjs').href).then(m => {
  const recs = m.readTranscript(process.argv[2]);
  // Require GATE_RESULT: PASS inside the architect-reviewer's OWN result:
  //  - sync dispatch: a tool_result block correlated by tool_use id, so an
  //    unrelated tool_result (e.g. Bash stdout printing the sentinel) can't spoof;
  //  - async dispatch: a harness task-notification (origin.kind='task-notification',
  //    a CLI-stamped field a human cannot type from chat) naming this dispatch's
  //    tool-use-id. A human-typed/pasted user turn (origin.kind='human') is rejected.
  // See scripts/lib/transcript.mjs agentResultContains for the anti-spoof anchors.
  const ok = m.agentResultContains(recs, 'architect-reviewer', 'GATE_RESULT: PASS');
  process.stdout.write(ok ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" 2>/dev/null || echo "no")
if [ "$PASSED" = "yes" ]; then exit 0; fi
printf '[BLOCKED] writing-plans blocked — no architect-reviewer GATE_RESULT: PASS this session.\n' >&2
printf 'Dispatch architect-reviewer against the spec first; it must return GATE_RESULT: PASS.\n' >&2
exit 2
