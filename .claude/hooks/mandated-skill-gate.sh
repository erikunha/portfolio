#!/usr/bin/env bash
INPUT=$(cat)
read -r TOOL TARGET TRANSCRIPT <<EOF
$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  ti=d.get('tool_input',{}) or {}
  tool=d.get('tool_name','')
  target=ti.get('skill','') if tool=='Skill' else tool
  print(tool or '-', target or '-', d.get('transcript_path','') or '-')
except Exception: print('- - -')
" 2>/dev/null || echo "- - -")
EOF

# Each mandate binds a CLAUDE.md rule to the one event that rule already names,
# so the predicate is the rule itself rather than a proxy for it. Widening a
# trigger past its named event buys coverage with false positives, and a gate
# that cries wolf trains the bypass it was added to prevent.
NAV_TOOL=mcp__plugin_playwright_playwright__browser_navigate
case "$TOOL:$TARGET" in
  Skill:speckit-plan)     REQUIRED=thinking-risk-premortem ;;
  "$NAV_TOOL:$NAV_TOOL")  REQUIRED=web-design-guidelines ;;
  *)
    # Same raw-payload fallback as architect-gate.sh: a malformed payload still
    # carrying a mandated token must not silently fail open.
    if printf '%s' "$INPUT" | grep -qF 'speckit-plan'; then REQUIRED=thinking-risk-premortem
    elif printf '%s' "$INPUT" | grep -qF "$NAV_TOOL"; then REQUIRED=web-design-guidelines
    else exit 0
    fi
    ;;
esac

block() {
  printf '[BLOCKED] %s requires %s first (CLAUDE.md mandate).\n' "${TARGET:--}" "$REQUIRED" >&2
  printf 'Invoke the %s skill, then retry. %s\n' "$REQUIRED" "$1" >&2
  exit 2
}

[ "$TRANSCRIPT" = "-" ] || [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ] \
  && block "Transcript unreadable, so the mandate cannot be shown satisfied (fail-closed)."

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
RAN=$(node -e "
const { pathToFileURL } = require('node:url');
import(pathToFileURL(process.argv[1] + '/scripts/lib/transcript.mjs').href).then(m => {
  process.stdout.write(m.skillInvoked(m.readTranscript(process.argv[2]), process.argv[3]) ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" "$REQUIRED" 2>/dev/null || echo "no")

[ "$RAN" = "yes" ] && exit 0
block "No ${REQUIRED} tool_use in this session's transcript."
