Show PR quality metrics: Copilot review cycle count, size, and days open.

Usage: /pr-metrics [pr-number]

Run `pnpm pr-metrics $ARGUMENTS`

If no PR number is given, infers from the current branch via `gh pr view`.

Interpret results:
- Copilot cycles = 1: normal (initial review)
- Copilot cycles = 2: one re-request after feedback (acceptable)
- Copilot cycles > 2: signal that thinking-inversion or TDD failed upstream — bugs reached review that should have been caught during implementation
