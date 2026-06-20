Show PR quality metrics: claude-review cycle count, size, and days open.

Usage: /pr-metrics [pr-number]

Run `pnpm pr-metrics $ARGUMENTS`

If no PR number is given, infers from the current branch via `gh pr view`.

Interpret results:
- claude-review cycles = 1: normal (initial review)
- claude-review cycles = 2: one re-request after feedback (acceptable)
- claude-review cycles > 2: signal that thinking-inversion or TDD failed upstream — bugs reached review that should have been caught during implementation
