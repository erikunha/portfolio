# Spec-Kit Upgrade — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Goal

Improve the spec-driven agentic flow for this portfolio project by installing and wiring 9 popular marketplace agents (with slight portfolio-specific adaptations), reusing 5 already-installed agents, hardening local gates, and expanding skill dispatch in CLAUDE.md and `settings.local.json` — so the brainstorm → spec → plan → implement loop is enforced rather than aspirational.

---

## Architecture

Three layers, each independently useful, together forming a closed loop:

```
brainstorm → spec → [spec-gate] → plan → implement → [local-gate] → CI
                         ↑                    ↑
                  architect-reviewer     pre-commit catches
                  + dispatch table       80% of CI failures
```

- **14 agents** cover the complete development lifecycle (9 new installs + 5 already installed), each scoped to one phase.
- **Spec-gate rule** in CLAUDE.md makes the brainstorm→plan transition structurally sound before any code is written.
- **Local gate hardening** (pre-commit hook) moves fast feedback from ~12-minute CI to ~15-second local check.

---

## Section 1: Agent roster

### 1a. Install from marketplace (9 agents)

Each agent is copied from `~/.claude/plugins/marketplaces/voltagent-subagents/categories/` to `~/.claude/agents/` with a **Portfolio project context** section appended — a short block that injects project-specific constraints without rewriting the core agent behavior.

---

#### `architect-reviewer`
**Source:** `04-quality-security/architect-reviewer.md` | **Model:** opus

**Role in this project:** Planning gate. Evaluates specs and plans against architectural constraints before `writing-plans` is invoked. Knows the RSC-first rendering model, Vercel edge deployment, single-page composition constraint, and DECISIONS.md rejected patterns.

**Portfolio project context to append:**
```
## Portfolio project context
- Stack: Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, Vercel edge
- Rendering model: RSC by default; client islands by exception (named *.client.tsx)
- Single-page composition — no per-section routing (see DECISIONS.md)
- Rejected patterns: GraphQL, Cloudflare Workers, multi-region, Sentry, CAPTCHA, separate routes, state management library, MDX, CMS
- Before approving any plan: check against CLAUDE.md "Out of scope" list and DECISIONS.md
```

---

#### `nextjs-developer`
**Source:** `02-language-specialists/nextjs-developer.md` | **Model:** sonnet

**Role in this project:** Primary implementation agent for all Next.js features — App Router layouts, RSC data fetching, Server Actions, image/font optimization, Vercel deployment config.

**Portfolio project context to append:**
```
## Portfolio project context
- Next.js 15 with Turbopack dev (`next dev --turbopack`)
- RSC-first: default to server components; add 'use client' only when state/effects/browser APIs required
- Client files must be named *.client.tsx — never add 'use client' to a non-.client file
- Client JS budget: 43KB gzipped total across all islands; per-route: 120KB gzipped
- Existing client islands: InteractiveShell, ContactForm, ToTopButton, MatrixRain, CRTOverlay, StatusBar, Dock, MobileTitleBar, AppShell.client, ErrorBoundary.client
- Performance gates: LCP < 1.8s, INP < 200ms, CLS < 0.05, Lighthouse Perf ≥ 95
- Deployment: Vercel edge, Node 22, pnpm 10
- No per-section routing; single-page composition only
```

---

#### `typescript-pro`
**Source:** `02-language-specialists/typescript-pro.md` | **Model:** sonnet

**Role in this project:** Zod schema authoring for `content/schemas.ts`, TypeScript strict compliance, content file typing, `satisfies` operator patterns for validated content exports.

**Portfolio project context to append:**
```
## Portfolio project context
- TypeScript strict mode enforced; `pnpm tsc --noEmit` is a CI gate
- Content files in `content/*.ts` are typed TS modules validated by Zod at build time
- `content/schemas.ts` holds all Zod schemas; build fails on schema violation
- `zod` is exact-pinned (-E) — do not upgrade without deliberate review
- Use `satisfies` operator to validate content objects against schemas without losing inference
- All content must pass `node scripts/validate-content.mjs` before commit
- No `any` — if you find one, fix it; don't suppress with `// @ts-ignore`
```

---

#### `test-automator`
**Source:** `04-quality-security/test-automator.md` | **Model:** sonnet

**Role in this project:** Authors and maintains Vitest unit tests (`__tests__/`), Playwright E2E tests (`tests/e2e/`), and axe-core a11y tests (`tests/a11y/`). Wires new tests into the existing CI pipeline.

**Portfolio project context to append:**
```
## Portfolio project context
- Unit tests: Vitest in `__tests__/` — run with `pnpm vitest run`
- E2E tests: Playwright in `tests/e2e/` — run with `pnpm playwright test tests/e2e`
- A11y tests: axe-core + Playwright in `tests/a11y/axe.spec.ts` — run with `pnpm playwright test tests/a11y`
- CI jobs: build-and-gate (unit + a11y) and e2e (separate job, needs build-and-gate)
- Matrix dialog loop must NOT use per-keystroke useState — there is a Vitest test enforcing this
- Test environment: jsdom for unit tests; Playwright uses Chromium only
- Playwright config: `playwright.config.ts` at project root
- Pre-commit runs: `pnpm test` (vitest only) — fast; Playwright stays CI-only
```

---

#### `ui-ux-tester`
**Source:** `04-quality-security/ui-ux-tester.md` | **Model:** sonnet

**Role in this project:** Visual regression and aesthetic consistency audits using Chrome MCP (already configured in this project). Verifies terminal aesthetic, CRT effects, section layout at 390px mobile and desktop viewports.

**Portfolio project context to append:**
```
## Portfolio project context
- Target URL: http://localhost:3000 (run `pnpm dev` or `pnpm start` first)
- Chrome MCP is pre-configured — use it for all browser interactions
- Viewports to test: 390×844 (iPhone 15 Pro mobile) and 1440×900 (desktop)
- Aesthetic rules to verify:
  - Background: #000000 only — no off-black
  - Text colors: --signal (#00FF41) for headings/accents, --fg (#E6FFE6) for body
  - Font: JetBrains Mono everywhere except hero headline (Inter 900 / Geist Black)
  - Borders: 1px only, no border-radius > 2px
  - CRT effects (scanlines, grain, flicker) must be OFF under prefers-reduced-motion
- Key sections to audit: Hero boot sequence, InteractiveShell, MatrixRain, all 18 content sections
- Report: structured defect list with screenshot evidence, severity, and fix recommendation
```

---

#### `ai-engineer`
**Source:** `05-data-ai/ai-engineer.md` | **Model:** opus

**Role in this project:** Owns the `/api/ask` endpoint — Anthropic SDK integration, prompt caching, token budget cap, rate limiting strategy, model selection, streaming response protocol.

**Portfolio project context to append:**
```
## Portfolio project context
- AI endpoint: `app/api/ask/route.ts`
- Model: `claude-haiku-4-5-20251001` (trivially upgradeable to Sonnet if quality complaints arise)
- Anthropic SDK: `@anthropic-ai/sdk` — prompt caching enabled via `cache_control: { type: 'ephemeral' }`
- Monthly token hard cap: 400K tokens (~$0.40 at Haiku pricing) in Redis key `ask:tokens:YYYY-MM`
- Rate limit: `slidingWindow(8, '1 h')` via Upstash `@upstash/ratelimit`
- Streaming protocol: custom stream format in `lib/stream-protocol.ts`
- Fail-open on Redis unavailability (never block the user for infrastructure reasons)
- Monthly budget cap ($50 hard cap with 80%/95% alert thresholds): CRITICAL — never disable
- Cost safety is non-negotiable; always consider token cost implications of prompt changes
```

---

#### `seo-specialist`
**Source:** `07-specialized-domains/seo-specialist.md` | **Model:** haiku

**Role in this project:** Lighthouse SEO = 100 is a hard CI gate. Covers OG image (`app/opengraph-image.tsx`), sitemap (`app/sitemap.ts`), `public/robots.txt`, `public/llms.txt`, and `/api/erik.json` AI-recruiter endpoint.

**Portfolio project context to append:**
```
## Portfolio project context
- Lighthouse SEO gate: must = 100 (non-negotiable CI gate)
- OG image: `app/opengraph-image.tsx` — generated via Next.js ImageResponse
- Sitemap: `app/sitemap.ts` — single-page, one URL
- robots.txt: `public/robots.txt`
- llms.txt: `public/llms.txt` — AI agent recruiter discovery format
- /api/erik.json: `app/api/erik.json/route.ts` — structured HiringProfile for AI parsers; 24h edge cache
- This is a hiring artifact — every SEO decision should optimize for recruiter discovery
- No analytics beyond Vercel Web Analytics + Speed Insights (no GA, no Mixpanel)
- Single-page SPA — canonical URL is the root; no per-section URLs to optimize
```

---

#### `dx-optimizer`
**Source:** `06-developer-experience/dx-optimizer.md` | **Model:** sonnet

**Role in this project:** Owns the local developer feedback loop — pre-commit hook hardening, CI pipeline optimization, Turbopack config, Vitest watch mode, and the `pnpm ci:local` script.

**Portfolio project context to append:**
```
## Portfolio project context
- Package manager: pnpm 10 only (never npm or yarn)
- Dev server: `pnpm dev` (Turbopack via `next dev --turbopack`)
- Pre-commit hook: `.husky/pre-commit` — currently runs `pnpm test` only; target: add biome + typecheck + validate-content
- Pre-push hook: `.husky/pre-push` — validates branch name pattern `^(feat|fix|chore|...)/.+$`
- CI: `.github/workflows/ci.yml` — two jobs: build-and-gate (12min timeout) and e2e (10min timeout)
- Target for `ci:local` script: `pnpm check && pnpm typecheck && pnpm validate-content && pnpm test`
- Biome (not ESLint/Prettier): `biome.json` — `pnpm biome ci .` for CI, `pnpm check` for local
- Node 22+, pnpm 10+ enforced in `package.json` engines field
```

---

#### `dependency-manager`
**Source:** `06-developer-experience/dependency-manager.md` | **Model:** haiku

**Role in this project:** Audits `pnpm-lock.yaml` for vulnerabilities, checks package sizes against the 43KB client JS budget, flags large deps before they ship.

**Portfolio project context to append:**
```
## Portfolio project context
- Package manager: pnpm 10; lockfile is `pnpm-lock.yaml` (source of truth)
- Client JS budget: 43KB gzipped total across all client islands; per-route: 120KB gzipped
- Bundle gate script: `scripts/check-bundle-size.mjs --max-route-kb=120 --max-client-kb=320`
- `zod` is exact-pinned (`-E`) at `4.4.3` — do not upgrade without deliberate review
- All deps installed `@latest` at scaffold; `pnpm up --latest` for bumps (except zod)
- CI runs `pnpm install --frozen-lockfile` — lockfile must be committed
- Flag any new client-side dep > 5KB gzipped before it lands
```

---

### 1b. Already installed — reuse as-is (5 agents)

These live in `~/.claude/agents/` and need no modification. They are wired into the CLAUDE.md dispatch table with project-specific trigger notes.

| Agent | Phase | Project role |
|---|---|---|
| `performance-engineer` | Performance | LCP < 1.8s, INP < 200ms, CLS < 0.05, Lighthouse Perf ≥ 95, budget gate |
| `accessibility-tester` | Accessibility | WCAG 2.1 AA, Lighthouse A11y = 100 (non-negotiable CI gate) |
| `code-reviewer` | Code quality | PR reviews, pattern consistency, RSC drift, security smell |
| `security-auditor` | Security | CSP policy, rate limit config, API key exposure, Redis usage, contact form |
| `refactoring-specialist` | Cleanup | Component restructuring, CSS consolidation, dead code removal |

`documentation-engineer` remains available but is not in the primary dispatch table — invoke ad-hoc when updating ARCHITECTURE.md, DECISIONS.md, or HANDOFF.md.

---

## Section 2: CLAUDE.md — project agent dispatch table

Add a new **Project agent dispatch** section to `CLAUDE.md` mapping each phase to its agent:

```markdown
## Project agent dispatch

Invoke the named agent before the described action. These are definitions of done, not optional review steps.

| Phase | Trigger | Agent |
|---|---|---|
| Planning | Before invoking `writing-plans` on any spec | `architect-reviewer` |
| Implementation | After editing `app/`, `components/`, or `lib/` files | `nextjs-developer` |
| Type safety | After editing `content/*.ts` or `content/schemas.ts` | `typescript-pro` |
| Testing | When writing or modifying tests in `__tests__/` or `tests/` | `test-automator` |
| Visual QA | After any UI change — section layout, CSS, responsive | `ui-ux-tester` |
| AI feature | After editing `app/api/ask/` or `lib/stream-protocol.ts` | `ai-engineer` |
| SEO | After editing `app/opengraph-image.tsx`, `sitemap.ts`, `robots.txt`, `llms.txt` | `seo-specialist` |
| DX/Tooling | After editing `.husky/`, `ci.yml`, `vitest.config.ts`, `playwright.config.ts` | `dx-optimizer` |
| Bundle | After adding any new dependency to `package.json` | `dependency-manager` |
| Performance | After any Lighthouse-affecting change | `performance-engineer` |
| Accessibility | After editing any component with interactive or semantic elements | `accessibility-tester` |
| Code review | Before any commit on a PR branch | `code-reviewer` |
| Security | After editing `app/api/`, `lib/rate-limit.ts`, or `.env.example` | `security-auditor` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |
```

### Spec-gate rule

Add to the `When in doubt` block:

```markdown
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It must clear:
  1. No new client islands without a 43KB budget justification.
  2. No pattern listed in DECISIONS.md as rejected.
  3. No item from the "Out of scope" list in this CLAUDE.md.
```

---

## Section 3: `settings.local.json` — expand allowed skills

Add all skills from the global CLAUDE.md dispatch table not yet in the allow list:

```json
"Skill(superpowers:verification-before-completion)",
"Skill(superpowers:systematic-debugging)",
"Skill(code-review:code-review)",
"Skill(commit-commands:commit-push-pr)",
"Skill(security-review)",
"Skill(thinking-pre-mortem)",
"Skill(thinking-opportunity-cost)",
"Skill(thinking-second-order)",
"Skill(thinking-reversibility)",
"Skill(thinking-inversion)",
"Skill(thinking-leverage-points)",
"Skill(thinking-model-router)",
"Skill(pr-review-toolkit:review-pr)"
```

---

## Section 4: Pre-commit gate hardening

### `.husky/pre-commit`

Replace:
```sh
pnpm test
```

With:
```sh
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Execution order: biome (~1s) → tsc (~4s) → validate-content (~1s) → vitest (~8s). First failure stops the chain. Estimated total: ~15s.

**Stays CI-only:** build, bundle-size gate, Lighthouse CI, axe E2E. These need secrets and take 10+ minutes.

### `package.json` — `ci:local` script

```json
"ci:local": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test"
```

---

## Files changed

| File | Change |
|---|---|
| `~/.claude/agents/architect-reviewer.md` | Install + portfolio context block |
| `~/.claude/agents/nextjs-developer.md` | Install + portfolio context block |
| `~/.claude/agents/typescript-pro.md` | Install + portfolio context block |
| `~/.claude/agents/test-automator.md` | Install + portfolio context block |
| `~/.claude/agents/ui-ux-tester.md` | Install + portfolio context block |
| `~/.claude/agents/ai-engineer.md` | Install + portfolio context block |
| `~/.claude/agents/seo-specialist.md` | Install + portfolio context block |
| `~/.claude/agents/dx-optimizer.md` | Install + portfolio context block |
| `~/.claude/agents/dependency-manager.md` | Install + portfolio context block |
| `CLAUDE.md` | Add project agent dispatch table + spec-gate rule |
| `.claude/settings.local.json` | Add 13 missing skill dispatch entries |
| `.husky/pre-commit` | Replace `pnpm test` with full fast-gate chain |
| `package.json` | Add `ci:local` script |

---

## Non-goals

- Project-level `.claude/agents/` overrides — portfolio context goes into user-level agent files as appended blocks; no per-project agent duplication.
- Visual regression baseline snapshots — `ui-ux-tester` does live audits via Chrome MCP, not stored baseline diffs.
- CI restructuring — the existing two-job CI stays as-is; `dx-optimizer` may suggest improvements but the gate thresholds are unchanged.
- Custom agents from scratch — all 9 installs are marketplace agents with appended context blocks only.

---

## Spec self-review

**Placeholder scan:** No TBD or TODO. All 9 portfolio context blocks are concrete and reference real file paths. All 5 reused agents have a stated project role.

**Internal consistency:** Agent triggers in Section 1 match the dispatch table in Section 2. Pre-commit chain in Section 4 matches the `ci:local` script. `settings.local.json` additions match the global CLAUDE.md skill dispatch table exactly.

**Scope check:** 13 files changed. 9 agent installs, 2 config updates, 1 hook change, 1 script addition. Tractable in a single implementation plan; each agent install is an independent step.

**Ambiguity check:** "Install" means copy from marketplace path + append portfolio context block. The exact source paths for all 9 agents are specified in Section 1a. No ambiguity about where each agent comes from or what gets added.
