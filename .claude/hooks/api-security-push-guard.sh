#!/usr/bin/env bash
INPUT=$(cat)
HOOK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || printf '.')
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
MARKER="$ROOT/.claude/.api-edit-pending"
[ -s "$MARKER" ] || exit 0
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

DET=$(printf '%s' "$INPUT" | python3 "$HOOK_DIR/bash-guard-detect.py" --emit-commands 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$CMD" ]; then
  printf '%s\n' "$DET" | awk -F'\t' '
    $1 == "git" {
      skip = 0
      for (i = 2; i <= NF; i++) {
        a = $i
        if (skip) { skip = 0; continue }
        if (a ~ /^-/) {
          if (a == "-c" || a == "-C" || a == "--git-dir" || a == "--work-tree" \
              || a == "--namespace" || a == "--exec-path" || a == "--config-env") skip = 1
          continue
        }
        if (a == "push") { found = 1; break }
        if (a == "subtree") continue
        break
      }
    }
    END { exit found ? 0 : 1 }' || exit 0
elif [ -n "$CMD" ]; then
  printf '%s' "$CMD" | grep -qE '(^|[[:space:];&|(])git([[:space:];&|)]|$)' \
    && printf '%s' "$CMD" | grep -qE '(^|[[:space:];&|(])push([[:space:];&|)]|$)' || exit 0
else
  HAY=$(printf '%s' "$INPUT" | sed 's/"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"//g; s/"cwd"[[:space:]]*:[[:space:]]*"[^"]*"//g; s/"description"[[:space:]]*:[[:space:]]*"[^"]*"//g')
  printf '%s' "$HAY" | grep -qF 'git' \
    && printf '%s' "$HAY" | grep -qF 'push' || exit 0
fi

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
printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
cat "$MARKER" >&2
printf 'Dispatch security-auditor (CLAUDE.md Ch.9), then retry the push.\n' >&2
exit 2
