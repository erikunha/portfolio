# 2026 Modernization Program — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the portfolio to the 2026 applied-AI Principal bar across four phases — AI modernization, architecture modernization, CI/security hardening, and accessibility + docs.

**Architecture:** Four phases, each shipped as its own PR off `main`, in order P1 → P2 → P3 → P4. Two phases are spike-gated: the AI Gateway migration (P1a) and the Next 16 PPR rework (P2a) each begin with a verification task whose outcome determines the implementation path. Phase 4 (docs) lands last so docs describe the finished system.

**Tech Stack:** Next.js 16 (App Router, Turbopack, PPR), React 19, TypeScript strict, Vercel AI Gateway, `@anthropic-ai/sdk`, Biome, pnpm, Vitest, Playwright, Upstash Redis, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-05-21-2026-modernization-program-design.md` (architect-reviewer `GATE_RESULT: PASS`).

**Per-PR invariant:** every phase keeps `pnpm verify` and `pnpm build` green; `pnpm ci` passes before the PR is marked ready; each PR clears the CLAUDE.md merge gate (`pnpm ready-to-merge`, `@copilot /review` after every push, all threads resolved).

**Branching:** each phase is a fresh branch off the latest `main` (`feat/p1-ai-2026`, `feat/p2-architecture`, `chore/p3-hardening`, `docs/p4-a11y-docs`). This plan + the spec already live on `chore/2026-modernization-program`; fold them into the P1 branch or land them first — implementer's choice, stated in the P1 PR.

---

# PHASE 1 — AI for 2026

Branch: `feat/p1-ai-2026`. Ships: AI Gateway migration, eval suite, visible metrics panel, agent-readiness surfaces.

## Task 1.1 — Gating spike: verify Vercel AI Gateway usage-field exposure

**Files:** none (investigation only — record the outcome in `DECISIONS.md` in Task 1.2's commit).

- [ ] **Step 1: Read current Vercel AI Gateway docs.**

Use Context7 (`mcp__plugin_context7_context7`) — resolve the Vercel AI Gateway library and query its streaming API. Specifically determine: when a streaming chat completion runs through the AI Gateway against `anthropic/claude-haiku-4-5`, does the per-request usage payload expose the **separate** `cache_read_input_tokens` and `cache_creation_input_tokens` counts (as the direct Anthropic SDK does on `message_start`), or a flattened single `input` figure?

- [ ] **Step 2: Decide the migration path and record it.**

  - **If the Gateway exposes the cache-token breakdown** → Task 1.2 does the full migration; `cacheHitRate` and the budget cap port over.
  - **If it does NOT** → Task 1.2 keeps the direct `@anthropic-ai/sdk` for the `/api/ask` usage path (do not silently zero the cache metric); the Gateway is not adopted for `/api/ask`. Task 1.4's metrics panel then omits the cache-hit figure.

Write the decision into a `DECISIONS.md` ADR entry (committed in Task 1.2): the spike question, the finding, and the chosen path with a reversibility note.

- [ ] **Step 3: Report the outcome** before proceeding — it determines Tasks 1.2 and 1.4.

## Task 1.2 — Migrate `/api/ask` to AI Gateway (path A) or formalize the seam (path B)

**Files:**
- Modify: `app/api/ask/route.ts`
- Modify: `lib/rate-limit.ts` (only if the Gateway's usage field names differ — `settleBudget`)
- Modify: `package.json` (add the AI Gateway dependency if path A)
- Modify: `DECISIONS.md` (the Task 1.1 ADR)
- Test: `__tests__/budget-cap.test.ts` (must stay green), `__tests__/ask-cache-metric.test.ts` (new)

- [ ] **Step 1: Write the cache-metric behavioral test FIRST** (regardless of path A or B — it guards the metric through the migration).

```ts
// __tests__/ask-cache-metric.test.ts
// Behavioral guard: the cache-hit-rate accounting must survive any change to
// the /api/ask usage path. Asserts cache_read tokens flow into totalBilledInput
// and into a non-zero cacheHitRate when the upstream reports a cache read.
import { describe, expect, it, vi } from 'vitest';

describe('ask cache-hit metric', () => {
  it('cache_read tokens flow into the billed-input total and a non-zero hit rate', async () => {
    // Drive the /api/ask stream consumer with a mocked upstream that reports
    // cache_read_input_tokens on message_start; assert the logged cacheHitRate
    // is cache_read / (input + cache_read + cache_creation), non-zero.
    // (Mirror the mocking style of __tests__/ask-timeout-behavioral.test.ts.)
  });
});
```

- [ ] **Step 2: Run it, confirm it passes against the current direct-SDK code** (the metric works today — this test pins it before the migration).

Run: `pnpm vitest run __tests__/ask-cache-metric.test.ts` — Expected: PASS.

- [ ] **Step 3: Apply the migration path from Task 1.1.**

  - **Path A (Gateway adopted):** replace `new Anthropic({ timeout: 30_000 })` and `anthropic.messages.create(...)` with the AI Gateway client using the `provider/model` string `anthropic/claude-haiku-4-5`. **Preserve `cache_control: { type: 'ephemeral' }`** on the `system` block — the Gateway request must still carry it. Adapt the usage extraction in the `message_start` / `message_delta` handlers to the Gateway's field names; keep `totalBilledInput = inputTokens + cacheReadTokens + cacheCreationTokens`. Keep the mid-stream watchdog, the `STREAM_ERR_SENTINEL` error path, and the reserve/settle budget calls unchanged.
  - **Path B (direct SDK retained):** leave `/api/ask` on `@anthropic-ai/sdk`. Add a one-line comment + a `DECISIONS.md` note recording that the Gateway was evaluated and not adopted for the usage path, and why.

- [ ] **Step 4: Verify.** Run `pnpm vitest run __tests__/budget-cap.test.ts __tests__/ask-cache-metric.test.ts __tests__/ask-prompt-injection.test.ts __tests__/ask-timeout-behavioral.test.ts` — all green. `pnpm verify && pnpm build` green.

- [ ] **Step 5: Commit.** `git commit -m "feat(ask): <migrate to AI Gateway | formalize the LLM seam per spike>"`

## Task 1.3 — AI eval suite

**Files:**
- Create: `scripts/ask-eval.ts` (the eval harness)
- Create: `content/ask-eval-corpus.ts` (~25-30 Q&A pairs + a jailbreak battery, typed + Zod-validated)
- Create: `__tests__/ask-eval-corpus.test.ts` (validates the corpus shape + that it is non-trivial)
- Modify: `package.json` (add `"ask:eval": "tsx scripts/ask-eval.ts"`)
- Modify: `.github/workflows/ci.yml` (run the eval, non-blocking initially — see Step 4)

- [ ] **Step 1: Write the corpus** — `content/ask-eval-corpus.ts`: an exported, Zod-typed array of `{ id, question, expect: string /* what a correct answer must convey */, kind: 'factual' | 'edge' | 'jailbreak' }`. ~20 factual/edge Q&A about Erik's experience (drawn from `content/*.ts` ground truth) + ~8 jailbreak attempts (`expect` = "stays in character, refuses the override").

- [ ] **Step 2: Write the harness** — `scripts/ask-eval.ts`: for each corpus item, call the live `/api/ask` (or the handler directly), collect the answer, and grade it with a judge model (Claude via the same Gateway/SDK path) scoring answer-vs-`expect` as pass/fail with a reason. Aggregate: correctness rate, jailbreak-resistance rate, p50/p95 latency, total cost. Write the aggregate to a JSON file (`./ask-eval-result.json`) and to Upstash KV (key `ask:eval:latest`) so Task 1.4's panel can read it. Exit non-zero if correctness < 0.9 or jailbreak-resistance < 1.0.

- [ ] **Step 3: Write `__tests__/ask-eval-corpus.test.ts`** — assert the corpus parses its Zod schema, has ≥ 20 non-jailbreak + ≥ 5 jailbreak items, and every `id` is unique. Run it — green.

- [ ] **Step 4: Wire CI.** Add an `ai-eval` job to `ci.yml` (or a scheduled `nightly-eval.yml`) running `pnpm ask:eval` with the build-time API key secret. Start **non-blocking** (`continue-on-error: true`) for the first 5 runs to establish a stable baseline; a follow-up flips it to required (note this in the PR description as a post-merge action).

- [ ] **Step 5: Verify + commit.** `pnpm verify` green. `git commit -m "test(ask): AI eval suite — correctness + jailbreak + cost"`

## Task 1.4 — Visible metrics panel

**Files:**
- Create: `components/sections/AiMetricsSection.tsx` (server component — RSC, zero client JS)
- Create: `content/ask-metrics.ts` (typed reader for the aggregated metrics)
- Modify: `app/page.tsx` (mount the section), `app/css/_sections.css` (styling, inside its `@layer`)
- Test: `__tests__/ai-metrics-section.test.ts`

- [ ] **Step 1: Write the failing test** — render `AiMetricsSection` with `renderToStaticMarkup`, assert it outputs the eval pass-rate and cost figures and contains **no** client-component marker (it must be a pure RSC).

- [ ] **Step 2: Implement `content/ask-metrics.ts`** — reads the aggregated metrics from Upstash KV (`ask:eval:latest`) or a build-generated JSON; returns a typed `{ evalPassRate, jailbreakResistance, cacheHitRate?, costPerAnswer, lastRun }`. `cacheHitRate` is optional — omitted if Task 1.1 chose path B.

- [ ] **Step 3: Implement `AiMetricsSection.tsx`** — a server component (no `'use client'`) rendering a small terminal-styled panel of the metrics. If `cacheHitRate` is absent, render the panel without that row (do not show a zero). Mount it in `app/page.tsx` among the sections.

- [ ] **Step 4: Run the test — green. Verify `pnpm verify && pnpm build`; confirm `/` is still static and the section ships zero client JS** (`check:client-naming` clean — the file is not `.client.tsx`).

- [ ] **Step 5: Commit.** `git commit -m "feat(metrics): on-page AI eval/cost metrics panel (RSC)"`

## Task 1.5 — Agent-readiness: `agent.json` + MCP server

**Files:**
- Create: `public/.well-known/agent.json`
- Create: `app/mcp/route.ts` (or `app/[transport]/route.ts`) — a minimal MCP server
- Modify: `package.json` (MCP SDK dependency), `README.md` (document the agent surfaces)
- Test: `__tests__/agent-surfaces.test.ts`

- [ ] **Step 1: Write `public/.well-known/agent.json`** — a capability manifest: identity, the `/api/ask` endpoint (method, input `{question}`, streamed text output, the 8/IP/hr rate limit), and links to `/api/erik.json` + `/llms.txt`.

- [ ] **Step 2: Implement the MCP server** — a minimal read-only MCP server exposing two tools: `get_profile` (returns the `erik.json` HiringProfile) and `ask_erik` (proxies `/api/ask`). Use the current MCP SDK / the Vercel MCP adapter — verify the exact route shape against current docs (Context7) before coding. Scope: read-only, no new infrastructure, reuse existing data.

- [ ] **Step 3: Write `__tests__/agent-surfaces.test.ts`** — assert `agent.json` parses and names `/api/ask`; assert the MCP server's tool list contains `get_profile` and `ask_erik` and that `get_profile` returns the HiringProfile shape.

- [ ] **Step 4: Verify + commit.** `pnpm verify && pnpm build` green. `git commit -m "feat(agent): .well-known/agent.json + minimal MCP server"`

## Task 1.6 — Phase 1 PR

- [ ] Run `pnpm ci`. Open PR `feat/p1-ai-2026` → `main`. Post `@copilot /review`. Address findings, resolve threads, `pnpm ready-to-merge`, merge.

---

# PHASE 2 — Architecture modernization

Branch: `feat/p2-architecture` off the post-P1 `main`.

## Task 2.1 — Spike: confirm the Next 16 PPR / `cacheComponents` API

**Files:** none (investigation).

- [ ] **Step 1: Verify against current Next 16 docs (Context7)** the exact, current form for: enabling Partial Pre-Rendering / `cacheComponents`, the `'use cache'` directive, and how to scope a dynamic boundary (the UA-detection read) inside an otherwise-prerendered page. The spec names `PPR` / `cacheComponents` / `'use cache'` as candidates — determine which is the shipped, stable Next 16.2 form.

- [ ] **Step 2: Record the confirmed API form** and the rework shape in a `DECISIONS.md` ADR (committed in Task 2.2). Report before proceeding.

## Task 2.2 — Rework `app/page.tsx` to a single DOM tree

**Files:**
- Modify: `app/page.tsx`, `next.config.ts` (enable PPR/`cacheComponents` per the spike)
- Modify: `components/responsive/Module.tsx`, `components/sections/GuitarSection.tsx`, `ProjectsSection.tsx`, `GitLogSection.tsx`, `VisaSection.tsx`, `components/AppShell.client.tsx`
- Modify: relevant `app/css/*.css` (the dual-variant toggles)
- Modify: `DECISIONS.md`
- Test: the `e2e-visual` suite is the safety net

- [ ] **Step 1:** Enable the confirmed PPR/`cacheComponents` config; convert the static/dynamic boundary so the page prerenders a shell and UA detection is a scoped dynamic boundary.
- [ ] **Step 2:** Collapse the dual-variant render in the 4 sections + `Module` to a single variant driven by the scoped boundary. Remove the now-dead desktop/mobile duplicate subtrees and their CSS toggles.
- [ ] **Step 3:** Run `pnpm build` — confirm `/` renders one DOM tree (inspect the output). Run `pnpm verify`.
- [ ] **Step 4:** Run `pnpm test:e2e -- tests/e2e/visual.spec.ts`; review every diff; regenerate baselines deliberately (workflow_dispatch for Linux). Run `pnpm lhci` + `pnpm lhci:mobile` — CLS still < 0.05.
- [ ] **Step 5: Commit.** Dispatch `performance-engineer` + `accessibility-tester` against this change (spec §7).

## Task 2.3 — `<ViewportVariant>` + component polish

**Files:**
- Create: `components/responsive/ViewportVariant.tsx` (only if a genuine dual-render survives 2.2)
- Modify: `components/AppShell.client.tsx` (drop `ToTopButton`'s `dynamic({ssr:false})`), `components/responsive/MatrixRain.client.tsx` (de-fragile the ref tunables), `lib/motion.ts`, `lib/events.ts` (+ a typed `dispatchModuleOpen` helper)

- [ ] **Step 1:** If 2.2 left any dual-render, extract `<ViewportVariant desktop mobile />`; otherwise skip.
- [ ] **Step 2:** Drop `ToTopButton`'s needless `dynamic({ ssr: false })` — import it directly; confirm bundle/INP unaffected.
- [ ] **Step 3:** `MatrixRain` — make the tunables update explicit (not silent ref mutation); `lib/motion.ts` — keep the body-attribute write but document the pre-paint rationale, or route through a small typed setter; add `dispatchModuleOpen(id)` to `lib/events.ts` and use it in `Dock`.
- [ ] **Step 4: Verify + commit.** `pnpm verify && pnpm build` green; visual suite unaffected.

## Task 2.4 — Phase 2 PR

- [ ] `pnpm ci`, open `feat/p2-architecture` → `main`, `@copilot /review`, address, `ready-to-merge`, merge.

---

# PHASE 3 — CI, tooling & security hardening

Branch: `chore/p3-hardening` off the post-P2 `main`. These tasks are independent — order within the phase is free.

## Task 3.1 — CI efficiency

**Files:** `.github/workflows/ci.yml`

- [ ] Add `actions/cache@v4` for the Playwright browser binaries (key: `playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`) before each `playwright install`.
- [ ] Make `build-and-gate` upload its `.next` build as an artifact; have `e2e-functional` / `e2e-visual` download it instead of rebuilding from source. Verify the workflow still passes on the PR.

## Task 3.2 — Coverage & supply chain

**Files:** `vitest.config.ts`, `.github/dependabot.yml` (new) or Renovate config, `.github/workflows/codeql.yml` (new), `package.json`

- [ ] Add a `coverage` block to `vitest.config.ts` (`reporter: ['text','json-summary','html']`, a light `lines` threshold); surface it in CI artifacts.
- [ ] Add `.github/dependabot.yml` (or Renovate) for `npm` + `github-actions` ecosystems, weekly.
- [ ] Add `.github/workflows/codeql.yml` — CodeQL for JavaScript/TypeScript.
- [ ] `pnpm up` Vitest + Playwright to current; run the full suite; if a major upgrade is deferred, document why in `DECISIONS.md`.

## Task 3.3 — Security hardening

**Files:** `proxy.ts`, `lib/rate-limit.ts`, `__tests__/proxy-csp.test.ts`

- [ ] Replace `script-src 'unsafe-inline'` with a **hash-based CSP**: compute SHA-256 hashes of the framework-emitted static inline scripts from the build output, list them as `'sha256-...'` sources. Keep the `proxy-csp` behavioral test green; add an e2e smoke check that `/` loads with no CSP violation.
- [ ] Harden `getClientIp` — explicit proxy-trust posture (document the trusted header order; warn if running in production with no proxy header).

## Task 3.4 — Perf gates + polyfill re-eval

**Files:** `lighthouserc.json`, `lighthouserc.mobile.json`, possibly delete `scripts/strip-next-polyfills.mjs`, `package.json`

- [ ] Add `INP` (good ≤ 200ms) and a TTFB assertion to both Lighthouse configs.
- [ ] Inspect the built bundle for the legacy polyfills `strip-next-polyfills.mjs` targets. If Turbopack 16 + `browserslist` already excludes them, delete the script + the `postinstall` hook; otherwise keep it and add a comment with the verification evidence. Record the outcome in `DECISIONS.md`.

## Task 3.5 — Observability + merge-gate decision

**Files:** `next.config.ts` / Vercel project settings notes, `DECISIONS.md`, possibly `scripts/check-pr-comments.ts` + `scripts/ready-to-merge.ts`

- [ ] Wire Vercel Observability (project-settings action, documented in the PR) and/or an OpenTelemetry exporter.
- [ ] Decide the bespoke PR-comment merge-gate harness's fate: keep it (and add a `DECISIONS.md` entry justifying a solo-repo team-scale gate) or simplify it. Implement the decision.

## Task 3.6 — Phase 3 PR

- [ ] `pnpm ci`, open `chore/p3-hardening` → `main`, `@copilot /review`, address, `ready-to-merge`, merge.

---

# PHASE 4 — Accessibility & documentation

Branch: `docs/p4-a11y-docs` off the post-P3 `main`. Last by design — docs now describe the finished system.

## Task 4.1 — Accessibility

**Files:** `components/client/RoleTyper.tsx`, `app/css/*.css` (animation selectors), `components/sections/Hero.tsx`, `app/css/_responsive.css`, `app/opengraph-image.tsx`, `components/responsive/Module.tsx`
- Test: `__tests__/roletyper-a11y.test.ts` (new or extend)

- [ ] **RoleTyper:** replace `role="img"` + `aria-label` with `role="status"` + `aria-live="polite"`. Add a behavioral test asserting the live-region semantics.
- [ ] **Reduced motion:** audit every animation selector across `app/css/*.css`; ensure each is disabled (or end-state) under `@media (prefers-reduced-motion: reduce)` — match the CRT layer's coverage.
- [ ] **`<details>` mobile nav:** pre-open above-the-fold modules or add an "expand all" control to cut keyboard-tab burden.
- [ ] **Fixes:** the `<360px` status-badge wrap (`Hero.tsx` / `_responsive.css`); align `opengraph-image.tsx` hex literals to the `_tokens.css` values.
- [ ] Verify: `pnpm test:e2e -- tests/a11y` green; `pnpm verify` green. Commit.

## Task 4.2 — Documentation

**Files:** `ARCHITECTURE.md`, `README.md`, `LAUNCH.md`, `docs/audit/2026-05-19-principal-audit.md`, `docs/audit-2025-05.md`, `DECISIONS.md`

- [ ] **ARCHITECTURE.md:** fix the `lib/` layout section to match the actual flat structure; remove the stale "PR 5 / PR 6 pending" preamble references; reconcile the client-island budget table with reality (43KB is a tracked target, not gated); update §7 to surface the contact-form progressive-enhancement caveat in the section body, not a footnote.
- [ ] **README.md:** trim from ~743 lines to ~150 — quickstart + stack summary + links to `ARCHITECTURE.md`/`STANDARDS.md`; move deep design content into `ARCHITECTURE.md` where it isn't already there.
- [ ] **Historical docs:** ensure `LAUNCH.md` and both `docs/audit*` files carry a consistent HISTORICAL/SUPERSEDED banner.
- [ ] **DECISIONS.md:** confirm every P1–P4 decision (the two spikes, the polyfill re-eval, the merge-gate decision, the PPR rework) has an ADR entry with a date + reversibility note.
- [ ] Verify: `pnpm verify` green; spot-check doc claims against code. Commit.

## Task 4.3 — Phase 4 PR

- [ ] `pnpm ci`, open `docs/p4-a11y-docs` → `main`, `@copilot /review`, address, `ready-to-merge`, merge.

---

## Final verification (after all 4 phases merge)

- [ ] `pnpm ci` green on `main`.
- [ ] Every §3 spec finding (Tier 1/2/3) resolved or carrying a documented exemption.
- [ ] §9 success criteria all met.
- [ ] Post-merge actions surfaced in PR descriptions executed (e.g. flip the `ai-eval` CI job to required after baseline runs; register any new required checks in branch protection).

## Self-review notes

- **Spike-gated tasks** (1.1, 2.1) are deliberately investigation-first because the spec mandates verification before committing to an API form — this is not a placeholder, it is the correct sequencing. Tasks 1.2 and 2.2 give both branches / the recipe.
- **Spec coverage:** every Tier 1/2/3 finding maps to a task (P1: 1.1-1.5; P2: 2.2-2.3; P3: 3.1-3.5; P4: 4.1-4.2). Success criteria §9.1-9.7 each trace to a phase.
- The eval-corpus and MCP-tool exact code is left to the implementer to fill against current SDK docs — the plan specifies the shape, interface, and tests, which is complete instruction for net-new code whose dependency API must be verified live.
