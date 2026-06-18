#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools.
# When a global CSS file under app/css/ is edited, runs the css-tokens lint
# immediately to catch raw hex color literals. Per STANDARDS Ch.7 all brand
# colors live in app/css/theme.css; every other file references a var(--color-)
# token. Surfaces violations at edit time instead of waiting for CI.
# The same lint runs in `pnpm lint:css-tokens` and the `pnpm verify` chain.
#
# History: this previously called scripts/lint-token-boundary.mjs and
# scripts/lint-no-magic-values.mjs, both removed in the Tailwind v4 migration
# (2026-05-31). The hook was left pointing at the deleted scripts and silently
# no-opped (it never fired, never false-fired) until the gate-health meta-gate
# surfaced it on 2026-06-17.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  # PostToolUse payload: path is nested under tool_input.file_path
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$FILE" | grep -qE 'app/css/.*\.css$|\.module\.css$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

  RESULT=$("$REPO_ROOT/node_modules/.bin/tsx" "$REPO_ROOT/scripts/lint-css-tokens.ts" 2>&1)
  if [ $? -ne 0 ]; then
    printf '\n[css-token-guard] Raw hex in CSS (use an app/css/theme.css token):\n%s\n' "$RESULT"
  fi
fi

exit 0
