#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools (fast-feedback Unit A, hook 1 of 2).
# On each agent edit of a source file, applies Biome's MECHANICAL fixes —
# formatting + import organization — so format/import-order never surprise at the
# pre-commit `biome check .` gate. Lint findings are deliberately NOT auto-fixed.
#
# WHY `check --write` not `format --write`: biome.json has
# assist.actions.source.organizeImports:on, so `format` alone leaves import order
# failing pre-commit. WHY `--linter-enabled=false`: a deliberate mechanical-only
# scope choice — this hook applies ONLY formatting + import-organization and leaves
# every lint finding as a conscious pre-commit gate. (noUnusedImports/Variables
# autofix is UNSAFE — applied only under --unsafe; plain `check --write` runs safe
# fixes only and does NOT delete unused imports. Disabling the linter keeps the hook
# purely mechanical, it is not preventing auto-deletion under plain --write.) So:
# format + import-organization only; lint stays a conscious pre-commit gate.
# ALWAYS exits 0 — a PostToolUse feedback hook must never block the edit.
# History: created 2026-06-19 (Unit A). See DECISIONS.md.
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# Extension allow-list: only Biome-supported source files.
if printf '%s' "$FILE" | grep -qE '\.(ts|tsx|js|jsx|json|jsonc|css)$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  BIOME="$REPO_ROOT/node_modules/.bin/biome"
  # Guard on the binary existing (fresh clone, no install) — fail-silent if absent.
  if [ -x "$BIOME" ] && [ -f "$FILE" ]; then
    "$BIOME" check --write --linter-enabled=false --no-errors-on-unmatched "$FILE" >/dev/null 2>&1 || true
  fi
fi

exit 0
