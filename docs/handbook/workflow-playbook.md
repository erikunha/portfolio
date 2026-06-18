# Workflow Playbook

> Step-by-step runbooks for the common engineering tasks. Each is the concrete sequence a developer (or agent) follows. For the gate details referenced here, see [review-merge-release](./review-merge-release.md); for tool commands, see [`/docs/07-workflows`](../07-workflows.md).

## How to read a runbook

Every runbook lists: **entry point** (what starts it), **steps**, **AI participation**, and **output**. The same spine recurs: brainstorm -> spec/plan (for non-trivial work) -> implement (TDD) -> review battery -> gates -> PR -> merge.

---

## Creating a feature

- **Entry:** an idea or requirement.
- **Steps:**
  1. `superpowers:brainstorming` to lock intent and approach.
  2. Write a spec in `docs/superpowers/specs/` (Context, Gaps to Close, Changes). Get it to `Status: Approved`.
  3. Dispatch `architect-reviewer`; it must return `GATE_RESULT: PASS` (the architect-gate hook blocks `writing-plans` otherwise).
  4. `superpowers:writing-plans` + `thinking-inversion` to decompose into tasks (shard into sub-PRs if large).
  5. Branch `feat/<description>`. Implement test-first.
  6. Run the review battery, resolve findings, `review:stamp`, push.
  7. `pnpm ready-for-pr`, open the PR, converge Copilot, `ready-to-merge`, owner merges.
  8. Add an ADR to `DECISIONS.md` with a reversibility note.
- **AI:** brainstorming, architect review, planning, TDD implementation, the 5-agent battery.
- **Output:** a squash-merged PR `(#NNN)` + an ADR.

## Fixing a bug

- **Entry:** a reproducible defect or a failing gate.
- **Steps:**
  1. `superpowers:systematic-debugging` (before proposing any fix).
  2. State the root cause in one sentence (the four-conditions rule: root cause, pattern scan, no deferred debt, measured property verified).
  3. Write a failing test that reproduces it (TDD).
  4. Make the smallest change that passes. Pattern-scan the codebase for the same class of bug.
  5. Battery -> stamp -> push -> PR. Cite the before/after measurement in the commit body.
- **AI:** systematic-debugging, TDD, the battery.
- **Output:** a `fix(scope): ...` PR with a root-cause note.

## Architecture change

- **Entry:** a structural decision (a new abstraction, a dependency, a layer).
- **Steps:**
  1. `thinking-opportunity-cost` / `thinking-reversibility` / `thinking-second-order` as the decision warrants.
  2. Write a spec; dispatch `architect-reviewer` (mandatory gate).
  3. Plan, implement, review.
  4. **Record the ADR** in `DECISIONS.md` (date, mechanism, reversibility) - architecture changes always get an ADR.
- **AI:** the thinking skills, architect-reviewer.
- **Output:** an ADR + the implementing PR(s).

## Refactoring

- **Entry:** code that is structurally poor but behavior-correct.
- **Steps:**
  1. Confirm behavior is covered by tests first (refactor preserves behavior).
  2. `refactoring-specialist` agent if the change is large.
  3. Smallest reasonable change; never rewrite an implementation without explicit permission.
  4. Battery (the `pr-review-toolkit` reviewer checks for behavior drift) -> stamp -> push.
- **Output:** a `refactor(scope): ...` PR (no behavior change).

## Performance optimization

- **Entry:** a budget at risk (LCP/INP/CLS/TBT) or an LHCI failure.
- **Steps:**
  1. Measure first (`chrome-devtools-mcp` perf trace, or `gates:runtime` LHCI).
  2. Identify the bottleneck; form one hypothesis.
  3. Apply the smallest change; re-measure (cite before/after).
  4. `performance-engineer` agent reviews; visual baselines regenerated if rendering changed.
- **AI:** chrome-devtools MCP, performance-engineer.
- **Output:** a `perf(scope): ...` PR with before/after numbers. See [`/docs/08`](../08-performance-and-accessibility.md).

## Accessibility audit

- **Entry:** a new interactive/semantic element, or an axe failure.
- **Steps:**
  1. `accessibility-tester` agent (or `chrome-devtools-mcp` a11y debugging).
  2. Fix to WCAG 2.1 AA; the axe gate must stay at zero violations and Lighthouse a11y = 100.
  3. Add a per-component behavioral a11y test.
- **Output:** an a11y-clean PR. See [`/docs/08`](../08-performance-and-accessibility.md).

## Visual / CSS change

- **Entry:** any color, layout, typography, or spacing change.
- **Steps:**
  1. Decide baseline impact (YES/NO) before pushing.
  2. Use the Playwright MCP to inspect desktop (1280x720) and mobile (375x812) before touching tests.
  3. If baselines are affected, follow `visual-baseline-regen` (darwin regen + linux artifact path, inspect-before-commit, batch-to-one-push).
  4. No raw hex outside `theme.css` (the css-token-guard hook catches it at edit time).
- **Output:** a PR with regenerated Argos baselines if needed.

## Touching the `/api/ask` feature

- **Entry:** a change to the ask route, prompt, guards, or eval.
- **Steps:**
  1. Editing `app/api/**`/`rate-limit.ts`/`proxy.ts` records an audit marker; you must dispatch `security-auditor` before the next push (the api-security-push-guard hook blocks otherwise).
  2. If the prompt/corpus changed, run `pnpm ask:eval` (the `ai-eval-update` skill) - calibration then corpus must clear their thresholds.
  3. `vercel:vercel-functions` skill loads automatically (path-scoped rule).
- **Output:** a PR with a security-auditor pass and a green eval.

## Documentation

- **Entry:** a doc need (this handbook, a guide, an ADR).
- **Steps:**
  1. Reverse-engineer from code; do not duplicate existing canonical docs - route to them.
  2. Keep `CLAUDE.md` under 275 lines; new procedures go to a skill or a path-scoped rule, not into `CLAUDE.md`.
  3. Doc-only commits get a scoped battery (agents skip the test suite).
- **Output:** docs under `/docs`, with provenance noted.

## Writing an ADR

- **Entry:** any non-obvious or architectural decision.
- **Format (the convention):** `**YYYY-MM-DD** · **Decision title.** <mechanism: what changed and the causal why> _Reversible: <how to undo>._`
- **Rules:** cite SHAs/PR numbers; record failed approaches as "Falsified first attempt"; every entry ends in a reversibility note.
- **Output:** a dated bullet at the top of `DECISIONS.md`.

## Opening and converging a PR

- **Entry:** a stamped, ready branch.
- **Steps:**
  1. `pnpm ready-for-pr`; `gh pr create` filling the template (every section non-empty).
  2. `pnpm validate-pr-body <pr>`.
  3. Request Copilot; run the `copilot-convergence` loop (rebase before every push, verify the pushed SHA, reply-before-resolve on threads).
  4. `pnpm ready-to-merge`; the owner squash-merges.
- **Output:** a merged PR. See [review-merge-release](./review-merge-release.md).
