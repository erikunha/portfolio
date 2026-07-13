# CLAUDE.md

> Auto-loaded by Claude Code every session in this repo. Keep it tight — verbosity costs token budget on every invocation.

## Project

**erikunha.dev** — personal portfolio and reference web system. Matrix/brutalist terminal aesthetic. Single-page composition with ~18 sections.

## Commands

**Development + CI gates** — automated; also runnable locally to match CI:

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E — observability smoke, a11y scan, contact + ask user-journey tests, visual regression |
| `pnpm check` | Biome lint + format check |
| `pnpm check:fix` | Biome auto-fix |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lhci` | Lighthouse CI locally |
| `pnpm validate-content` | Zod content schema validation |
| `pnpm ci:local` | Full local CI chain (lint + type + content + client-naming + harness-size + tests) |
| `pnpm bundle-check` | Bundle size gate |
| `pnpm gates:runtime` | Server-dependent gates: build + server + LHCI desktop + LHCI mobile + axe-core + E2E functional |
| `pnpm gates:runtime --skip-build` | Same as above but reuses existing `.next/` (must exist) |

**AI agent workflow** — the AI runs these consciously as part of its process; not automated:

| Command | When the AI runs it |
|---|---|
| `pnpm review:stamp` | After ALL 5 review agents are dispatched AND the findings ledger is resolved. `scripts/review-stamp.ts` **refuses to write** `.review-passed` unless (a) the transcript shows all five battery agents dispatched since the last commit AND (b) `.review-findings.json` has no `open` Critical/Important finding (each `resolved` with a SHA or `justified` with a reason). Pre-push hook blocks until the stamp matches HEAD. Now proves dispatch AND resolution |
| `pnpm review:findings` | Verification-loop ledger CLI (`add`/`resolve`/`justify`/`check`/`list`/`clear`). `battery-synthesis` records each Critical/Important finding; `check` and `review:stamp` refuse while any is `open`. See `.claude/skills/battery-synthesis` |
| `pnpm pr-size [--base <ref>]` | After every commit block and before opening a PR — decides whether to split. Sizes vs the base branch; for a sub-PR into an integration branch set `PR_BASE=origin/feat/<feature>` (or `--base`) so it reads as its own small diff |
| `pnpm ready-for-pr` | Before `gh pr create` — runs ci:local + pr-size + gates:runtime, prints next-step checklist |
| `pnpm validate-pr-body [<pr>]` | After `gh pr create` — exits 1 if any template section is missing or empty; must pass before requesting review |
| `pnpm ready-to-merge [<pr>]` | Before the repo owner runs `gh pr merge` — runs ci:local + branch-protection + claude-review approval + resolved threads + pr-metrics |
| `pnpm pr-metrics [<pr>]` | During or after PR review — reports review-cycle count, size, days open |
| `pnpm changelog:sync` | After any commit with scope `(design-system)` — regenerates `app/design-system/changelog/page.mdx` from full git history |
| `pnpm ask:eval` | When maintaining the AI eval harness (corpus/calibration/runner changes) — calibration → corpus → gate, always writes `ask-eval-result.json`; writes `ask:eval:latest` to Upstash Redis only when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set. See `.claude/skills/ai-eval-update` |
| `pnpm eval:agents` | When maintaining the agent/prompt eval harness (`evals/agents/`, `scripts/agent-eval.ts`). Monte-Carlo prompt-regression over the PLATFORM's own rules (distinct from `ask:eval`, which evals the `/api/ask` PRODUCT): calibration → corpus N runs → pass@k / pass^k / variance; `--ab` adds a control-vs-treatment delta. Writes `agent-eval-result.json`; publishes `agent-eval:latest` only when Upstash env is set. Non-blocking CI (weekly `schedule` + `workflow_dispatch`). |

## Engineering context

This codebase is a **reference system** — every architectural decision, perf budget, a11y guarantee, design token, CI gate, and lint rule must hold up as something another team could adopt verbatim. Architecture is the artifact. Scope decisions follow these rules:

- Cross-cutting concerns over local optimization
- Mechanism-level reasoning (cause → effect) — explain the why, not just the what
- Surface trade-offs explicitly; give one recommendation per decision
- Perf, a11y (WCAG 2.1 AA), and security are implicit on every change — not separate phases
- "It's only one consumer" is not a valid YAGNI argument — architecture scales with adoption
- Don't frame scope apologetically; state directly why the shape fits a reference system

## Project agent dispatch

**Hard gates** — these block the next step if skipped:

| Gate | Trigger | Agent |
|---|---|---|
| Before opening any PR | After all milestone commits, before `gh pr create` | `pr-review-toolkit:review-pr` — address all Critical/Important before opening (convention: opening the PR is not mechanically blocked) |
| Before writing plans | Before invoking `superpowers:writing-plans` on any spec | `architect-reviewer` — `.claude/hooks/architect-gate.sh` (PreToolUse `Skill`) is WIRED to block `superpowers:writing-plans` unless the transcript shows an `architect-reviewer` `GATE_RESULT: PASS` (in a tool_result) this session. **Confirmed enforced (2026-06-06):** Skill matcher fired exit-2 and blocked `superpowers:writing-plans` in a live session without a prior `GATE_RESULT: PASS`. Boundary: session-scoped PASS, not per-spec identity |
| After API changes | After editing `app/api/`, `lib/rate-limit.ts`, or `proxy.ts` | `security-auditor` — **enforced** by `.claude/hooks/api-edit-marker.sh` (PostToolUse records the edit) + `.claude/hooks/api-security-push-guard.sh` (PreToolUse blocks the next `git push` until a `security-auditor` dispatch follows the marker). Boundary: dispatch-scoped, blocks push not the edit |

**Spot-check agents** — invoke when the concern is the primary risk in the current change:

| Concern | Trigger | Agent |
|---|---|---|
| Visual correctness | After CSS, layout, or responsive changes | `ui-ux-tester` |
| Accessibility | After adding/editing interactive or semantic elements | `accessibility-tester` |
| Performance | After changes that could affect LCP/INP/CLS | `performance-engineer` |
| Bundle growth | After adding a new dependency | `dependency-manager` |
| Next.js patterns | After implementing new API routes, server actions, or app router layouts | `nextjs-developer` |

## Skill dispatch

Invoke the named skill inline (not as a subagent) before the described action. Project triggers below override global CLAUDE.md when both apply to the same action.

| Trigger | Skill |
|---|---|
| **Before writing any new file, API handler, or complex logic block** | **`thinking-inversion` — what specifically makes this fail? answers become test cases** |
| **Before `superpowers:writing-plans` on any spec** | **`thinking-inversion` — enumerate the class-of-bugs the implementation introduces; each becomes an explicit plan task, not a claude-review finding** |
| **Before implementing any new file, function, or script** | **`superpowers:test-driven-development` — tests first, always; implementation satisfies them** |
| Before implementing any component (in `components/` or `design-system/`) | Run DS component pre-mortem: (1) which attrs does the consumer control? (`id`, `className`, `aria-*`) — passthrough, never override; (2) any `outline: none` on `:focus` must be `:focus-visible`; (3) `querySelector` returns `null` not `undefined` — use `.not.toBeNull()`; (4) can this component be rendered twice? hardcoded `id` breaks the second instance |
| After creating a new component or adding significant client-side state/effects | `react-best-practices` |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |
| After `superpowers:writing-plans` produces output for tasks with >5 steps | `thinking-pre-mortem` — run on the plan tasks themselves, not the feature |
| After dispatching the full 5-agent battery, before `pnpm review:stamp` | `battery-synthesis` |

## Stack (locked)

- Next.js 16 App Router · React 19 · TypeScript strict · Biome · pnpm
- **CSS:** Tailwind v4 (`@tailwindcss/postcss`, theme in `app/css/theme.css`). Design tokens live in `app/css/theme.css` as CSS custom properties — no Style Dictionary pipeline, no CSS modules. PostCSS pipeline added back for Tailwind v4 via `@tailwindcss/postcss` — no other PostCSS plugins. See `DECISIONS.md` for the Tailwind v4 migration ADR (2026-05-31).
- Vercel Edge end-to-end deployment
- Upstash Redis for rate-limit + KV log
- Vercel AI Gateway via the AI SDK v7 (`ai` package, `streamText`) with the model string `anthropic/claude-haiku-4-5` for `/api/ask`; ephemeral prompt cache preserved via `providerOptions.anthropic.cacheControl` on a system message (`allowSystemInMessages: true`); cache-token breakdown read from `usage.inputTokenDetails`. Needs `AI_GATEWAY_API_KEY` (OIDC token on Vercel). Migrated to the Gateway 2026-05-21; upgraded v6→v7 2026-07-02 — see DECISIONS.md.
- Resend for contact form delivery
- Playwright E2E: observability smoke (`tests/e2e/observability-smoke.spec.ts`), a11y scan (`tests/a11y/axe.spec.ts`), contact + ask user-journey tests, visual regression snapshots; 5-project matrix (chromium, chromium-mobile, webkit-desktop, webkit-mobile, chromium-components)
- Vitest unit tests
- axe-core a11y CI gate
- Lighthouse CI gates

See `ARCHITECTURE.md` for the full system design, `DECISIONS.md` for the running ADR log.

## Performance budgets (non-negotiable)

| Metric | Desktop | Mobile |
|---|---|---|
| LCP | < 1.8s | < 3.5s |
| INP | < 200ms | < 200ms |
| CLS | < 0.05 | < 0.05 |
| TBT | < 200ms | < 400ms |
| JS gzipped per route | < 120KB | < 120KB |
| Client JS total (all islands combined) | < 43KB | < 43KB |
| Lighthouse Performance | ≥ 95 | ≥ 90 |
| Lighthouse Accessibility | = 100 | = 100 |
| Lighthouse Best Practices | ≥ 95 | ≥ 95 |
| Lighthouse SEO | = 100 | = 100 |

CI enforces all of the above. **Never disable the gates to merge.** If a gate fails, fix the underlying issue.

## Engineering standards

Full rationale in `STANDARDS.md`. Load that file when a chapter is directly relevant. One-line enforcement per chapter:

| Chapter | Mechanical gate / enforcement |
|---|---|
| 1 — RSC/Architecture | `check-client-naming.mjs` — `*.client.tsx` naming + no `async function` export; streaming-through-React held by behavioral test |
| 2 — API boundary | `defineHandler` enforces envelope + rate-limit→parse→validate→handle; held by behavioral tests + e2e |
| 3 — Performance | Lighthouse CI (perf ≥95, a11y =100, BP ≥95, SEO =100); `check-bundle-size.mjs` gates gzipped chunks |
| 4 — Testing | `no-source-grep.test.ts` bans `readFileSync` without allow tag; behavioral assertions only |
| 5 — Dependencies | `check-dep-pinning.mjs` rejects `latest`/`*`; `--frozen-lockfile` in CI |
| 6 — Content | `validate-content.ts` Zod schemas at build time; no copy inlined in `.tsx` |
| 7 — CSS/tokens | `lint:contrast`; `@theme` tokens in `app/css/theme.css`, no raw hex; complex patterns as named classes in `@layer components` (`app/css/components.css`), no CSS modules |
| 8 — A11y | axe-core gate + Lighthouse =100; per-component behavioral a11y tests |
| 9 — Security | Behavioral tests for CSP + kill switches (not source-grep); `security-auditor` on any `app/api/` change |
| 10 — Docs | PR review: doc claims must match live code; ADRs cite SHA + reversibility note |
| 11 — DX | pre-commit = Biome (<1s) + `gitleaks --staged` (~0.4s, fails closed if the binary is missing — `brew install gitleaks`) + commitlint (scope required, error on missing); pre-push = full verify + branch-name `<type>/<description>` enforced; never disable a gate to merge |
| 12 — Design system | `lint:contrast` + component-docs CI gates |

**Hook authoring:** `.claude/hooks/*` PreToolUse guards that must BLOCK a tool call exit with code **2** (exit 1 is a non-blocking warning — the command still runs). `bash-guard.sh` blocks (broad `git add`, npm/yarn, `gh pr merge`, force-push, fallow non-read-only) use `exit 2`; verify a guard blocks with a live test, not its printed `[BLOCKED]` message.

**Rule hygiene (this file loads every session — fight monotonic growth):**
- **Slot the rule cheaply.** Before adding any behavioral rule, pick the cheapest slot that still fires when needed: mechanical gate > on-demand skill > contextual memory > **prose here**. Prose is the most expensive slot (it taxes every session regardless of relevance) and the last resort — reserve it for behavior that must be salient on every turn. If a skill already fires in the rule's context, do not also write the prose.
- **Tag gates with evidence.** A gate should record when it last fired and what it caught (see the architect-gate "Confirmed enforced" note above). A gate that has neither fired nor false-fired in ~90 days is unproven — audit whether it still earns its place.
- **False-positive budget.** A gate that produces routine `--no-verify`/override bypasses is miscalibrated, not strict: each false positive trains bypass and erodes the guard's authority for the case that matters. Narrow the predicate to what it actually protects (precedent: the 2026-06-17 `.husky/pre-push` fix keyed on "a ref targets main", not "standing on main").
- **Rules are removed, not only added.** When a prose rule becomes covered by a skill or gate, delete the prose. Pruning is a normal edit, not an exception requiring permission.

## Package + manager policy

- **pnpm only.** `packageManager: pnpm@latest`. Don't use npm or yarn.
- Every dep installed `@latest` at scaffold; `pnpm up --latest` for bumps.
- `zod` is exact-pinned (`-E`) — its minor bumps break inference. Upgrade deliberately.
- **Never `--latest` `typescript`** — held at 6.x because Stryker needs the TS JS API that TS7 removed (`--latest` rewrites an exact pin too, so pinning won't save you). Held by `__tests__/stryker-typescript-api.test.ts`. See DECISIONS.md 2026-07-12.
- Caret semver in `package.json`; lockfile (`pnpm-lock.yaml`) is the source of truth.
- CI runs `pnpm install --frozen-lockfile`.
- Node 22+, pnpm 10+.

## Rendering model

- **Default: React Server Components, SSG at build time.** Zero JS shipped for static sections.
- **Client islands by exception:** Matrix dialog loop, INTERACTIVE_SHELL, contact form, IntersectionObserver typewriter, MOTION indicator.
- All client files named `*.client.tsx`. RSC drift must be visible in PR review.
- **The Matrix dialog loop MUST use `useRef.textContent` mutation, NOT per-keystroke `useState`.** Per-state re-renders tank INP. The interactive shell's streaming answer, by contrast, renders *through* React (rAF-coalesced state) — see `STANDARDS.md` Chapter 1; enforced by `components/client/InteractiveShell/InteractiveShell.test.tsx`.

## Aesthetic constraints

- Pure black background (`#000000`), lime signal-green (`#00FF41`) for accents.
- Two-token palette: `--signal` for headings/accents/large text; `--fg` (#E6FFE6, ~13:1 contrast) for body. Never use `--signal` for paragraph text — it fails WCAG AA.
- JetBrains Mono everywhere (self-hosted via `next/font/local`, not Google CDN).
- The "THE MATRIX HAS YOU." headline is a heavy geometric sans (Geist Black or similar). All other text is mono.
- CRT effects (scanlines + RGB sub-pixel mask + grain + scan beam + flicker + phosphor text-shadow) at dialed-back opacity. All disabled under `prefers-reduced-motion: reduce`.
- 1px borders only, sharp corners (no rounded radius > 2px).

## Content discipline

- All content lives in `content/*.ts` as typed TS modules validated by Zod at build time. Build fails on schema violation.
- HOTTEST_TAKES, `~/.guitar_rig`, `~/.now`, `~/.unknowns`, `~/.community`, `~/.visa`, `~/.credentials` — all driven from content files.
- Never inline content in JSX. If you find yourself typing user-facing copy into a `.tsx`, stop and move it to `content/`.

## Working agreement

- Lead with the recommendation. For decisions: 2-3 options, trade-offs, failure modes, one discriminator, recommend one.
- Show diffs and targeted snippets over full rewrites unless the change is pervasive.
- No magic values (owner decision, 2026-07-11): never inline unexplained literals in source — extract them into named `const`s, enums, union types, or interfaces so the name carries the meaning. Applies to strings, numbers, and repeated shape discriminators alike. **Exception: test files** — inline literals and repetition are fine in tests for readability (owner refinement, 2026-07-11).
- **Redundant commentary out; decisions in (owner rule, 2026-07-12). This governs every word generated — source comments, ADR bullets, docs, PR bodies.** One discriminator: **does a gate already state this?** (a gate = the compiler, a type, a test, a lint rule, a CI check.)
  - **Yes → it is redundant. Delete it.** Prose that restates a gate is a second copy of the truth, and it is the copy that drifts. Never narrate what the code does, where it came from, or why the next line is correct.
  - **No → it is a decision. Capture it once, in the cheapest durable slot.** A decision is what no gate can hold: a trade-off, a rejected alternative, a non-obvious cause, an external constraint. Slots: a `biome-ignore <rule>: <why the rule is wrong HERE>` reason · `DECISIONS.md` for architecture · the commit body for the causal chain · a **test's failure message** for the trap that test guards.
  - **Source stays bare** (owner decision, 2026-07-10): the only comments are machine directives — `biome-ignore`, `behavioral-test-allow`, `@ts-*`, shebangs, triple-slash. A directive's reason *is* a decision comment: it must say why the rule is wrong **here**, never what the code does.
  - **A doc that restates a gate is worse than no doc** — it rots, and a rotted doc actively instructs the next engineer to undo the fix. Precedent (2026-07-12, PR #190): the disclosure ADR duplicated what six tests already enforced, and was factually **wrong six times in a single PR**; it was cut to point at the gates instead of restating them. (This bullet first cited two word counts for that cut. Both were wrong, and one went stale one commit later *inside the same branch* — deleted, because a number no gate holds is the exact thing this rule says not to write.)
  - **Delegating a claim to a gate is only honest if the gate holds it.** Before writing "held by X", break the property and watch X fail. Otherwise the rule just swaps a wrong claim for an unverified promise — and check the claim's *scope*, not only its existence: a gate that bans the tokens `<details>`/`<summary>` does not ban a `useState` + `<button>` re-implementation, so "nothing can collapse" is prose the gate never backed.
- Don't ask clarifying questions unless missing info would change the decision — assume reasonably, state in one line, proceed.
- Flag flaws once. Don't repeat concerns.
- Skip disclaimers, boilerplate, "consult a professional" lines.
- Assume deep TypeScript, React, and Next.js expertise — skip syntax explanations and 101 content.
- Track decisions in `DECISIONS.md`: one bullet, date, reversibility note. Update as we go.
- **Process feedback mid-workflow is a hard stop.** Pause immediately, incorporate into CLAUDE.md and/or memory, confirm with the user, then resume.
- **Commit in scope blocks; merge by milestone.** Work accumulates in commits grouped by concern — one logical unit per commit (a component, a fix, a config change). After each block, run `pnpm pr-size`. When `pr-size` hits yellow AND the block is a natural milestone, open a PR. Do not accumulate past red. If mid-milestone the branch hits red, split at the last clean commit boundary and open what's done.
- **Large multi-part feature? Integration branch + sub-PRs.** When a feature is too big for one reasonable PR (the failure mode that bloated PR #81), branch an integration branch off main (`feat/<feature>`), then open small sub-PRs from `feat/<feature>-<part>` branches **into the integration branch** — each a reviewable milestone. Size sub-PRs against the integration branch, not main: `PR_BASE=origin/feat/<feature> pnpm pr-size` (`pr-size` resolves `--base` > `PR_BASE` > `origin/$GITHUB_BASE_REF` > `origin/main`; CI auto-uses the PR's base via `GITHUB_BASE_REF`). When the feature is complete, open the `feat/<feature>` → main PR; it will be large by design (pr-size red is expected) — note in the body that it was reviewed incrementally via the sub-PRs, which satisfies the "known issues require justification" rule. For a standalone change, skip the integration branch and open a normal small PR straight to main per the milestone rule above.
- **Run the full 5-agent review battery at two triggers, mechanically enforced.** Trigger A: before any `git push`. Trigger B: whenever coding work stops (task done, branch finishing, session ending on a feature), no user prompt needed. Both run the same process. (1) Check what changed (`git diff`, `git status`). (2) Dispatch ALL 5 agents in parallel (`pr-review-toolkit:review-pr`, `accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`), scoped to the actual change: the stamp counts DISPATCH not DEPTH, so running 810 tests for a docs-only commit wastes 10+ minutes. Prompt scoping by commit type: **docs-only** (*.md, DECISIONS.md) tell agents "read `git diff HEAD~1..HEAD` to confirm docs-only, verify accuracy, do NOT run test suite or build"; **config-only** (LHCI, CI yml, biome.json) "verify logic of changed config only, no test suite"; **deps-only** (package.json, pnpm-lock.yaml) security-auditor runs `pnpm audit --audit-level=high`, dependency-manager `--audit-level=moderate` only, all told "do NOT run `pnpm test`/`build`/`ci:local`, do NOT make additional commits"; **code commits** (app/, lib/, components/) may run targeted tests for the changed area only. Always include "Do NOT make any additional commits, this is a verification-only run." (3) Run `pnpm review:stamp` immediately after dispatch, without blocking on agent completion. (4) Fix findings: any arriving before your push, fix first; at PR-open and when declaring done, fix ALL Critical/Important regardless of timing; findings arriving after a push go to the next review convergence loop iteration. Never skip because you are confident. **Enforced:** `scripts/review-stamp.ts` refuses to write `.review-passed` unless the transcript shows all five `subagent_type` dispatches after the HEAD commit's timestamp (fail-closed: an unresolvable transcript also refuses; override with `REVIEW_STAMP_TRANSCRIPT=<abs path>`). The boundary is the git commit time, not a transcript marker, so a commit made outside the session (terminal/GUI) cannot be stamped by a stale prior-cycle review. The stamp also refuses while any Critical/Important finding in `.review-findings.json` is `open` (record via `battery-synthesis` / `pnpm review:findings`); the residual honor-system boundary is RECORDING findings honestly, since the stamp cannot know about a finding you never recorded. `.husky/pre-push` blocks unless the stamp matches HEAD; a new commit after stamping forces a re-stamp. Skipping an agent simply fails the stamp (all five roles required); the *justification* for a skip is honor-system. Applies to all feature branches; direct pushes to main are blocked by the pre-push hook, so all changes go through a PR.
- **Runtime gates before opening a PR — manual, not enforced by pre-push.**
  Run `pnpm ready-for-pr` (which includes `gates:runtime`) for non-docs changes.
  CI remains the authoritative gate. The pre-push hook no longer runs `gates:runtime`
  automatically — the 12-20 min cost per push was imposing 10+ hrs/week of foreground
  blocking time on a solo developer who watches CI regardless.
- **Review convergence loop** — converging an open PR's claude-review (`/claude-review`, claude[bot]) to green lives in `.claude/skills/review-convergence` (rebase-before-every-push, push-SHA verification, reply-before-resolve, the automatic post-merge transition). Invoke it whenever working an open PR toward merge; `pr-merge-gate` covers the final merge.
- **Every PR comment goes in a review THREAD — never a timeline comment (owner rule, 2026-07-12).** `gh pr comment <N>` posts an unanchored `#issuecomment-…`: attached to no code, not resolvable, absent from `reviewThreads`, therefore invisible to the resolve-thread merge gate. Reply in the existing thread (`.../pulls/<N>/comments/<id>/replies`); if a finding has no thread — e.g. one your own review battery raised — **create** one on the file+line (`.../pulls/<N>/comments` with `commit_id`+`path`+`line`), do not fall back to a timeline comment. A self-raised finding that never became a thread is an unrecorded finding. The sole exception is the `/claude-review` re-request, which is a command, not a comment.
- **Auto-review before opening any PR.** Run `pnpm ready-for-pr` (ci:local + pr-size + gates:runtime). Then invoke `pr-review-toolkit:review-pr` against the diff. Address all Critical and Important findings before `gh pr create`. `pnpm ready-for-pr` is required even when the pre-push review has already run — it additionally covers `bundle-check`, `pr-size`, and runtime gates. Use `--skip-runtime` only for docs-only PRs. Opening with known issues requires written justification in the PR body.
- **No PR until baselines + tests + perf have actually run — never defer gates pending a design/"shade" decision.** Lock the decision, run every gate, then open; if it is not locked, hold the PR — do not open a half-gated one. A visual-affecting change (color, layout, typography, spacing) requires regenerated visual-regression baselines as a mandatory pre-PR step.
- **Decide visual-baseline impact BEFORE every push** — state YES/NO whether the change touches `tests/visual/visual.spec.ts` (CI-gated page sections; darwin + linux regen required) or `tests/e2e/design-system-components.spec.ts` (darwin-only; CI ignores on Ubuntu) baselines. If NO, push once. If YES, invoke `.claude/skills/visual-baseline-regen` for the full procedure (darwin regen, linux artifact dispatch, inspect-before-commit, batch-to-one-push rule).
- **Fill the PR template when creating PRs — hard gate.** Before writing a PR body: `cat .github/pull_request_template.md`, then fill EVERY section (Summary, Type of change, Test plan, Visual changes, Checklist). Never write a custom body from scratch — always start from the template structure. After `gh pr create`, run `pnpm validate-pr-body <pr>` immediately; it exits 1 if any section is missing or empty. Do not proceed to reviewer request until it passes.
- **Playwright MCP visual check before writing or changing tests.** After implementing any section or component (or after changes that affect rendering), run `pnpm dev` and use the Playwright MCP tool to visually inspect desktop (1280×720) + mobile (375×812) BEFORE touching test files. Tests must assert observable, verified behavior — not assumed behavior. If the visual check reveals something unexpected, fix it first. Only then write or update tests. This also applies before the pre-merge Playwright check (see `.claude/skills/pr-merge-gate`).
- **The review should be boring.** If `pr-review-toolkit:review-pr` or claude-review finds real bugs, the pre-implementation discipline failed. `thinking-inversion` before writing and TDD during implementation are the actual defences — not the review. Multi-round review cycles mean the writing process needs fixing.
- **Every plan must include a failure-mode checklist.** Run `thinking-inversion` before `superpowers:writing-plans` on any task. Each bug class becomes an explicit plan task — not a claude-review finding after the fact.
- **When dispatching implementer subagents, always include in the prompt:** "Use `git add -u` or `git add <specific files>` — never `git add .`, `git add -A`, or `git add --all`. Stage only the files you created or modified in this task."
- **File-move AND extraction tasks must include a full consumer-scan step — code AND config.** This fires for any `git mv` and for any *extraction* (relocating code or a symbol into a new module/path, even with no `git mv` — e.g. hoisting `judge()` out of `scripts/ask-eval.ts` into `lib/eval/`). Before writing plan tasks, grep for every reference to the old path or symbol across two surfaces: (1) **code callers** — `grep -r 'OldPath' --include='*.ts' --include='*.tsx'`; (2) **the gate/CI/config surface that hard-codes paths** — `.github/workflows/**` (detect-changes path-filters especially), `.husky/**`, `scripts/**`, and any allowlist/pathspec/glob. Include a path-update task for every match including test files. A CI path-filter or gate left pointing at the old location **fails open silently**: the gate evaluates to "unchanged", skips, and a regression ships unguarded — this is the exact class that leaked the `lib/eval/` ai-filter gap (a judge change set `ai=false` and skipped the calibration gate). Stale path comments (`// components/OldPath.tsx`) in moved files are a separate required fix step.
- **Verification before any completion claim.** Before reporting done, fixing, or passing: run `pnpm typecheck && pnpm test --run && pnpm build`, read the output, cite the result. "Should pass" is not evidence. Invoke `superpowers:verification-before-completion` if rationalizing.
- **Re-run review after fixing findings.** After fixing any Critical or Important finding from a review agent, re-dispatch that same agent against the affected files before declaring the fix done. One-line fixes can skip this; any logic change cannot.
- **Quality gates measure real properties — fix the property, not the gate.** When a gate fails (Lighthouse audit, Biome lint, bundle-size, a11y, security), the only acceptable response is to reduce the measured property or correct a genuinely misconfigured assertion. Unacceptable: set the audit to `"off"`, lower the threshold, add the rule to an ignore list, or wrap code to hide it from the checker. If a gate cannot be fixed in the current scope, escalate with root cause + options + minimum required change — do not merge with known suppression. Acceptable gate-config changes: fixing an assertion that fires on the ideal state (e.g., `maxNumericValue` on an audit that returns `null` when there are zero violations — the assertion was never testing what it claimed).
- **Every fix must satisfy four conditions before it is done.** (1) **Root cause stated** — before writing code, identify the causal chain in one sentence: what property fails, what code produces it, and why. If you cannot state it, the investigation is incomplete. (2) **Pattern scan complete** — search for the same pattern across the codebase; fix all instances or document why each remaining case is acceptable. (3) **No deferred debt** — the fix must not defer the problem or create a workaround that breaks under normal evolution. If an inherent limitation exists (build-tool behavior, browser quirk, external dep), document it in DECISIONS.md (no code comments — bare code policy). (4) **Measured property verified** — after fixing, confirm the actual metric changed (not just that CI is green). Cite the before/after measurement in the commit message body.

## Out of scope (unless asked)

i18n · light theme · blog/MDX engine · analytics beyond Vercel Web Analytics + Speed Insights · auth/accounts/comments · CMS

## Emergency Rollback

Fast (30s): `vercel ls` → `vercel promote <url>` — no code change.
Slow (5m): `git revert HEAD && git push --no-verify`. (main push guard requires --no-verify for emergency revert; revert commit still goes through CI after landing, but has no PR and therefore no claude-review.)
Verify: `curl https://erikunha.dev/api/healthz | jq .sha`

## PR merge gate

When about to merge a PR, invoke `.claude/skills/pr-merge-gate`: rebase first (non-dependabot, unless the already-reviewed exception applies), THEN run `pnpm ready-to-merge <pr>` so the readiness checks run on the post-rebase HEAD. The skill covers the full 9-point gate: claude-review Approve requirement (mechanical gate via `pnpm claude-gate`, which folds in the claude-review re-request loop), resolve-thread ground truth, RESOLVE-or-ESCALATE with SHA-cited replies, in-session reviewer findings, self-resolve detection, the `ready-to-merge` command, branch-protection invariant, the local Playwright visual check, and the rebase rule (with its dependabot + already-reviewed exceptions). AI agents must never call `gh pr merge` — the bash-guard blocks it (exit 2). Once all gate points pass, the repo owner executes the final merge command in an external terminal or via the GitHub UI.

## Things that have been considered and rejected

Before proposing any of these, check `DECISIONS.md` to see the reasoning that excluded them:
- GraphQL · Cloudflare Workers · multi-region deploy · Sentry by default · CAPTCHA on the contact form · per-portfolio-section routes · state management library · MDX as a blog/content engine · separate CMS · CSS modules · CSS-in-JS / styled-components · PostCSS plugins beyond `@tailwindcss/postcss`

## Reference docs in this repo

- `STANDARDS.md` — canonical engineering bar; domain chapters, each naming its enforcement mechanism
- `ARCHITECTURE.md` — system design, deep dive, trade-offs
- `DECISIONS.md` — running ADR log
- `.claude/rules/*.md` — path-scoped rules that load only when editing matching files (keeps this file small); `api-boundary.md` covers `app/api/**` + server surface

## When in doubt

- Read `ARCHITECTURE.md` §16 ("What I'd revisit as the system grows") before proposing infrastructure changes.
- If the request seems to conflict with a budget or gate, surface the conflict before complying.
- Before invoking `superpowers:writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `superpowers:writing-plans` proceeds. `.claude/hooks/architect-gate.sh` (PreToolUse `Skill` matcher) is WIRED to block (`exit 2`) the `superpowers:writing-plans` invocation unless the transcript shows an `architect-reviewer` `GATE_RESULT: PASS` (scoped to a tool_result block, so prose quoting the sentinel cannot spoof it) this session. **Confirmed enforced (2026-06-06):** Skill matcher fired exit-2 and blocked `superpowers:writing-plans` in a live session without a prior `GATE_RESULT: PASS`. Boundaries: session-scoped PASS, not per-spec identity (spec identity is not a structured transcript field).
