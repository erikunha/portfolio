#!/usr/bin/env bash
# PreToolUse hook for the Skill tool (WS4 architect-before-writing-plans gate).
# Blocks superpowers:writing-plans unless the transcript shows an
# architect-reviewer dispatch that emitted GATE_RESULT: PASS this session.
# Fail-open for any other skill; fail-closed for writing-plans w/o PASS evidence.
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

# Only gate writing-plans; every other skill passes immediately.
[ "$SKILL" = "superpowers:writing-plans" ] || exit 0

if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] writing-plans requires a prior architect-reviewer PASS; transcript unreadable (fail-closed).\n' >&2
  printf 'Dispatch architect-reviewer first (must return GATE_RESULT: PASS).\n' >&2
  exit 2
fi
PASSED=$(node -e "
import('./scripts/lib/transcript.mjs').then(m => {
  const recs = m.readTranscript(process.argv[1]);
  // Require GATE_RESULT: PASS inside a tool_result block (the architect's
  // returned report) that appears AFTER the architect-reviewer dispatch — so
  // neither prose quoting the sentinel NOR an unrelated earlier tool_result can
  // spoof a FAILed/absent review into a pass.
  const idx = m.lastDispatchIndex(recs, 'architect-reviewer');
  const ok = idx >= 0 && m.containsInToolResultSince(recs, 'GATE_RESULT: PASS', idx);
  process.stdout.write(ok ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$TRANSCRIPT" 2>/dev/null || echo "no")
if [ "$PASSED" = "yes" ]; then exit 0; fi
printf '[BLOCKED] writing-plans blocked — no architect-reviewer GATE_RESULT: PASS this session.\n' >&2
printf 'Dispatch architect-reviewer against the spec first; it must return GATE_RESULT: PASS.\n' >&2
exit 2
