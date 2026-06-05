#!/usr/bin/env bash
# PreToolUse hook for Bash (WS4 API-edit security gate, part 2).
# Blocks `git push` while .claude/.api-edit-pending is non-empty UNLESS the
# transcript shows a security-auditor dispatch this session.
# Fail-closed: a present marker + unreadable transcript blocks (exit 2).
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
# Load stdin ONCE (a second json.load on consumed stdin would throw, silently
# emptying CMD and skipping the gate). tool_input.command is the real field.
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

# Only act on a real git push; ignore everything else. Match `git` and `push`
# non-adjacently so global-option forms (`git -C . push`, `git -c k=v push`) are
# still caught. This in-session guard is best-effort (variable/eval indirection
# can still evade); the DURABLE backstop is the .husky/pre-push marker gate,
# which fires at the one chokepoint git guarantees runs regardless of syntax.
printf '%s' "$CMD" | grep -qE '\bgit\b.*\bpush\b' || exit 0
# No marker / empty marker => nothing pending, allow.
MARKER=".claude/.api-edit-pending"
[ -s "$MARKER" ] || exit 0

# Marker present: require a security-auditor dispatch AFTER the most recent
# marker entry (ORDERING). A stale pre-edit audit must NOT clear a later edit —
# the latest marker line's timestamp (field 1) is the boundary.
if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] Unaudited API edit pending and transcript unreadable (fail-closed).\n' >&2
  printf 'Pending:\n' >&2; cat "$MARKER" >&2
  printf 'Dispatch security-auditor, then retry the push.\n' >&2
  exit 2
fi
MARKER_TS=$(tail -n 1 "$MARKER" | cut -f1)
AUDITED=$(node -e "
import('./scripts/lib/transcript.mjs').then(m => {
  const recs = m.readTranscript(process.argv[1]);
  const ran = m.agentDispatchedAfter(recs, 'security-auditor', process.argv[2]);
  process.stdout.write(ran ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$TRANSCRIPT" "$MARKER_TS" 2>/dev/null || echo "no")
if [ "$AUDITED" = "yes" ]; then
  rm -f "$MARKER"   # verified audit clears the marker so it never blocks forever
  exit 0
fi
printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
cat "$MARKER" >&2
printf 'Dispatch security-auditor (CLAUDE.md Ch.9), then retry the push.\n' >&2
exit 2
