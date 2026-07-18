## Summary

<!-- What changed and why. 2-3 bullets — give the reviewer the context, don't just restate the title. -->
<!-- Link issues this resolves, e.g. "Closes #123" / "Fixes #123". Omit if none. -->

-
-

## Type of change

- [ ] `feat` — new functionality
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `perf` — performance improvement
- [ ] `chore` / `ci` / `docs` — non-functional
- [ ] ⚠️ **breaking change** — describe the impact, migration, and rollback in Summary

## Test plan

<!-- Show the work. Paste the command output, link the CI run / Vercel preview, attach
     screenshots. Assertions without evidence will be questioned. -->

- [ ] `pnpm ci:local` passes
- [ ] New behaviour covered by tests
- [ ] Evidence attached where it applies (output / screenshots / before→after / benchmark)

## Visual changes

<!-- Delete if no UI changes. Attach BEFORE / AFTER screenshots or a short recording. -->

- [ ] Before / after screenshots (or recording) attached
- [ ] Desktop (1280×720) + Mobile (375×812) checked via Playwright MCP
- [ ] Visual-regression baselines regenerated (if any captured section changed)
- [ ] No visual regressions introduced

## Checklist

- [ ] No hardcoded hex values / magic numbers (token boundary)
- [ ] No `use client` added without necessity (RSC drift)
- [ ] Bundle size impact assessed (`pnpm bundle-check`)
- [ ] A11y impact considered (axe-core will gate in CI)
- [ ] If performance-affecting: bundle-size delta + Lighthouse/CWV before→after noted
- [ ] Security impact considered (no secrets, input validated, rate limits intact)
- [ ] Reversible — a rollback path exists (revert SHA, or an ADR reversibility note)
- [ ] ADR added to `DECISIONS.md` if this changes architecture
