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
| `pnpm review:stamp` | After ALL 5 review agents pass — writes HEAD SHA to `.review-passed`; pre-push hook blocks until this runs |
| `pnpm pr-size` | After every commit block and before opening a PR — decides whether to split |
| `pnpm ready-for-pr` | Before `gh pr create` — runs ci:local + pr-size + gates:runtime, prints next-step checklist |
| `pnpm validate-pr-body [<pr>]` | After `gh pr create` — exits 1 if any template section is missing or empty; must pass before requesting review |
| `pnpm ready-to-merge [<pr>]` | Before `gh pr merge` — runs ci:local + branch-protection + Copilot review + resolved threads + pr-metrics |
| `pnpm pr-metrics [<pr>]` | During or after PR review — reports Copilot cycle count, size, days open |
| `pnpm changelog:sync` | After any commit with scope `(design-system)` — regenerates `app/design-system/changelog/page.mdx` from full git history |

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
| Before opening any PR | After all milestone commits, before `gh pr create` | `pr-review-toolkit:review-pr` — address all Critical/Important before opening |
| Before writing plans | Before invoking `writing-plans` on any spec | `architect-reviewer` |
| After API changes | After editing `app/api/`, `lib/rate-limit.ts`, or `proxy.ts` | `security-auditor` |

**Spot-check agents** — invoke when the concern is the primary risk in the current change:

| Concern | Trigger | Agent |
|---|---|---|
| Visual correctness | After CSS, layout, or responsive changes | `ui-ux-tester` |
| Accessibility | After adding/editing interactive or semantic elements | `accessibility-tester` |
| Performance | After changes that could affect LCP/INP/CLS | `performance-engineer` |
| Bundle growth | After adding a new dependency | `dependency-manager` |

## Skill dispatch

Invoke the named skill inline (not as a subagent) before the described action. Project triggers below override global CLAUDE.md when both apply to the same action.

| Trigger | Skill |
|---|---|
| **Before writing any new file, API handler, or complex logic block** | **`thinking-inversion` — what specifically makes this fail? answers become test cases** |
| **Before `writing-plans` on any spec** | **`thinking-inversion` — enumerate the class-of-bugs the implementation introduces; each becomes an explicit plan task, not a Copilot finding** |
| **Before implementing any new file, function, or script** | **`superpowers:test-driven-development` — tests first, always; implementation satisfies them** |
| Before implementing any component (in `components/` or `design-system/`) | Run DS component pre-mortem: (1) which attrs does the consumer control? (`id`, `className`, `aria-*`) — passthrough, never override; (2) any `outline: none` on `:focus` must be `:focus-visible`; (3) `querySelector` returns `null` not `undefined` — use `.not.toBeNull()`; (4) can this component be rendered twice? hardcoded `id` breaks the second instance |
| After creating a new component or adding significant client-side state/effects | `react-best-practices` |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` |
| After editing `app/api/`, `lib/server/route.ts`, `lib/rate-limit.ts`, or `proxy.ts` | `vercel:vercel-functions` |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |

## Stack (locked)

- Next.js 16 App Router · React 19 · TypeScript strict · Biome · pnpm
- **CSS:** hand-rolled global CSS in `app/css/`, BEM-ish naming, tokens generated by Style Dictionary (design-system/tokens/*.json → dist/tokens.css), no framework. PostCSS pipeline removed — Next 16 + Turbopack handles nesting + autoprefix natively via Lightning CSS. _Tailwind v4 was removed 2026-05-18; see DECISIONS.md. Do not re-add._
- Vercel Edge end-to-end deployment
- Upstash Redis for rate-limit + KV log
- Vercel AI Gateway via the AI SDK v6 (`ai` package, `streamText`) with the model string `anthropic/claude-haiku-4-5` for `/api/ask`; ephemeral prompt cache preserved via `providerOptions.anthropic.cacheControl`. Needs `AI_GATEWAY_API_KEY` (OIDC token on Vercel). Migrated 2026-05-21 — see DECISIONS.md.
- Resend for contact form delivery
- Playwright E2E: observability smoke (`tests/e2e/observability-smoke.spec.ts`), a11y scan (`tests/a11y/axe.spec.ts`), contact + ask user-journey tests, visual regression snapshots; 4-project matrix (chromium/webkit x desktop/mobile)
- Vitest unit tests
- axe-core a11y CI gate
- Lighthouse CI gates

See `ARCHITECTURE.md` for the full system design, `DECISIONS.md` for the running ADR log, `LAUNCH.md` for the day-by-day implementation playbook.

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
| 7 — CSS/tokens | `lint-token-boundary` + `lint-no-magic-values` + `contrast-check`; token palette only, no raw hex |
| 8 — A11y | axe-core gate + Lighthouse =100; per-component behavioral a11y tests |
| 9 — Security | Behavioral tests for CSP + kill switches (not source-grep); `security-auditor` on any `app/api/` change |
| 10 — Docs | PR review: doc claims must match live code; ADRs cite SHA + reversibility note |
| 11 — DX | pre-commit = Biome (<1s); pre-push = full verify; never disable a gate to merge |
| 12 — Design system | `tokens:check` + `lint-token-boundary` + `lint-no-magic-values` + `contrast-check` + component-docs CI gates |

## Package + manager policy

- **pnpm only.** `packageManager: pnpm@latest`. Don't use npm or yarn.
- Every dep installed `@latest` at scaffold; `pnpm up --latest` for bumps.
- `zod` is exact-pinned (`-E`) — its minor bumps break inference. Upgrade deliberately.
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
- Comment non-obvious logic only.
- Don't ask clarifying questions unless missing info would change the decision — assume reasonably, state in one line, proceed.
- Flag flaws once. Don't repeat concerns.
- Skip disclaimers, boilerplate, "consult a professional" lines.
- Assume deep TypeScript, React, and Next.js expertise — skip syntax explanations and 101 content.
- Track decisions in `DECISIONS.md`: one bullet, date, reversibility note. Update as we go.
- **Process feedback mid-workflow is a hard stop.** Pause immediately, incorporate into CLAUDE.md and/or memory, confirm with the user, then resume.
- **See `CLAUDE-process.md`** for the full process protocol: commit/review/push rules, runtime gates, PR workflow, subagent rules, verification requirements, and the PR merge gate.

## Out of scope (unless asked)

- i18n
- Light theme toggle (the whole point is dark)
- Blog / MDX content engine
- Analytics beyond Vercel Web Analytics + Speed Insights
- Auth, accounts, comments
- CMS (single-author, content in TS)

## PR merge gate

Full protocol in `CLAUDE-process.md`. Short form: Copilot review required before `gh pr merge` (AI agents only; repo owner may merge directly); all threads resolved; `pnpm ready-to-merge <pr>` must pass.

## Things that have been considered and rejected

Before proposing any of these, check `DECISIONS.md` to see the reasoning that excluded them:
- GraphQL · Cloudflare Workers · multi-region deploy · Sentry by default · CAPTCHA on the contact form · per-portfolio-section routes (splitting `/` into multiple routes — distinct from purpose-built routes like `/design-system`) · state management library · MDX as a blog/content engine (distinct from MDX as docs surface for `/design-system`) · separate CMS · Tailwind (removed 2026-05-18) · CSS-in-JS / styled-components · PostCSS plugins beyond what Lightning CSS provides natively

Updated 2026-05-23: removed "design system extraction" (now accepted, see DECISIONS.md 2026-05-23), narrowed "MDX" to "MDX as a blog/content engine," narrowed "separate routes per section" to "per-portfolio-section routes," and removed "CSS Modules" (adopted 2026-05-22).

## Reference docs in this repo

- `STANDARDS.md` — the canonical engineering bar; 11 domain chapters, each naming its enforcement mechanism
- `ARCHITECTURE.md` — system design, deep dive, trade-offs
- `DECISIONS.md` — running ADR log
- `LAUNCH.md` — historical launch playbook (superseded; `STANDARDS.md` + `ARCHITECTURE.md` are authoritative)
- `docs/audit/2026-05-19-principal-audit.md` — Principal/Staff pass audit (historical; superseded by `STANDARDS.md`)
- `scaffold/` — drop-in opinionated configs (Biome, tsconfig, globals.css, Zod schemas, CI workflow)
- `scaffold/README.md` — explains every file in scaffold/
- `prototype/Portfolio.html` — the Claude Design prototype (visual reference only, never served)

## When in doubt

- Read `ARCHITECTURE.md` §16 ("What I'd revisit as the system grows") before proposing infrastructure changes.
- Read `LAUNCH.md` PR-by-PR order before suggesting we skip ahead.
- If the request seems to conflict with a budget or gate, surface the conflict before complying.
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `writing-plans` proceeds.
