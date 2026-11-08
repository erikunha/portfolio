# AGENTS.md

Instructions for any coding agent working in this repository. Read it first. `STANDARDS.md`
holds the engineering bar by chapter, `ARCHITECTURE.md` the system design, `DECISIONS.md` the
decision log (check it before proposing anything it may have rejected), `REVIEW.md` what a review
reports and skips, and `docs/handbook/lessons.md` numbered rules from past review findings and CI
reds. Follow all of them.

## Project

**erikunha.dev**: personal portfolio and reference web system, Matrix/brutalist terminal aesthetic.
The homepage composes terminal-module sections plus a footer. `/summary`, `/cv`, `/links`,
`/links/en`, the `/pt` twins and `/design-system/*` are separate routes.

It is a reference system: every architectural decision, budget, a11y guarantee, token, CI gate and
lint rule must hold up as something another team could adopt verbatim. Cross-cutting concerns beat
local optimization. Performance, WCAG 2.2 AA and security apply to every change, not as later phases.
"It is only one consumer" is not a YAGNI argument here. Read `ARCHITECTURE.md` section 16 before
proposing infrastructure changes, and if a request conflicts with a budget or gate, say so before complying.

## Commands

| Command                                  | Purpose                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build`                | Development server / production build                                                         |
| `pnpm test`                              | Vitest unit tests                                                                             |
| `pnpm test:e2e`                          | Playwright: observability smoke, a11y scan, contact and ask journeys, visual regression       |
| `pnpm check` / `pnpm check:fix`          | Biome lint and format check / auto-fix                                                        |
| `pnpm typecheck`                         | TypeScript strict check                                                                       |
| `pnpm validate-content`                  | Zod schema validation of `content/*.ts`                                                       |
| `pnpm ci:local`                          | The verify chain CI runs first: lint, types, content, naming, pinning, doc drift, tokens, tests |
| `pnpm bundle-check`                      | Global client-chunk sum gate                                                                  |
| `pnpm route-js-check`                    | Per-route first-load JS gate (needs a build)                                                  |
| `pnpm gates:runtime [--skip-build]`      | Build, server, advisory Lighthouse, blocking axe and Chromium e2e                             |
| `pnpm lhci`                              | Lighthouse CI locally                                                                         |
| `pnpm check:doc-drift`                   | Marked `ARCHITECTURE.md` paths exist                                                          |
| `pnpm changelog:sync`                    | Regenerates the design-system changelog page from `(design-system)`-scoped commits             |
| `pnpm ask:eval`                          | `/api/ask` product eval; run after editing its corpus, calibration, runner or system prompt (see the `ai-eval-update` skill) |
| `pnpm eval:agents`                       | Prompt-regression eval of the rules in this file (`evals/agents/`), non-blocking in CI        |

## Done means verified

- Before claiming done, fixed or passing, run `pnpm typecheck && pnpm test --run && pnpm build`, read the output and cite it. "Should pass" is not evidence.
- Before opening a PR run `pnpm ci:local`, then `pnpm bundle-check`, `pnpm route-js-check` and `pnpm gates:runtime` (skip the last three for docs-only changes). CI stays the authoritative gate.
- After fixing a finding, re-run the checks that cover the affected files.
- A gate measures a real property. Fix the property, never the gate: no audit set to `"off"`, lowered threshold, ignore-list entry, or code wrapped to hide it from the checker. The one acceptable gate edit corrects an assertion that fires on the ideal state. A gate you cannot fix in scope gets escalated with root cause, options and the minimum change, not merged suppressed.
- A fix needs: the root cause in one sentence before code; the same pattern searched across the codebase; no deferred debt (inherent limits go in `DECISIONS.md`); the measured property re-checked, with the before and after in the commit body.
- Tests come first for new files, functions and scripts: write the failing test, watch it fail, make it pass. Assertions observe behavior, never source text. A claim of the form "held by X" is honest only after you break the property and watch X fail.
- While fixing a defect, never edit an existing test to make it pass: add a new test file for the regression and change the source. If an existing test is wrong, say why in the change that edits it.

## Stack (locked)

- Next.js 16 App Router, React 19, TypeScript strict, Biome, pnpm. Node 22.22.2 or newer (`.nvmrc` pins), pnpm 10 or newer.
- CSS: Tailwind v4 with tokens as custom properties in `app/css/theme.css`. No Style Dictionary, CSS modules, CSS-in-JS, or PostCSS plugin besides `@tailwindcss/postcss`.
- Vercel (Fluid Compute, Node runtime), Upstash Redis (rate limit, KV log), Resend (contact mail).
- `/api/ask`: AI SDK v7 (`streamText`) through the Vercel AI Gateway, model `anthropic/claude-haiku-4-5` from `lib/ask/model.ts`, ephemeral prompt cache via `providerOptions.anthropic.cacheControl` on a system message. Needs `AI_GATEWAY_API_KEY` (OIDC on Vercel).
- Tests: Vitest (jsdom), Playwright (chromium, chromium-mobile, webkit-desktop, webkit-mobile, and their four `-components` projects, all gated in CI), axe-core, Lighthouse CI.
- Packages: pnpm only, never npm or yarn. The lockfile is the source of truth; CI installs with `--frozen-lockfile`. Bump with `pnpm up --latest`, except `zod` (`~`-pinned, patch-only: its minor bumps break inference; `check-dep-pinning` rejects exact pins for stable versions) and `typescript` (held at 6.x because Stryker needs the TS JS API that TS7 removed; `--latest` rewrites a pin too; held by `__tests__/stryker-typescript-api.test.ts`).

## Budgets

Lighthouse (`lighthouserc.json`, `lighthouserc.mobile.json`), `pnpm route-js-check` and axe enforce the budgets. `__tests__/lighthouse-budgets.test.ts` fails when a Lighthouse assertion is lowered, warned or turned off. The Lighthouse INP audit is off; the only INP guard is the shell input keystroke check in `tests/e2e/cross-cutting.spec.ts` (Chromium). Never disable a gate to merge.

`route-js-check` caps first-load JS per route at 164.7KB gzipped and reports the app-owned part (total minus the measured 131.9KB framework floor, so 32.8KB of headroom). `bundle-check` sums chunks globally and cannot see a per-route regression. A framework bump moves the floor: re-measure it and change floor and total together (`DECISIONS.md` 2026-10-23).

## Rendering model

- Default is React Server Components with static generation; static sections ship zero JS.
- Client islands by exception: Matrix dialog loop, interactive shell, contact form, contact timezone panel, role and tagline typewriters, scroll type reveal and Matrix Rain (`GlobalMotion`), MOTION indicator. Every client file is named `*.client.tsx`.
- Hero identity is static server-rendered text; only the About role word animates.
- The Matrix dialog loop mutates `useRef.textContent`, never per-keystroke `useState`: per-state re-renders tank INP. The shell's streaming answer renders through React with rAF-coalesced state (`STANDARDS.md` chapter 1).

## Look and content

- Pure black background (`#000000`), signal green (`#00FF41`, `text-primary-500`) for headings, accents and large text. Body text is `text-tertiary-50` (`#E6FFE6`); the signal never colors paragraph text because it fails WCAG AA.
- JetBrains Mono everywhere (self-hosted through `next/font/local`); `h1` alone is Inter 900 via `--font-display`. 1px borders, no radius above 2px.
- CRT effects (scanlines, mask, grain, beam, flicker, phosphor shadow) stay at dialed-back opacity and are all off under `prefers-reduced-motion: reduce`. Do not remove existing motion (typing, Matrix Rain, boot, CRT, blink).
- Copy lives in `content/*.ts` (typed, Zod-validated at build, English and pt-BR). Never inline user-facing copy in JSX. A change to a section lands in every variant of it (mobile, tablet, placeholder, noscript, reduced-motion, print, design-system demos, tests): grep the old copy.
- Out of scope unless asked: locales beyond pt-BR and EN, light theme, blog or MDX engine, analytics beyond Vercel Web Analytics and Speed Insights, auth, accounts, comments, a CMS. Rejected earlier (see `DECISIONS.md`): GraphQL, Cloudflare Workers, multi-region deploy, Sentry by default, CAPTCHA on the contact form, per-section routes, a state management library.

## Code and docs style

- No magic values: name every unexplained literal as a `const`, enum, union or interface. Tests are exempt.
- Source is bare. The only comments are machine directives (`biome-ignore`, `behavioral-test-allow`, `@ts-*`, shebangs, triple-slash). A `biome-ignore` reason says why the rule is wrong here.
- One discriminator for every word you write (comments, docs, ADR bullets, PR bodies): does a gate already state this (compiler, type, test, lint rule, CI check)? If yes, delete it; prose that restates a gate is a second copy that drifts. If no, it is a decision: record it once in the cheapest durable place (a `biome-ignore` reason, `DECISIONS.md`, the commit body, a test's failure message).
- `DECISIONS.md` takes one bullet per decision: date and reversibility note. Docs, diagrams and screenshots that describe a change are updated in the same commit.
- No em or en dashes anywhere.

## Git and pull requests

- Commits are `type(scope): subject`; scope (feature area such as hero, shell, contact, ci) is required and commitlint enforces it. One logical unit per commit. No `Co-Authored-By` or attribution lines.
- Stage with `git add <file>` or `git add -u`, never `git add .`, `-A` or `--all`.
- Hooks: pre-commit runs Biome and `gitleaks git --staged` (fails closed without the binary; `brew install gitleaks`), commit-msg runs commitlint, pre-push runs the full verify and requires a `<type>/<description>` branch name. Do not push to `main`; only an emergency revert uses `--no-verify`.
- A feature too big for one PR gets an integration branch `feat/<feature>` and sub-PRs from `feat/<feature>-<part>` into it; the final PR to `main` notes it was reviewed incrementally.
- No PR until tests, perf gates and baselines have run on a locked design. Fill every section of `.github/pull_request_template.md`; never write a body from scratch.
- A change that moves a screenshot baseline regenerates it in the same PR: `tests/visual/visual.spec.ts` baselines on darwin and linux, `tests/e2e/design-system-components.spec.ts` baselines on darwin only. The `visual-baseline-regen` skill holds the procedure. Any color, layout, typography or spacing change counts.
- Before implementing a plan that adds a client island or dependency, or touches the API surface, check it with the `plan-review` skill. When a performance gate fails or a client change may cost JS, use `perf-budget`; when routes, identity copy or metadata change, use `seo-discovery`.
- After implementing a section or component, look at `pnpm dev` at 1280x720 and 375x812 in a real browser before writing or changing tests. Fix what looks wrong first.
- `claude-review` runs in CI only when an owner, member or collaborator comments `/claude-review`, and it is never a merge gate or an approver. `REVIEW.md` defines what blocks (correctness, security, accessibility, performance budget, test validity, spec or plan compliance) and what never does (style, naming).
- Every PR comment is a review thread on a file and line, never a timeline comment: `pnpm pr:gate` reads `reviewThreads` and fails `silent_resolve`. Reply in the existing thread or create one with `commit_id`, `path` and `line`.
- Merge readiness: CI green, base contained, `pnpm pr:gate` passes (threads resolved with a reply).
- Emergency rollback: `vercel ls`, then `vercel promote <url>` (30s, no code change); or `git revert HEAD && git push --no-verify`. Verify with `curl https://erikunha.dev/api/healthz | jq .sha`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
