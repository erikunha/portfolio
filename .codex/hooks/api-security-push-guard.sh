#!/usr/bin/env bash
INPUT=$(cat)
HOOK_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || printf '.')
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
MARKER="$ROOT/.codex/.api-edit-pending"
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
DET_RC=$?
if [ "$DET_RC" -eq 3 ] && [ -n "$CMD" ]; then
  :
elif [ "$DET_RC" -eq 0 ] && [ -n "$CMD" ]; then
  printf '%s\n' "$DET" | awk -F'\t' '
    BEGIN {
      split("--upload-pack --receive-pack --exec --exec-path --extcmd --template --separate-git-dir --super-prefix --git-dir --work-tree --config --config-env", df, " ")
      split("--setup --tree-filter --index-filter --commit-filter --env-filter --msg-filter --parent-filter --tag-name-filter", ff, " ")
      split("--unset --unset-all --remove-section --rename-section --replace-all --add --edit", cw, " ")
    }
    function abbrev(tok, set,   name, i) {
      name = tok
      sub(/=.*/, "", name)
      if (name !~ /^--/ || length(name) < 3) return 0
      for (i in set) if (index(set[i], name) == 1) return 1
      return 0
    }
    $1 == "#assign" { found = 1 }
    $1 != "#assign" {
      for (g = 1; g <= NF && !found; g++) {
      if ($g != "git" && $g !~ /^git-/) continue
      if (g == 1 && ($g ~ /^git-/ || g == NF)) { found = 1; break }
      if ($g ~ /^git-/) continue
      isfilter = 0
      for (i = g + 1; i <= NF; i++) if ($i == "filter-branch") { isfilter = 1; break }
      subcmd = ""
      for (i = g + 1; i <= NF; i++) if ($i !~ /^-/) { subcmd = $i; break }
      for (i = g + 1; i <= NF; i++) {
        a = $i
        if (abbrev(a, df)) { found = 1; break }
        # -u is --upload-pack only for the transports, -x is --exec only for
        # rebase/difftool. Globally they are `git add -u`, `git diff -u`,
        # `git log -u`, `git stash -u`, `git clean -x` — all routine.
        if (a == "-u" && subcmd ~ /^(fetch|clone|pull|ls-remote|archive)$/) { found = 1; break }
        if (a == "-x" && subcmd ~ /^(rebase|difftool|mergetool)$/) { found = 1; break }
        if (isfilter && abbrev(a, ff)) { found = 1; break }
      }
      skip = 0
      for (i = g + 1; i <= NF && !found; i++) {
        a = $i
        if (skip) { skip = 0; continue }
        if (a ~ /^-/) {
          if (a ~ /^-c/ || abbrev(a, df)) { found = 1; break }
          if (a == "-C" || a == "--namespace") skip = 1
          continue
        }
        if (a ~ /[$`]/) { found = 1; break }
        if (a == "push" || a == "send-pack" || a == "http-push") { found = 1; break }
        if (a == "config") {
          operands = 0
          if ($(i + 1) == "get" || $(i + 1) == "list" || $(i + 1) == "getall") break
          for (j = i + 1; j <= NF; j++) {
            if (abbrev($j, cw)) found = 1
            else if ($j !~ /^-/) operands++
          }
          if (operands >= 2) found = 1
          break
        }
        if (a == "subtree" || a == "svn" || a == "p4") continue
        break
      }
      }
    }
    END { exit found ? 0 : 1 }' || exit 0
elif [ "$DET_RC" -eq 4 ] || [ -z "$CMD" ]; then
  HAY=$(printf '%s' "${INPUT//$ROOT/}" | sed 's/"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"//g; s/"cwd"[[:space:]]*:[[:space:]]*"[^"]*"//g; s/"description"[[:space:]]*:[[:space:]]*"[^"]*"//g')
  printf '%s' "$HAY" | grep -qF 'git' \
    && printf '%s' "$HAY" | grep -qF 'push' || exit 0
else
  :
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
  rm -f "$MARKER"
  exit 0
fi
printf '[BLOCKED] git push blocked — unaudited API-surface edit(s) pending:\n' >&2
cat "$MARKER" >&2
printf 'Dispatch security-auditor (AGENTS.md Ch.9), then retry the push.\n' >&2
exit 2
