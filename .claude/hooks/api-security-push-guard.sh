#!/usr/bin/env bash
# PreToolUse hook for Bash (WS4 API-edit security gate, part 2).
# Blocks `git push` while .claude/.api-edit-pending is non-empty UNLESS the
# transcript shows a security-auditor dispatch STRICTLY AFTER the most recent
# marker entry's timestamp (ordering — a stale pre-edit audit must NOT clear a
# later edit).
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

# Only act on a real git push; ignore everything else. Require both `git` and
# `push` as whitespace/edge-delimited TOKENS (so global-option forms like
# `git -C . push` are caught, but `digit`/`pushd` are not). POSIX ERE token
# boundaries `(^|[[:space:]])X([[:space:]]|$)` — NOT `\b`, which is non-portable
# (BSD/POSIX grep may treat `\b` as a literal `b` and silently never match).
# This in-session guard is best-effort (variable/eval indirection can still
# evade); the DURABLE backstop is the .husky/pre-push marker gate.
printf '%s' "$CMD" | grep -qE '(^|[[:space:]])git([[:space:]]|$)' \
  && printf '%s' "$CMD" | grep -qE '(^|[[:space:]])push([[:space:]]|$)' || exit 0
# Resolve the repo root so BOTH the marker path and the helper import are
# cwd-INDEPENDENT (a relative path fails if the hook runs from a subdirectory:
# the marker would not be found -> false allow; the import would fail -> false
# block). The marker is written to the same $ROOT path by api-edit-marker.sh.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
# No marker / empty marker => nothing pending, allow.
MARKER="$ROOT/.claude/.api-edit-pending"
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
