#!/usr/bin/env bash
INPUT=$(cat)
PW=mcp__plugin_playwright_playwright__browser
NAV_TOOL="${PW}_navigate"
TABS_TOOL="${PW}_tabs"
SHOT_TOOL="${PW}_take_screenshot"
SNAP_TOOL="${PW}_snapshot"

# Prefilter before spawning an interpreter. This hook sits on the bare Skill
# matcher, so the overwhelmingly common case mandates nothing, and paying a
# python3 start on each of those taxes all Skill use. Skipping here is only
# safe for payloads the case statement below would also pass, so a payload
# carrying a JSON escape falls through to the real parse rather than being
# judged on its raw bytes: "-" decodes to a token this glob cannot see.
case "$INPUT" in
  *'\u'*) ;;
  *speckit-plan*|*"$NAV_TOOL"*|*"$TABS_TOOL"*|*"$SHOT_TOOL"*|*"$SNAP_TOOL"*) ;;
  *) exit 0 ;;
esac

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

# Each mandate binds a AGENTS.md rule to the event that rule names. Reaching a
# page is an OPEN set -- navigate, tabs, evaluate, run_code_unsafe, a click on a
# link -- so enumerating entry points loses to drift as the MCP server grows.
# Observation is the closed set and is what a UI review actually is, so the
# screenshot and snapshot sinks are gated too: whatever route reached the page,
# looking at it is what the mandate binds to.
case "$TOOL:$TARGET" in
  Skill:speckit-plan)       REQUIRED=thinking-risk-premortem ;;
  "$NAV_TOOL:$NAV_TOOL")    REQUIRED=web-design-guidelines ;;
  "$TABS_TOOL:$TABS_TOOL")  REQUIRED=web-design-guidelines ;;
  "$SHOT_TOOL:$SHOT_TOOL")  REQUIRED=web-design-guidelines ;;
  "$SNAP_TOOL:$SNAP_TOOL")  REQUIRED=web-design-guidelines ;;
  *:-)
    # Parse failure only. Reaching this from a well-formed payload would block
    # any call whose arguments merely mention a mandated token, and a gate that
    # fires on ordinary work trains the bypass it exists to prevent. The grep
    # stays unanchored because here the payload is already known to be
    # unparseable: a stricter field pattern would fail open on exactly the
    # malformed input this arm exists to catch.
    if printf '%s' "$INPUT" | grep -qF 'speckit-plan'; then REQUIRED=thinking-risk-premortem
    elif printf '%s' "$INPUT" | grep -qE "${NAV_TOOL}|${TABS_TOOL}|${SHOT_TOOL}|${SNAP_TOOL}"; then REQUIRED=web-design-guidelines
    else exit 0
    fi
    ;;
  *) exit 0 ;;
esac

block() {
  printf '[BLOCKED] %s requires %s first (AGENTS.md mandate).\n' "${TARGET:--}" "$REQUIRED" >&2
  printf 'Invoke the %s skill, then retry. %s\n' "$REQUIRED" "$1" >&2
  exit 2
}

[ "$TRANSCRIPT" = "-" ] || [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ] \
  && block "Transcript unreadable, so the mandate cannot be shown satisfied (fail-closed)."

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
RAN=$(node -e "
const { pathToFileURL } = require('node:url');
import(pathToFileURL(process.argv[1] + '/scripts/lib/transcript.mjs').href).then(m => {
  process.stdout.write(m.skillCompleted(m.readTranscript(process.argv[2]), process.argv[3]) ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" "$REQUIRED" 2>/dev/null || echo "no")

[ "$RAN" = "yes" ] && exit 0
block "No completed ${REQUIRED} call in this session's transcript."
