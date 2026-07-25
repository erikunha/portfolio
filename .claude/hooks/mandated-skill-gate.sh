#!/usr/bin/env bash
INPUT=$(cat)
PW=mcp__plugin_playwright_playwright__browser

# Prefilter before spawning an interpreter. This hook sits on the bare Skill
# matcher, so the overwhelmingly common case mandates nothing, and paying a
# python3 start on each of those taxes all Skill use. Skipping here is only
# safe for payloads the case statement below would also pass, so a payload
# carrying a JSON escape falls through to the real parse rather than being
# judged on its raw bytes: "-" decodes to a token this glob cannot see.
case "$INPUT" in
  *'\u'*) ;;
  *speckit-plan*|*"$PW"_*) ;;
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

# Enumerating browser tools lost three times: navigate missed tabs, then
# navigate+tabs missed evaluate and run_code_unsafe, which return page content
# to the caller and are therefore sinks themselves. Neither "reaching a page"
# nor "observing one" is a closed set, and the server resolves at @latest so
# the surface can grow between runs. The NAMESPACE is the closed set: gate all
# of it. A tool added upstream is then gated by default.
#
# The carve-out is only what returns nothing about a page: close reports
# termination, resize reports a viewport size. console_messages and
# network_requests were carved out once and put back -- both exist to surface
# page-originated content (logged app state, response bodies), and the browser
# context outlives a session, so a fresh transcript could read back a page it
# never reached. handle_dialog stays gated because its result shape was not
# verified, and an unverified tool belongs on the safe side of a gate.
case "$TOOL" in
  "$PW"_close|"$PW"_resize) exit 0 ;;
esac
case "$TOOL:$TARGET" in
  Skill:speckit-plan)  REQUIRED=thinking-risk-premortem ;;
  "$PW"_*:*)           REQUIRED=web-design-guidelines ;;
  *:-)
    # Parse failure only. Reaching this from a well-formed payload would block
    # any call whose arguments merely mention a mandated token, and a gate that
    # fires on ordinary work trains the bypass it exists to prevent. The grep
    # stays unanchored because here the payload is already known to be
    # unparseable: a stricter field pattern would fail open on exactly the
    # malformed input this arm exists to catch.
    if printf '%s' "$INPUT" | grep -qF 'speckit-plan'; then REQUIRED=thinking-risk-premortem
    elif printf '%s' "$INPUT" | grep -qF "${PW}_"; then REQUIRED=web-design-guidelines
    else exit 0
    fi
    ;;
  *) exit 0 ;;
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
  process.stdout.write(m.skillCompleted(m.readTranscript(process.argv[2]), process.argv[3]) ? 'yes' : 'no');
}).catch(() => process.stdout.write('no'));
" "$ROOT" "$TRANSCRIPT" "$REQUIRED" 2>/dev/null || echo "no")

[ "$RAN" = "yes" ] && exit 0
block "No completed ${REQUIRED} call in this session's transcript."
