#!/usr/bin/env bash

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TSX="$REPO_ROOT/node_modules/.bin/tsx"
[ -x "$TSX" ] && "$TSX" "$REPO_ROOT/scripts/review-learn.ts" --auto 2>&1 || true
exit 0
