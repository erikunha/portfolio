# 2026 Modernization Program — Design Spec

- **Date:** 2026-05-21
- **Status:** Approved — architect-reviewer returned FAIL on the first pass; the 5 required spec changes are folded into this revision; re-gate pending
- **Branch:** `chore/2026-modernization-program` (the spec + plan live here; each phase ships as its own PR off `main`)
- **Author:** Erik Cunha

## 1. Context & goal

`erikunha.dev` is a Next.js 16 / React 19 personal portfolio that doubles as a Staff/Principal
hiring artifact for applied-AI and frontend roles. A fresh, current-state-only Principal-level
audit (six parallel deep-dive agents, 2026 lens, prior decisions deliberately questioned)
confirmed the codebase is **top-decile** — every agent independently graded it
"production-grade" / "Principal-bar." 

The audit's central insight: the frontier is no longer correctness. It is **(a) making the
existing excellence visible** — the AI feature, the portfolio's centerpiece, has zero quality
evals, so a hiring reviewer cannot see that it works — and **(b) modernizing for 2026** — the
`force-static` dual-DOM pattern predates Next 16 PPR; the AI is direct-SDK in an AI-Gateway era.

### Goal

A four-phase improvement program that raises the portfolio to the 2026 applied-AI Principal bar:
exhaustive (Tier 1 + 2 + 3 findings), AI-modernized (evals + agent-readiness + Vercel AI
Gateway), and architecturally current (Next 16 Partial Pre-Rendering). Each phase ships as one
PR off `main`, in leverage order.

### Non-goals

See §8.

## 2. Audit method note

Six exploration agents audited the current `main` (`f8cfaea`) with explicit instructions to
question prior ADRs rather than assume them. Findings below are the synthesis, with two
controller corrections of agent over-statement: the dual-DOM cost is ~5 variant sections, not
"2500 nodes"; some agent-suggested Turbopack config keys were unverified and dropped.

## 3. Audit findings

### Tier 1 — high-leverage

| # | Finding | Phase |
|---|---------|-------|
| 1 | The AI feature (`/api/ask`) has **zero quality evals** — no correctness suite, no jailbreak-resistance battery, no latency/cost dashboard. Operationally instrumented; not quality-instrumented. | P1 |
| 2 | `app/page.tsx` `force-static` ships **both desktop + mobile DOM** for ~5 viewport-variant sections + the `Module` wrapper — predates Next 16 PPR / `cacheComponents` / `'use cache'`. | P2 |
| 3 | `components/client/RoleTyper.tsx` — `role="img"` + `aria-label` on dynamically-cycling role text; should be `role="status"` + `aria-live`. Asymmetric `prefers-reduced-motion` coverage. | P4 |
| 4 | `ARCHITECTURE.md` describes a `lib/` subdirectory layout that does not exist (the dir is flat) and references "PR 5 / PR 6 pending" that never shipped — doc-vs-code drift. | P4 |
| 5 | CI waste — no Playwright browser cache; `e2e-functional`/`e2e-visual` rebuild from source instead of reusing `build-and-gate`'s `.next` artifact. | P3 |

### Tier 2 — 2026 modernization & hardening

- No `/.well-known/agent.json` manifest; no MCP server (both strong 2026 applied-AI signals). — P1
- `/api/ask` uses the direct `@anthropic-ai/sdk`; Vercel AI Gateway gives observability, model fallback, unified cost. — P1
- No code-coverage reporting; no Dependabot/Renovate; no CodeQL. — P3
- CSP `script-src 'unsafe-inline'` — hash-based CSP is feasible for the static framework-emitted inline scripts. — P3
- IP extraction (`getClientIp`) trusts `x-forwarded-for` with no explicit proxy-trust posture. — P3
- Lighthouse gates lack **INP** and TTFB assertions. — P3
- `scripts/strip-next-polyfills.mjs` postinstall hack — re-verify it is still needed under Turbopack 16 + `browserslist`; likely deletable. — P3
- No Vercel Observability / OpenTelemetry wiring. — P3
- `README.md` is 743 lines and duplicates `ARCHITECTURE.md`. — P4
- The render-both-variants pattern is duplicated across ~5 sections with no abstraction. — P2

### Tier 3 — polish

- `ToTopButton` uses a needless `dynamic({ ssr: false })`. — P2
- `MatrixRain.client.tsx` ref-mutation pattern is fragile (works, but brittle to a future dep-array edit). — P2
- `lib/motion.ts` mutates `document.body` directly rather than through React state. — P2
- Custom `module:open` event has no typed dispatch helper. — P2
- `app/opengraph-image.tsx` uses hex literals that diverge slightly from `_tokens.css`. — P4
- The "OPEN_TO_RELOCATION · WORLDWIDE" status badge wraps awkwardly below 360px. — P4
- Vitest 4 / Playwright 1.60 currency — refresh or document the pin. — P3
- The bespoke 201-line PR-comment merge-gate harness (`check-pr-comments.ts` + `ready-to-merge.ts`) — re-evaluate for a solo repo: keep + document the rationale, or simplify. — P3

## 4. The four-phase program

Each phase is one PR off `main`, sequenced. Ordered by hiring-signal leverage; **Phase 4 (docs)
lands last** so the docs describe the post-P1–P3 reality.

### Phase 1 — AI for 2026

The headline. Raises the portfolio's centerpiece to the 2026 applied-AI bar and makes its
rigor visible.

- **1a — Migrate `/api/ask` onto Vercel AI Gateway.** Replace the direct `new Anthropic()`
  client with the AI Gateway (`provider/model` string form), gaining unified observability,
  cost tracking, and model fallback.
  - **Gating spike — do this FIRST, before any migration code.** Verify against current Vercel
    AI Gateway docs (Context7) that the Gateway exposes, on the *streaming* response, the
    per-request `cache_read_input_tokens` and `cache_creation_input_tokens` token breakdown —
    not just a flattened `input` figure. The budget cap (`settleBudget` in `lib/rate-limit.ts`)
    and the `cacheHitRate` metric (`app/api/ask/route.ts`) both depend on
    `input + cache_read + cache_creation`. **If the Gateway exposes the breakdown:** proceed
    with the full migration, adapting the usage extraction at `app/api/ask/route.ts` to the
    Gateway's field names. **If it does NOT:** the fallback is to keep the direct
    `@anthropic-ai/sdk` for the `/api/ask` usage path — the Gateway's other benefits do not
    justify silently zeroing the cache metric — and Phase 1c must then NOT publish a cache-hit
    figure it cannot measure. Record the spike outcome in `DECISIONS.md`.
  - **Preserve `cache_control: { type: 'ephemeral' }`** on the system block. The
    `provider/model` request must still carry the ephemeral-cache directive, or prompt caching
    stops firing (STANDARDS.md Ch.7 requires SYSTEM ≥ 1024 tokens *so the cache fires*).
  - **Exit criteria.** `__tests__/budget-cap.test.ts` stays green, AND a behavioral test
    asserting the cache-hit-rate accounting (`cache_read` tokens flow into `totalBilledInput`
    and into the logged `cacheHitRate`) stays green — add that test in this phase if it does
    not already exist. The budget cap survives the migration intact.
- **1b — Eval suite.** A `scripts/ask-eval.ts` (or `__tests__/ask-eval/`) harness: a corpus of
  ~25–30 representative Q&A pairs with LLM-graded correctness assertions (a judge model scores
  answer vs. expected), a jailbreak-resistance battery (prompt-injection attempts measured for
  slip-out-of-character rate), and latency/cost capture. Runs in CI (or nightly via a scheduled
  workflow). A regression in correctness or jailbreak resistance fails the gate.
- **1c — Visible metrics.** The AI feature must *show* it is measured. Add an on-page metrics
  panel surfacing eval pass-rate, cache-hit rate, and cost-per-answer to any hiring reviewer
  browsing the site. **It is a server-rendered (RSC) section, NOT a client island** — it ships
  zero client JS, reads aggregated metrics from a KV-aggregated source (or a build-generated
  JSON), and at Phase 1 renders a per-deploy static snapshot. (Post-P2, the PPR rework may
  promote it to a live dynamic boundary if freshness is wanted — out of P1 scope.) An endpoint
  alone is not reviewer-visible; the on-page RSC panel is the deliverable. If the 1a spike
  determined the cache metric is unmeasurable, the panel omits it rather than publishing a zero.
- **1d — Agent-readiness.** `public/.well-known/agent.json` — a capability manifest describing
  the `/api/ask` endpoint, its I/O shape, rate limits, and the `erik.json`/`llms.txt` profiles.
  Plus a minimal **MCP server** exposing the résumé data and the ask capability as MCP tools —
  a concrete 2026 applied-AI demonstration.

### Phase 2 — Architecture modernization

- **2a — PPR / `'use cache'` rework.** Re-architect `app/page.tsx`'s static/dynamic boundary
  with Next 16 Partial Pre-Rendering + `cacheComponents` / `'use cache'`: the page renders one
  prerendered shell, UA detection becomes a scoped dynamic boundary, and the page emits a
  **single DOM tree** instead of both desktop and mobile variants. The viewport-variant
  sections (`GuitarSection`, `ProjectsSection`, `GitLogSection`, `VisaSection`) and the
  `Module` wrapper collapse to single-variant rendering. The visual-regression suite is the
  safety net; baselines are regenerated deliberately.
- **2b — `<ViewportVariant>`.** If any genuine dual-render survives 2a, encapsulate it in one
  small component instead of the ~5 hand-rolled repetitions.
- **2c — Component polish.** Drop `ToTopButton`'s needless `dynamic({ ssr: false })`;
  restructure `MatrixRain`'s ref-mutation tunables into an explicit, non-fragile shape; route
  `lib/motion.ts` state changes cleanly; add a typed `dispatchModuleOpen()` helper.

### Phase 3 — CI, tooling & security hardening

- **3a — CI efficiency.** Add an `actions/cache` step for the Playwright browser binaries; make
  `e2e-functional`/`e2e-visual` consume `build-and-gate`'s `.next` build artifact (upload/download)
  instead of rebuilding from source.
- **3b — Coverage & supply chain.** Add Vitest coverage reporting with a light threshold;
  add Dependabot or Renovate; add a CodeQL workflow; refresh Vitest/Playwright to current and
  document any deliberate pin.
- **3c — Security.** Replace `script-src 'unsafe-inline'` with a **hash-based CSP** computed
  over the static framework-emitted inline scripts; add explicit proxy-trust / IP-extraction
  hardening in `getClientIp`.
- **3d — Perf gates.** Add **INP** and **TTFB** assertions to the Lighthouse configs;
  re-evaluate `scripts/strip-next-polyfills.mjs` — if Turbopack 16 + `browserslist` already
  excludes the legacy polyfills, delete the postinstall hack; otherwise document why it stays.
- **3e — Observability.** Wire Vercel Observability (and/or an OpenTelemetry exporter) so
  runtime metrics are platform-visible.
- **3f — Merge-gate harness decision.** Re-evaluate the bespoke `check-pr-comments.ts` +
  `ready-to-merge.ts` harness for a solo repo: either keep it and document the rationale in
  `DECISIONS.md`, or simplify it. Decide explicitly, do not leave it unexamined.

### Phase 4 — Accessibility & documentation

Lands last so the docs describe the post-P1–P3 system.

- **4a — Accessibility.** `RoleTyper` → `role="status"` + `aria-live="polite"` (drop the
  `role="img"`); complete `prefers-reduced-motion` coverage across every animation (audit each
  animation selector for parity with the CRT layer); improve `<details>` mobile keyboard-nav
  (pre-open above-the-fold modules or add an expand-all control); fix the `<360px` status-badge
  wrap; align `opengraph-image.tsx` colors to the design tokens.
- **4b — Documentation.** Fix the `ARCHITECTURE.md` `lib/` layout drift and remove the stale
  "PR 5 / PR 6 pending" references; banner the historical audit docs consistently; trim `README.md` from 743 lines to ~150 (quickstart + stack + links),
  moving deep design into `ARCHITECTURE.md`; surface the contact-form progressive-enhancement
  caveat properly; add `DECISIONS.md` ADR entries for every phase's decisions.

## 5. Sequencing & dependencies

- Phases ship in order P1 → P2 → P3 → P4, each as its own PR off `main`, each rebased on the
  prior phase's merge.
- Within Phase 1: 1a (AI Gateway) before 1b (evals), so the eval suite measures the final
  Gateway-backed state.
- Phases 1, 2, 3 are otherwise independent. Phase 4 is last by design (docs must describe the
  finished system; doing docs earlier guarantees immediate re-drift).
- Each PR follows the CLAUDE.md PR merge gate: `pnpm ready-to-merge`, a `@copilot /review` after
  every push, all threads resolved before merge.

## 6. Risks & pre-mortem

| Risk | Mitigation |
|------|-----------|
| The PPR rework (2a) touches every section's rendering — visual regressions. | The `e2e-visual` suite is the safety net; regenerate baselines deliberately; land 2a behind its own PR with the visual job green. |
| Next 16 `cacheComponents` / PPR / `'use cache'` APIs are still evolving — the spec may name an API form that has changed. | The plan's 2a task begins with a docs-verification step against current Next 16 docs (Context7); adapt the exact directive form to what ships. |
| AI Gateway migration (1a) flattens the `usage` shape and silently zeroes the cache metric — which 1c would then publish on the homepage. | 1a opens with a **gating spike** verifying the Gateway exposes per-request `cache_read`/`cache_creation` breakdown. If not, the documented fallback is to keep the direct SDK for the usage path; 1c omits the cache figure. `budget-cap.test.ts` + a cache-hit behavioral test are 1a exit criteria. |
| The MCP server (1d) expands scope into a new deployable surface. | Scope it minimally — a read-only MCP server exposing the existing résumé/ask data; no new infrastructure. |
| Hash-based CSP (3c) — a missed inline-script hash blocks the page. | Compute hashes from the actual build output; the `proxy-csp` behavioral test + an e2e smoke check catch a blocked page. |
| Deleting `strip-next-polyfills.mjs` (3d) re-ships legacy polyfills if Turbopack does not in fact exclude them. | 3d verifies the built bundle's polyfill content before deleting; keep the hack if the verification shows it is still load-bearing. |

## 7. Testing strategy

- Every phase keeps `pnpm verify` and `pnpm build` green; the full `pnpm ci` gate passes before each PR is marked ready.
- Phase 1: the eval suite is itself the new test layer; the budget-cap and injection behavioral tests must stay green through the Gateway migration.
- Phase 2: visual-regression run before the PR is ready; INP verified for the streaming path.
- Phase 3: the new CI changes are validated by a green CI run on the PR itself.
- Phase 4: a11y changes covered by the axe scan + per-component behavioral tests; doc claims spot-checked against code.
- Per the architect-reviewer spec gate, `performance-engineer` is dispatched after Phase 2a (PPR rework — Lighthouse/CLS/bundle exposure) and Phase 1c (homepage DOM addition), and `accessibility-tester` after Phase 2a and Phase 4a — in addition to the standing `CLAUDE.md` agent dispatch table.

## 8. Out of scope

- Anything in `CLAUDE.md` "considered and rejected" (Tailwind re-add, GraphQL, CSS-in-JS, multi-region, etc.).
- New portfolio sections or product features.
- A redesign of the visual aesthetic.
- Rewriting git history.

## 9. Success criteria

1. `/api/ask` runs through Vercel AI Gateway — or, if the 1a gating spike showed the Gateway cannot expose per-request cache-token breakdown, the direct SDK is retained for the usage path with that decision recorded in `DECISIONS.md`. The budget cap is intact and `__tests__/budget-cap.test.ts` + a cache-hit-rate behavioral test are green; `cache_control: ephemeral` still fires. An eval suite exists, runs in CI, and gates on correctness + jailbreak resistance. The on-page metrics panel is a server-rendered RSC section (zero client JS). `/.well-known/agent.json` and an MCP server are live.
2. `app/page.tsx` renders a single DOM tree; the dual-variant render is gone; the visual-regression suite is green on regenerated baselines.
3. CI caches Playwright and reuses the build artifact; coverage is reported; Dependabot/Renovate and CodeQL are active; the CSP no longer uses `script-src 'unsafe-inline'`; Lighthouse gates assert INP and TTFB.
4. `RoleTyper` and all animations are a11y-correct; `prefers-reduced-motion` coverage is complete.
5. `ARCHITECTURE.md` matches the code; `README.md` is ~150 lines; historical docs are bannered; `DECISIONS.md` records every phase's decisions.
6. Every Tier 1/2/3 finding in §3 is resolved or carries a documented, deliberate exemption.
7. `pnpm ci` passes; each phase PR clears the CLAUDE.md merge gate.
