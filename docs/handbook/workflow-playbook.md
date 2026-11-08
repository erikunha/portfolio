# Workflow Playbook

> Step-by-step runbooks for the common engineering tasks. Each is the concrete sequence a developer (or agent) follows. For the gate details referenced here, see [review-merge-release](./review-merge-release.md); for tool commands, see [`/docs/07-workflows`](../07-workflows.md).

## How to read a runbook

Every runbook lists: **entry point** (what starts it), **steps**, **AI participation**, and **output**. The same spine recurs: spec/plan (for non-trivial work) -> implement (TDD) -> gates -> PR -> review -> merge.

---

## Creating a feature

- **Entry:** an idea or requirement.
- **Steps:**
  1. Write down the intent, requirements and acceptance criteria. Specs stay local and untracked; the tool that writes them is the engineer's choice.
  2. Check the spec against the repository's hard limits (the `plan-review` skill holds the four gates and returns `GATE_RESULT: PASS` or `BLOCK`).
  3. Decompose into tasks with a failure-mode checklist (shard into sub-PRs if large).
  4. Branch `feat/<description>`. Implement test-first.
  5. Read the diff and push.
  6. `pnpm ci:local`, `pnpm bundle-check`, `pnpm route-js-check` and `pnpm gates:runtime`, open the PR, resolve threads, `pnpm pr:gate`.
  7. Record the ADR in `DECISIONS.md` in the same commit as the decision (a dated bullet with a reversibility note).
- **AI:** optional at every step; the `plan-review` skill encodes the limits check.
- **Output:** a squash-merged PR `(#NNN)` + an ADR.

## Fixing a bug

- **Entry:** a reproducible defect or a failing gate.
- **Steps:**
  1. Reproduce the defect before proposing any fix.
  2. State the root cause in one sentence (the four-conditions rule: root cause, pattern scan, no deferred debt, measured property verified).
  3. Write a failing test that reproduces it (TDD).
  4. Make the smallest change that passes. Pattern-scan the codebase for the same class of bug.
  5. Read the diff -> push -> PR. Cite the before/after measurement in the commit body.
- **AI:** optional.
- **Output:** a `fix(scope): ...` PR with a root-cause note.

## Architecture change

- **Entry:** a structural decision (a new abstraction, a dependency, a layer).
- **Steps:**
  1. Weigh opportunity cost, reversibility and second-order effects as the decision warrants.
  2. Write a spec and check it against the hard limits (the `plan-review` skill).
  3. Plan, implement, review.
  4. **Record the ADR** in `DECISIONS.md` (date, mechanism, reversibility) - architecture changes always get an ADR.
- **AI:** the `plan-review` skill.
- **Output:** an ADR + the implementing PR(s).

## Refactoring

- **Entry:** code that is structurally poor but behavior-correct.
- **Steps:**
  1. Confirm behavior is covered by tests first (refactor preserves behavior).
  2. Smallest reasonable change; never rewrite an implementation without explicit permission.
  3. Read the diff for behavior drift -> push.
- **Output:** a `refactor(scope): ...` PR (no behavior change).

## Performance optimization

- **Entry:** a budget at risk (LCP/INP/CLS/TBT) or an LHCI failure.
- **Steps:**
  1. Measure first (a browser performance trace, or `gates:runtime` LHCI).
  2. Identify the bottleneck; form one hypothesis.
  3. Apply the smallest change; re-measure (cite before/after).
  4. The `perf-budget` skill applies when a perf gate actually regressed; visual baselines regenerated if rendering changed.
- **AI:** the `perf-budget` skill (conditional, not a standing review role).
- **Output:** a `perf(scope): ...` PR with before/after numbers. See [`/docs/08`](../08-performance-and-accessibility.md).

## Accessibility audit

- **Entry:** a new interactive/semantic element, or an axe failure.
- **Steps:**
  1. a browser accessibility audit, or check the axe-core gate (`tests/a11y/axe.spec.ts`).
  2. Fix to WCAG 2.2 AA; the axe gate must stay at zero violations and Lighthouse a11y = 100.
  3. Add a per-component behavioral a11y test.
- **Output:** an a11y-clean PR. See [`/docs/08`](../08-performance-and-accessibility.md).

## Visual / CSS change

- **Entry:** any color, layout, typography, or spacing change.
- **Steps:**
  1. Look at desktop (1280x720) and mobile (375x812) in a real browser before touching tests.
  2. If baselines are affected, regenerate them in the same PR; the `visual-baseline-regen` skill holds the procedure (darwin regen, linux artifact path, inspect before commit).
  3. No raw hex, `rgb()` or `hsl()` in the `app/css` stylesheets or `*-tokens.ts` files outside `theme.css` (held by `pnpm lint:css-tokens` in `verify` and CI against `scripts/lint-css-tokens.allowlist.json`, whose entries each name a file, a literal, a count and a reason; the style rule is repo-wide, the gate scans only those files).
- **Output:** a PR with regenerated Playwright baselines if needed.

## Touching the `/api/ask` feature

- **Entry:** a change to the ask route, prompt, guards, or eval.
- **Steps:**
  1. Editing `app/api/**`/`rate-limit.ts`/`proxy.ts` means re-reading the diff for the abuse paths each closes. No project hook checks this.
  2. If the prompt/corpus changed, run `pnpm ask:eval` (the `ai-eval-update` skill) - calibration then corpus must clear their thresholds.
  3. Read `.claude/rules/api-boundary.md` for the matching API/server paths. It is guidance; `AGENTS.md` holds the rules.
- **Output:** a PR with green API behavioural tests and a green eval.

## Documentation

- **Entry:** a doc need (this handbook, a guide, an ADR).
- **Steps:**
  1. Reverse-engineer from code; do not duplicate existing canonical docs - route to them.
  2. Keep `AGENTS.md` under its line budget; new procedures go to a skill or a path-scoped rule, not into `AGENTS.md`.
  3. Docs-only changes run `pnpm ci:local`; the project workflow skips bundle, route-JS and runtime gates. MDX in `app/` still belongs to the CI app filter.
- **Output:** docs under `/docs`, with claims checked against current source.

## Writing an ADR

- **Entry:** any non-obvious or architectural decision.
- **Format (the convention):** `**YYYY-MM-DD** · **Decision title.** <mechanism: what changed and the causal why> _Reversible: <how to undo>._`
- **Rules:** cite SHAs/PR numbers; record failed approaches as "Falsified first attempt"; every entry ends in a reversibility note.
- **Output:** a dated bullet at the top of `DECISIONS.md`.

## Opening and converging a PR

- **Entry:** a ready branch.
- **Steps:**
  1. `pnpm ci:local`, `pnpm bundle-check`, `pnpm route-js-check` and `pnpm gates:runtime`; `gh pr create` filling the template (every section non-empty).
  2. Reply in each review thread before resolving it. claude-review runs only when an owner, member or collaborator comments `/claude-review`.
  3. CI is green and `pnpm pr:gate` passes (every thread resolved with a reply); squash-merge.
- **Output:** a merged PR. See [review-merge-release](./review-merge-release.md).
