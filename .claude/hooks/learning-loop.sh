#!/usr/bin/env bash
# SessionEnd hook: the flood-mitigated learning-loop auto-trigger.
#
# Runs the propose-only analyzer (scripts/review-learn.ts --auto) once at session
# end. It appends only NEW finding-classes that recurred across >= 3 cycles
# (capped at 3) to the gitignored `.review-learnings.md` inbox for you to review.
# It NEVER creates a gate, NEVER blocks the session, and is SILENT unless it
# records something new. This is the deliberate counter to the monotonic-growth
# disease: high evidence bar, hard cap, append-only, human decides.
#
# Fires once per session (SessionEnd), not per turn, so it does not nag.

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TSX="$REPO_ROOT/node_modules/.bin/tsx"
[ -x "$TSX" ] && "$TSX" "$REPO_ROOT/scripts/review-learn.ts" --auto 2>&1 || true
exit 0
