#!/usr/bin/env bash
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$FILE" | grep -qE '\.(ts|tsx|js|jsx|json|jsonc|css)$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  BIOME="$REPO_ROOT/node_modules/.bin/biome"
  if [ -x "$BIOME" ] && [ -f "$FILE" ]; then
    "$BIOME" check --write --linter-enabled=false --no-errors-on-unmatched "$FILE" >/dev/null 2>&1 || true
  fi
fi

exit 0
