# Workflow Playbook

> Step-by-step runbooks for the common engineering tasks. Each is the concrete sequence a developer (or agent) follows. For the gate details referenced here, see [review-merge-release](./review-merge-release.md); for tool commands, see [`/docs/07-workflows`](../07-workflows.md).

## How to read a runbook

Every runbook lists: **entry point** (what starts it), **steps**, **AI participation**, and **output**. The same spine recurs: brainstorm -> spec/plan (for non-trivial work) -> implement (TDD) -> review (specialist self-review on the pushed head) -> gates -> PR -> merge.

---

## Creating a feature

- **Entry:** an idea or requirement.
- **Steps:**
  1. `/speckit.specify` to lock intent and approach.
  2. Write a spec in `specs/NNN-feature/` (local-only, gitignored; Context, Gaps to Close, Changes). Get it to `Status: Approved`.
  3. Run the `plan-review` skill on the spec; it must return `GATE_RESULT: PASS` (workflow convention).
  4. `speckit-plan` with a failure-mode checklist to decompose into tasks (shard into sub-PRs if large).
  5. Branch `feat/<description>`. Implement test-first.
  6. Read the diff, push, then self-review the head with specialist reviewers, and fix what verifies.
  7. `pnpm ci:local`, `pnpm bundle-check`, `pnpm route-js-check` and `pnpm gates:runtime`, open the PR, drive threads to resolved, `pnpm pr:gate`.
  8. Record the ADR in `DECISIONS.md` in the same commit as the decision (a dated bullet with a reversibility note); the owner merges.
- **AI:** brainstorming, plan review, planning, TDD implementation; the diff read before the PR is the owner's.
- **Output:** a squash-merged PR `(#NNN)` + an ADR.

## Fixing a bug

- **Entry:** a reproducible defect or a failing gate.
- **Steps:**
  1. `/speckit.bug.assess` (before proposing any fix).
  2. State the root cause in one sentence (the four-conditions rule: root cause, pattern scan, no deferred debt, measured property verified).
  3. Write a failing test that reproduces it (TDD).
  4. Make the smallest change that passes. Pattern-scan the codebase for the same class of bug.
  5. Read the diff -> push -> PR -> specialist self-review of the head. Cite the before/after measurement in the commit body.
- **AI:** systematic-debugging, TDD.
- **Output:** a `fix(scope): ...` PR with a root-cause note.

## Architecture change

- **Entry:** a structural decision (a new abstraction, a dependency, a layer).
- **Steps:**
  1. Weigh opportunity cost, reversibility and second-order effects as the decision warrants.
  2. Write a spec; run the `plan-review` skill (required workflow convention).
  3. Plan, implement, review.
  4. **Record the ADR** in `DECISIONS.md` (date, mechanism, reversibility) - architecture changes always get an ADR.
- **AI:** the `plan-review` skill.
- **Output:** an ADR + the implementing PR(s).

## Refactoring

- **Entry:** code that is structurally poor but behavior-correct.
- **Steps:**
  1. Confirm behavior is covered by tests first (refactor preserves behavior).
  2. `refactoring-specialist` agent if the change is large.
  3. Smallest reasonable change; never rewrite an implementation without explicit permission.
  4. Read the diff for behavior drift -> push -> specialist self-review of the head.
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
  1. Decide baseline impact (YES/NO) before pushing.
  2. Use the Playwright MCP to inspect desktop (1280x720) and mobile (375x812) before touching tests.
  3. If baselines are affected, follow `visual-baseline-regen` (darwin regen + linux artifact path, inspect-before-commit, batch-to-one-push).
  4. No raw hex in the `app/css` stylesheets outside `theme.css` (held by `pnpm lint:css-tokens` in `verify` and CI; the style rule is repo-wide, the gate scans only the immediate `app/css` files).
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
  2. Rebase before every push, verify the pushed SHA, reply citing the fix SHA before resolving a thread. claude-review runs only when an owner, member or collaborator comments `/claude-review`; fix its findings in one commit, reply, resolve.
  3. CI is green and `pnpm pr:gate` passes (every thread resolved with a reply); the owner squash-merges.
- **Output:** a merged PR. See [review-merge-release](./review-merge-release.md).
