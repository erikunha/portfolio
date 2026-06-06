## Summary

<!-- What changed and why. 2-3 bullets. -->

-
-

## Type of change

- [ ] `feat` — new functionality
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `perf` — performance improvement
- [ ] `chore` / `ci` / `docs` — non-functional

## Test plan

<!-- How was this verified? Include command output or screenshots. -->

- [ ] `pnpm ci:local` passes
- [ ] New behaviour covered by tests

## Visual changes

<!-- Delete if no UI changes. -->

- [ ] Desktop (1280×720) checked via Playwright MCP
- [ ] Mobile (375×812) checked via Playwright MCP
- [ ] No visual regressions introduced

## Checklist

- [ ] No hardcoded hex values / magic numbers (token boundary)
- [ ] No `use client` added without necessity (RSC drift)
- [ ] Bundle size impact assessed (`pnpm bundle-check`)
- [ ] A11y impact considered (axe-core will gate in CI)
- [ ] ADR added to `DECISIONS.md` if this changes architecture
