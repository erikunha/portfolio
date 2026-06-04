#!/usr/bin/env bash
# PreToolUse hook for Bash (WS4 API-edit security gate, part 2).
# Blocks `git push` while .claude/.api-edit-pending is non-empty UNLESS the
# transcript shows a security-auditor dispatch this session.
# Fail-closed: a present marker + unreadable transcript blocks (exit 2).
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('tool_input',{}).get('command','') or json.load(sys.stdin).get('command',''))
except Exception: print('')
" 2>/dev/null || echo "")
TRANSCRIPT=$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try: print(json.load(sys.stdin).get('transcript_path',''))
except Exception: print('')
" 2>/dev/null || echo "")

# Only act on a real git push; ignore everything else.
printf '%s' "$CMD" | grep -qE '\bgit[[:space:]]+push\b' || exit 0
# No marker / empty marker => nothing pending, allow.
MARKER=".claude/.api-edit-pending"
[ -s "$MARKER" ] || exit 0

# Marker present: require a security-auditor dispatch in the transcript.
# Session-scoped (-1): the marker is itself session-local, and post-commit
# clears the broader review stamp, so "this session" is the correct window.
if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf '[BLOCKED] Unaudited API edit pending and transcript unreadable (fail-closed).\n' >&2
  printf 'Pending:\n' >&2; cat "$MARKER" >&2
  printf 'Dispatch security-auditor, then retry the push.\n' >&2
  exit 2
fi
AUDITED=$(node -e "
import('./scripts/lib/transcript.mjs').then(m => {
  const recs = m.readTranscript(process.argv[1]);
  const ran = m.agentsDispatchedSince(recs, -1).includes('security-auditor');
  process.stdout.write(ran ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$TRANSCRIPT" 2>/dev/null || echo "no")
if [ "$AUDITED" = "yes" ]; then
  rm -f "$MARKER"   # verified audit clears the marker so it never blocks forever
  exit 0
fi
printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
cat "$MARKER" >&2
printf 'Dispatch security-auditor (CLAUDE.md Ch.9), then retry the push.\n' >&2
exit 2
