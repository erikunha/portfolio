#!/usr/bin/env bash
INPUT=$(cat)
NAV_TOOL=mcp__plugin_playwright_playwright__browser_navigate
TABS_TOOL=mcp__plugin_playwright_playwright__browser_tabs

# Prefilter before spawning an interpreter. This hook sits on the bare Skill
# matcher, so the overwhelmingly common case is a call that mandates nothing;
# paying a python3 start on every one of those is a tax on all Skill use. A
# token absent from the raw payload cannot be the parsed target, so this can
# only skip calls the case statement below would also have let through.
case "$INPUT" in
  *speckit-plan*|*"$NAV_TOOL"*|*"$TABS_TOOL"*) ;;
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

# Each mandate binds a AGENTS.md rule to the one event that rule already names,
# so the predicate is the rule itself rather than a proxy for it. browser_tabs
# accepts a url, so gating navigation alone would leave a first-party bypass:
# open the tab, screenshot it, never navigate.
case "$TOOL:$TARGET" in
  Skill:speckit-plan)       REQUIRED=thinking-risk-premortem ;;
  "$NAV_TOOL:$NAV_TOOL")    REQUIRED=web-design-guidelines ;;
  "$TABS_TOOL:$TABS_TOOL")  REQUIRED=web-design-guidelines ;;
  *:-)
    # Parse failure only. Reaching this from a well-formed payload would block
    # any call whose arguments merely mention a mandated token, and a gate that
    # fires on ordinary work trains the bypass it exists to prevent. The grep
    # stays unanchored because here the payload is already known to be
    # unparseable: a stricter field pattern would fail open on exactly the
    # malformed input this arm exists to catch.
    if printf '%s' "$INPUT" | grep -qF 'speckit-plan'; then REQUIRED=thinking-risk-premortem
    elif printf '%s' "$INPUT" | grep -qF "$NAV_TOOL"; then REQUIRED=web-design-guidelines
    elif printf '%s' "$INPUT" | grep -qF "$TABS_TOOL"; then REQUIRED=web-design-guidelines
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
