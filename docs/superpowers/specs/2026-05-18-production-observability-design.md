# Production Observability

> **Spec 2 of 3** in the post-audit harness trilogy.
> Sibling to `2026-05-18-gates-and-harness-hardening-design.md` (Spec 1, shipped via PR #9) and `2026-05-18-llm-provider-abstraction-design.md` (Spec 3, not yet started).
>
> **Author:** Erik Henrique Alves Cunha
> **Date:** 2026-05-18
> **Status:** Draft (pending architect-reviewer four-gate)
> **Source:** 8-pillar production-harness audit, this session, Pillar 7 (Flywheel) findings.

---

## 1. Purpose

Close the audit's Pillar 7 (Flywheel) gaps. The site today is enforced at build time but invisible at runtime:

- The whole perf budget is verified only against synthetic Lighthouse. Real-user INP could be 600ms and nobody would know.
- Client-side exceptions (e.g., the hydration mismatch surfaced in this session's dev console) go silent in production.
- `/api/ask` responses stream once and vanish; there's no retrospective audit of what the LLM said about Erik.
- The questions users actually ask are unmeasured — zero signal for system-prompt iteration.
- Server logging is bare `console.error`/`info` with no correlation IDs, no levels, no structured fields.

This spec converts the existing build-time rigor into a single runtime feedback loop covering real-user CWV, exception capture, and LLM output retention — without introducing a new SaaS vendor or breaking the project's "platform-native first" posture.

---

## 2. Scope

### In scope (four concerns across three implementation phases)

| Phase | Items | Pillar | Primary surface |
|---|---|---|---|
| 1 | **Browser RUM** — re-add `@vercel/analytics` + `@vercel/speed-insights`, mount in `app/layout.tsx`, widen CSP for Vercel ingest endpoints | 7 — Flywheel | `app/layout.tsx`, `package.json`, `proxy.ts` |
| 2 | **Structured-logging foundation** — `lib/log.ts` wrapping `pino` (server-only); migrate 11 enumerated `console.*` sites in `lib/` + `app/api/`; correlation-ID propagation via AsyncLocalStorage in middleware | 7 — Flywheel | `lib/log.ts` (new), `proxy.ts`, `lib/rate-limit.ts`, `lib/lighthouse-scores.ts`, `app/api/ask/route.ts`, `app/api/contact/route.ts` |
| 3 | **Error tracking + `/api/ask` Q+A logging** — `app/api/log/route.ts` accepts structured client errors into Upstash KV (`err:{yyyy-mm-dd}:{uuid}`, 30-day TTL); client-side bridge (ErrorBoundary + window handlers); `/api/ask` persists `{Q+A+meta}` to Upstash KV (`ask:log:{yyyy-mm-dd}:{requestId}`, 90-day TTL); new `/api/ask/forget` GDPR/LGPD erasure endpoint | 7 — Flywheel (enables future Pillar 3 work, but capture ≠ judgment) | `app/api/log/route.ts` (new), `app/api/log/forget/route.ts` (new), `lib/error-bridge.ts` (new), `lib/ask-log.ts` (new), `components/ErrorBoundary.client.tsx`, `components/AppShell.client.tsx`, `components/sections/ShellSection.tsx` or wherever the `/api/ask` form lives (privacy notice), `app/api/ask/route.ts` |

### Out of scope

- **Auto-memory under-utilization** (Pillar 7 audit finding) — that's about Claude session behavior, not deployed-site observability. Belongs in a separate operating-habits doc.
- **Dashboards / UI for inspecting logs** — Upstash console + Vercel CLI are the inspection surfaces. A `/internal/dashboard` route would be its own spec.
- **Spec-rot CI gate** — deferred to its own spec (audit follow-up).
- **Spec 1.5 Mobile LHCI gate** + Spec 3 LLM Provider Abstraction — separate trilogy specs.

### Anti-goals (explicit non-goals)

- Will **not** add Datadog / NewRelic / LaunchDarkly (per `ARCHITECTURE.md §9` explicit "what I deliberately don't do").
- Will **not** use Sentry — chose custom Upstash endpoint instead (clarifying Q2 decision; rationale: zero new vendor, fits existing infra, ~50 LoC).
- Will **not** add a client-side observability bundle larger than 5KB gzip total. Phase 1 adds ~3KB (Vercel SDKs); Phase 3 client bridge adds ~0.5KB. Plenty of headroom.
- Will **not** log unbounded responses from `/api/ask` — truncation at 500 chars Q / 1000 chars A is a privacy + KV-cost guardrail.
- Will **not** propagate sensitive payloads (contact form name/email/message bodies) into structured logs — only the existing `msgId` reference.

---

## 3. Notable deviation from architectural lock-in

`pino` as a server-side dependency sits adjacent to the spirit of `DECISIONS.md` 2026-05-18 "no extra PostCSS plugins beyond what Lightning CSS provides natively." The user explicitly chose pino over a custom thin wrapper at brainstorming. Justification:

- That lock-in was specifically about CSS-pipeline tooling. Server-side logging is a different domain.
- pino is server-only — the ~30KB cost doesn't touch the 43KB client island budget.
- Battle-tested correlation-ID + JSON output patterns are worth more than 80 LoC of bespoke code at this stage.

A new DECISIONS.md bullet captures this explicitly so future readers see it as a deliberate informed choice rather than spec drift.

---

## 4. Reversibility profile

Each phase is single-commit-revertable. No data migrations beyond opt-in writes to existing Upstash; existing KV data is untouched.

| Phase | Reversal |
|---|---|
| 1 | Revert `layout.tsx` mounts + `package.json` removals + `proxy.ts` CSP edit |
| 2 | Revert `lib/log.ts`; restore the 11 `console.*` call sites (mechanical reverse) |
| 3 | Delete `app/api/log/route.ts`; remove client bridge from `ErrorBoundary.client.tsx` + `AppShell.client.tsx`; remove the Q+A KV write from `/api/ask/route.ts` |

---

## 5. Phase 1 — Browser RUM

**Pillar:** 7 (Flywheel).
**Outcome:** Real-user Core Web Vitals (LCP, INP, CLS) + pageview counts flow to Vercel dashboards on every visit.

### What

- Re-add `@vercel/analytics@latest` and `@vercel/speed-insights@latest` to runtime dependencies (both were declared and silently removed in commit `ad5b58c` earlier this session because they were never imported; this spec re-introduces them with actual mounts).
- Mount `<Analytics />` and `<SpeedInsights />` in `app/layout.tsx`'s `<body>` (after `{children}`).
- Widen CSP `connect-src` in `proxy.ts` to allow `https://*.vercel-insights.com` and `https://va.vercel-scripts.com`.

### Where

- **`package.json`** — add `"@vercel/analytics": "latest"` and `"@vercel/speed-insights": "latest"` to `dependencies`.
- **`pnpm-lock.yaml`** — regenerated.
- **`app/layout.tsx`** — `+2 imports` and `+2 JSX elements` at the bottom of `<body>`:
  ```tsx
  import { Analytics } from '@vercel/analytics/next';
  import { SpeedInsights } from '@vercel/speed-insights/next';
  // ...
  <body>
    {children}
    <Analytics />
    <SpeedInsights />
  </body>
  ```
- **`proxy.ts`** line ~18 — extend `connect-src` from `"connect-src 'self' https://api.anthropic.com"` to `"connect-src 'self' https://api.anthropic.com https://*.vercel-insights.com https://va.vercel-scripts.com"`.

### Failure mode

Vercel ingest is rate-limited at the platform level. If ingest is unreachable, the SDK fails silently (no client-side error). Acceptable — analytics outage does not degrade UX.

### Edge case

Visitors with ad-blockers (uBlock, Brave shields, etc.) block these endpoints. Sample coverage will be ≤100%. The hiring pitch is "real-user data trends," not "100% population." `ARCHITECTURE.md §9` documents the expected coverage band (~70-85% of visits).

### Client bundle impact

~1KB gzip (Analytics) + ~2KB gzip (Speed Insights) = ~3KB added to the 43KB client islands budget. Verified via `bundle-check` CI gate.

---

## 6. Phase 2 — Structured-logging foundation

**Pillar:** 7 (Flywheel).
**Outcome:** Every server-side log line is JSON in production with consistent fields. Correlation IDs propagate across the entire request lifecycle without per-call boilerplate.

### What

New `lib/log.ts` (~50 LoC) wraps `pino`:

```ts
// public surface
export const log: {
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
};
```

**Correlation-ID strategy (architect-review-corrected):** explicit-parameter passing, NOT AsyncLocalStorage. Each route handler generates a `requestId` at the top (via `crypto.randomUUID()`) and passes it as the first `ctx.requestId` field on every `log.*` call inside that handler. The 11 call-site migrations enumerated below include the `requestId` parameter where the call is request-scoped.

Earlier draft of this spec proposed AsyncLocalStorage with the Next middleware wrapping every request in `withRequestContext(...)`, requiring an opt-out of Edge runtime (`export const config = { runtime: 'nodejs' }`). Rejected after architect-review:

- Vercel Node middleware cold-starts are ~50-150ms vs Edge's ~5-20ms.
- That 30-130ms TTFB hit feeds directly into LCP, which is currently 70% over target on mobile (PR #10's calibration evidence).
- Opting middleware out of Edge while another sibling PR is actively fighting LCP is risk-stacking.
- Explicit-parameter passing is mechanical (5 call sites that need correlation), keeps Edge runtime, costs nothing.

If mobile LCP closes under target (PR #10 + Spec 1.5 land green), a follow-up spec can revisit ALS opt-in as a quality-of-life upgrade. Until then, explicit threading is the right trade.

pino config:
- `process.env.NODE_ENV === 'production'` → JSON line output (Vercel-parseable)
- dev → `pino-pretty` formatter (human-readable)
- base fields auto-added by pino: `{ ts, level, env }`. `requestId` is appended per call via `ctx`.

### Where (call-site migration plan)

Migrate exactly 11 `console.*` call sites:

| File | Line | Current | Becomes |
|---|---|---|---|
| `lib/rate-limit.ts` | 60 | `console.warn('[ask] budget at ${pct}% — approaching cap')` | `log.warn('budget approaching cap', { pct })` |
| `lib/rate-limit.ts` | 64 | `console.error('[ask] budget check failed...', err)` | `log.error('budget check failed', { err })` |
| `lib/rate-limit.ts` | 79 | `console.error('[ask] budget increment failed', err)` | `log.error('budget increment failed', { err })` |
| `lib/lighthouse-scores.ts` | 73 | `console.error('[lighthouse] PSI fetch failed:', err)` | `log.error('PSI fetch failed', { err })` |
| `lib/lighthouse-scores.ts` | 80 | `console.error('[lighthouse] Redis set failed:', err)` | `log.error('Redis cache set failed', { err })` |
| `app/api/ask/route.ts` | 16 (the Spec 1 cold-start log) | `console.info('[ask] kill-switch on cold start:', ...)` | `log.info('kill-switch on cold start', { askEnabled: process.env.ASK_ENABLED ?? 'unset' })` |
| `app/api/contact/route.ts` | 52 | `console.error('[contact] KV write failed', kvErr)` | `log.error('KV write failed', { msgId, err: kvErr })` |
| `app/api/contact/route.ts` | 66 | `console.error('[contact] resend error...')` | `log.error('Resend error', { msgId, err: error })` |
| `app/api/contact/route.ts` | 75-82 (the Spec 1 fix-up that distinguishes timeout vs failure) | `console.error('[contact] resend unavailable...')` | `log.error('Resend unavailable', { msgId, reason, err: sendErr })` |
| `components/ErrorBoundary.client.tsx` | 27 | `console.error('[ErrorBoundary] client island crashed:', error, info.componentStack)` | **Kept as `console.error`** — client-side; gets bridged separately in Phase 3 |

### Add dependencies

- `pino` (runtime, server-only) — `latest`, ~30KB minified, no client bundle impact.
- `pino-pretty` (devDependency) — for dev formatting.

### Failure mode

pino's transport layer can fail (e.g., file-system if configured). With Vercel runtime logs as the sink (stdout JSON), failures are limited to `JSON.stringify` edge cases (circular refs); pino has built-in handling for these.

### Edge case

`proxy.ts` continues to run in Edge runtime; no opt-out. The earlier draft of this spec proposed opting middleware out of Edge to enable AsyncLocalStorage; rejected at architect-review (see Correlation-ID strategy above). With explicit-parameter passing, Edge stays Edge, cold starts stay ~5-20ms, and request-scoped `requestId` is generated at the top of each route handler and threaded explicitly through `log.*` ctx parameters at the few call sites that need it.

---

## 7. Phase 3 — Error tracking + `/api/ask` Q+A logging

**Pillar:** 7 (Flywheel). *Enables future Pillar 3 (Juiz) work* by persisting the data a future evaluation/scoring loop would consume — capture is not judgment, so this spec does not claim Pillar 3 attribution directly.
**Outcome:** Client exceptions persist to Upstash for retrospective triage. `/api/ask` interactions are auditable for 90 days.

### 7a. Custom error endpoint — `app/api/log/route.ts`

- POST handler accepts `{ level: 'error'|'warn', message, stack?, url?, userAgent?, ts? }`.
- Validates shape via lightweight zod schema (zod is already a runtime dep).
- Hashes IP via existing `getClientIp` + SHA-256 + DEPLOY_SALT (same pattern as `/api/contact`).
- Writes to Upstash KV: `err:{yyyy-mm-dd}:{uuid}` with 30-day TTL.
- Returns `{ ok: true }` 204 on success; 400 on validation fail; 503 on KV unreachable (fail-open — never block the user's page on error reporting).
- Rate-limited (10 errors/IP/minute) via existing `getContactLimit`-style Upstash Ratelimit primitive (new `getErrorLogLimit()` factory in `lib/rate-limit.ts`).

**Debug-affordance note (architect-review steel-man for Sentry):** raw stack traces from production are minified by Next's build output. The Sentry comparison: Sentry's source-map upload + symbolication produces readable stacks; the custom endpoint stores raw minified frames. To close this debug gap without adopting Sentry, Vercel's deployment pipeline already retains source maps for the current and previous deploys; the post-merge ops checklist (§9b item 5, added in this revision) includes a step to manually symbolicate a captured stack via Vercel's source maps if a real production error needs deeper triage. If this manual step becomes a recurring pain point, a future spec can add a small `/internal/symbolicate` route that does it on demand.

### 7b. Client-side bridge

Extends existing `components/ErrorBoundary.client.tsx`:
- `componentDidCatch` posts to `/api/log` with `{ level: 'error', message, stack, url: window.location.href, userAgent: navigator.userAgent }`. Existing `console.error` retained for dev visibility.

New `lib/error-bridge.ts` (client-only, ~50 LoC, ~0.5KB gzip):
- `'use client'` at the top.
- Registers `window.addEventListener('error', handler)` and `window.addEventListener('unhandledrejection', handler)` at module scope.
- Dedupes within a **100ms tail window** keyed on `{message, stack}`: first occurrence emits immediately, subsequent identical occurrences within 100ms are suppressed. React's error replay typically fires the same error 2-3 times within ~50ms during reconciliation; a 100ms window covers that without suppressing unrelated re-occurrences of the same error class later in the session. Earlier draft proposed a 5-second window — rejected after architect-review as unjustified and likely to suppress meaningful repeat-occurrence signal (e.g., a flaky network call that errors on every retry).
- Imported once from `components/AppShell.client.tsx` so the listeners install on every page.

### 7c. `/api/ask` Q+A persistence (with GDPR/LGPD right-of-erasure affordance)

Inside the existing POST handler in `app/api/ask/route.ts`, after the stream completes (alongside the existing `incrementBudget` fire-and-forget call):

```ts
const requestId = crypto.randomUUID();
// ...stream completes here; collectedAnswerText accumulated up to 1000 chars
// Fire-and-forget; never blocks the response
void persistAskInteraction({
  requestId,
  ts: new Date().toISOString(),
  ipHash, // computed via existing helper
  question: question.slice(0, 500),
  answer: collectedAnswerText.slice(0, 1000),
  inputTokens,
  outputTokens,
  durationMs: Date.now() - startedAt,
  status: 'completed' | 'errored' | 'rate-limited' | 'killed' | 'budget-exhausted',
});
```

The response includes an `X-Request-Id: <requestId>` header so the requester can find their persisted record (visible in DevTools Network tab). `persistAskInteraction` lives in new `lib/ask-log.ts`. KV key: `ask:log:{yyyy-mm-dd}:{requestId}`, 90-day TTL. Status enum captures the five terminal states the handler can take.

Answer collection: the existing stream loop in `route.ts` already accumulates `outputTokens`. Extend the same loop to also accumulate streamed text into a `collectedAnswerText` string (capped at 1000 chars to avoid memory bloat on long answers — defense in depth since `max_tokens: 512` already limits at Anthropic-token level).

### 7d. `/api/ask/forget` — GDPR/LGPD right-of-erasure endpoint (architect-review-required)

Storing user free-text questions + IP hash + timestamp creates derivative-identifiable data. GDPR Art. 17 and LGPD Art. 18 require a right-of-erasure mechanism. The earlier draft of this spec offered only a "queries are stored 90 days" notice; rejected after architect-review as insufficient.

**New endpoint:** `app/api/log/forget/route.ts` (lives next to the error endpoint for locality). POST handler accepts `{ requestId: string }`. Looks up `ask:log:{yyyy-mm-dd}:{requestId}` across the last 90 days of date-prefix candidates (cheap: 90 GETs against existing key pattern, OR use an Upstash `SCAN` with the request-ID suffix). DELETEs any match. Returns `{ ok: true, deleted: <count> }` 200 on success; `{ ok: true, deleted: 0 }` 200 if no record exists (idempotent); 400 on validation; 503 on KV unreachable.

**UI affordance:** the `/api/ask` form gets a single-line privacy notice below the submit button:

> Queries are stored for 90 days for product improvement. Email `erikhenriquealvescunha@gmail.com` with your request ID (in response headers) to request deletion at any time, or POST the ID to `/api/ask/forget`.

The endpoint is rate-limited (5/IP/hour via a new `getForgetLimit()` factory in `lib/rate-limit.ts`) to prevent abuse (e.g., enumeration attacks against random requestIds). UUIDv4 collision space (~5.3e36) makes brute-force enumeration computationally infeasible regardless.

### Why preserve question text (not drop it entirely)

Architect-review offered as alternative: drop question/answer text entirely; store only meta `{requestId, ts, ipHash, tokens, durationMs, status, questionLength, answerLength}`. Considered and rejected here: the brainstorming-stage decision (clarifying Q3) explicitly chose Q+A capture for two named values — (1) retrospective audit of what Haiku says about Erik, (2) product learning on what users actually ask. Meta-only loses both. The forget-endpoint mechanism preserves the chosen value while adding regulatory compliance. Cost is one additional ~30-line endpoint + UI line; benefit is keeping the original chosen value intact.

### Failure mode

All KV writes are fire-and-forget with try/catch logging. Storage outage degrades observability silently; never blocks user requests.

### Edge case

Prompt injection attempts where users paste 50KB of text into the question. Truncation at 500 chars on the question side handles this cleanly. Answer truncation at 1000 chars handles unusually long Haiku responses (rare with `max_tokens: 512` already capping; defense in depth).

---

## 8. Testing strategy

| Phase | Test surface | Test type | Location |
|---|---|---|---|
| 1 | Source-grep: `layout.tsx` imports `Analytics` and `SpeedInsights`; both elements appear in JSX; `package.json` has both runtime deps; `proxy.ts` CSP `connect-src` includes the two Vercel ingest origins | Vitest unit | new `__tests__/browser-rum.test.ts` |
| 2 | Source-grep: `lib/log.ts` exists and exports `log`; imports pino; all 11 enumerated migrations complete (assert via per-site regex); each route handler that needs correlation initialises a `requestId` at the top and threads it through `log.*` ctx; the ErrorBoundary `console.error` is the ONLY remaining `console.*` in `lib/` + `app/api/` + that one client file | Vitest unit | new `__tests__/log-structured.test.ts` |
| 3a | Source-grep: `app/api/log/route.ts` exists with POST handler; validates shape via zod; uses `err:` KV prefix + 30-day TTL constant; rate-limits via new `getErrorLogLimit()` factory | Vitest unit | new `__tests__/api-log-shape.test.ts` |
| 3b | Source-grep: `lib/error-bridge.ts` exists; `'use client'`; registers both `error` + `unhandledrejection` listeners; dedupes within a 100ms tail window (first emit immediate, identical within 100ms suppressed); imported once from `AppShell.client.tsx`; `ErrorBoundary.client.tsx` componentDidCatch POSTs to `/api/log` | Vitest unit | extend `__tests__/api-log-shape.test.ts` |
| 3c | Source-grep: `lib/ask-log.ts` exports `persistAskInteraction` with the 9-field shape; KV key `ask:log:{yyyy-mm-dd}:{requestId}` + 90-day TTL; `app/api/ask/route.ts` calls `persistAskInteraction` after stream completion; answer text accumulator caps at 1000 chars | Vitest unit | new `__tests__/ask-log-persistence.test.ts` |
| All | **Post-deploy verification:** Vercel dashboard shows analytics events landing within 5 min of merge; Upstash console shows new `err:` and `ask:log:` keys after manual triggers; Vercel runtime log stream emits JSON lines (not plain console output) for any new request | Manual | n/a |

**Explicit non-tests:**
- No mocking of pino itself (project's source-grep pattern; behavior verified manually)
- No load test on the error endpoint (rate limit is documented; load testing is its own effort)
- No end-to-end test that an in-browser error actually reaches Upstash (the Playwright smoke in criterion 8 covers `/api/log` endpoint shape; full client→endpoint round-trip is covered by manual post-merge ops checklist)
- No test for correlation-ID propagation as a behavior (explicit-parameter passing means each call-site test in the migration table already asserts the `requestId` is present in the ctx — no separate end-to-end propagation test needed)

---

## 9. Success criteria

Binary checks; each must hold before merge.

1. CI on the implementing PR shows the standard jobs green: `build-and-gate` ✓, `lhci-mobile` (if PR #9 / Spec 1.5 has merged the mobile job to main by this point) ✓, `e2e` ✓.
2. `pnpm vitest run` → all new test files pass; pre-existing 54 tests still pass. Approximate new test count: `browser-rum` ~4 + `log-structured` ~8 + `api-log-shape` ~6 + `ask-log-persistence` ~5 ≈ 23 new = ~77 total.
3. `pnpm bundle-check` → client total still ≤ 320 KB gzip (Phase 1 adds ~3KB; Phase 3 client-side bridge adds ~0.5KB).
4. `proxy.ts` CSP `connect-src` includes the two Vercel ingest origins; no other origins added without DECISIONS.md justification.
5. `lib/log.ts` exists with the documented public surface. Migration complete: `grep -rn 'console\.' lib/ app/api/` returns zero matches (every site moved to `log.*`). `components/ErrorBoundary.client.tsx` retains its `console.error` (client-side, intentional).
6. `DECISIONS.md` has new bullets dated 2026-05-18: (a) Vercel Analytics + Speed Insights re-wired (reverses the earlier removal); (b) pino chosen over custom wrapper (deviation from the no-extra-plugins lock-in, justified); (c) custom Upstash error endpoint chosen over Sentry; (d) `/api/ask` Q+A logging shape (Q 500 chars + A 1000 chars + meta, 90-day TTL, IP-hashed).
7. `ARCHITECTURE.md §9` rewritten to reflect the new observability layer (replaces the old "Sentry frontend SDK — only if client errors become a problem" framing).
8. **CI-verifiable smoke (architect-review-required upgrade from manual checklist):** a Playwright spec in `tests/e2e/observability-smoke.spec.ts` that:
   - POSTs a synthetic error payload to `/api/log` and asserts 204 response
   - POSTs a synthetic `/api/ask/forget` request with a known requestId and asserts 200 with `{ ok: true }`
   - These two assertions exercise the Phase 3 endpoints end-to-end against a real running server (CI's existing preview server). Replaces the prior manual "operator triggers a deliberate error" criterion — the smoke runs every PR.

---

## 9b. Post-merge ops checklist (NOT success criteria)

Separate from the binary CI-enforceable success criteria above. These are one-time human actions required after merge but not pre-merge:

1. Open Vercel dashboard → Analytics + Speed Insights → verify pageview + CWV events landing within 5 minutes of the first post-merge production deploy.
2. Open Upstash dashboard → Data Browser → `SCAN err:*` and `SCAN ask:log:*` after at least one real production request; verify keys exist with expected shape.
3. Tail Vercel runtime logs after the first request → verify JSON-line format (not plain text); spot-check a `log.info` call with the expected `requestId` field.
4. Visit `/api/ask` UI in a browser → verify the privacy notice (Phase 3d) is visible below the submit button.
5. **On-demand stack symbolication (referenced from §7a).** When a captured production error in Upstash shows minified frames, the operator can pull the Vercel deployment's source maps via `vercel inspect <deploy-url> --logs` (or the Vercel dashboard's Source Maps tab) and manually symbolicate. If this manual step becomes recurring, a future spec adds an `/internal/symbolicate` route to do it on demand. Captured here to close the §7a steel-man counter cleanly without ad-hoc tooling now.

This checklist lives in the implementation PR's description so the operator knows what to verify post-merge; it is not test-enforced and does not block merge.

## 10. Risks + reversibility

| # | Risk | Likelihood | Severity | Mitigation | Reversal |
|---|---|---|---|---|---|
| R1 | Ad-blockers reduce Vercel Analytics coverage; "real-user data" claim looks aspirational | High | Low | Document expected coverage band (~70-85%) in `ARCHITECTURE.md §9`; never claim 100% population coverage in the hiring pitch | Trivial — unmount the components |
| R2 | pino dependency contradicts the "no extra plugins" architecture lock-in | Medium (already accepted) | Low | DECISIONS.md bullet captures the deviation + justification (server-only, no client bundle impact, battle-tested correlation IDs) | Trivial — `pnpm rm pino pino-pretty`; restore `console.*` |
| R3 | Explicit-parameter correlation-ID threading is forgotten at a call site, leaving the log without a `requestId` | Medium | Low | The per-site source-grep test in success criterion 5 asserts `requestId` is present in the ctx for every route-scoped `log.*` call; missing it fails the gate. Easier to forget than ALS would have been, but cheaper to catch via the existing test surface | Mechanical — add the `requestId` parameter at the missed site |
| R4 | Q+A logging captures PII users paste into the question (emails, addresses, prompt-injection bodies) | Medium | Medium (LGPD/GDPR adjacency) | Three layers: (a) truncation at 500 chars limits damage; (b) IP is hashed via existing SHA-256 + DEPLOY_SALT; (c) `/api/log/forget` endpoint (§7d) + privacy notice on `/api/ask` UI provide GDPR/LGPD Art.17/Art.18 right-of-erasure affordance. The 90-day TTL is the worst-case retention window | Trivial — flip a feature flag in the route; or have operator `SCAN ask:log:* | DEL` |
| R5 | Custom error endpoint sees an abuse spike (e.g., a script firing 10K errors/sec) → blows Upstash quota | Low | Medium | Per-IP rate limit (10/min) reuses existing primitive. Endpoint is rate-limit-protected before KV write. Worst case: rate-limit absorbs the storm at ~6000 errors/hour/IP max | Trivial — temporarily return 503 from the route |
| R6 | pino JSON output overwhelms Vercel's log buffer on high-traffic moments | Low | Low | Vercel runtime logs handle JSON line format natively. If buffer pressure surfaces, sample (log 1-in-N for `info`, always for `warn`/`error`) | Adjust sample rate in `lib/log.ts` |
| R7 | Browser RUM scripts (Vercel Analytics + Speed Insights) increase LCP by their loading cost — directly contradicting the perf-fix work in Spec 1.5 / PR #10 | Medium | Medium | Both scripts are async; SDK loads after page ready. Verify via `pnpm lhci:mobile` post-merge (calibration delta against Spec 1.5 baseline). If LCP regresses above 1800ms, defer the mount or move to a dynamic-import-after-LCP pattern | Trivial — unmount the components |
| R8 | Migration miss leaves a `console.*` call site unconverted, breaking the gate in success criterion 5 | High | Low | Drift test (Phase 2 source-grep) catches it before merge; pre-commit gate fails the PR | Mechanical fix to migrate the missed site |

**Aggregate reversibility:** each phase single-commit-revertable. No data migrations beyond opt-in writes to existing Upstash; existing KV data untouched. No schema changes. No destructive operations.

---

## 11. Implementation order

Informative for the plan-writing skill; final order may shift on dependency analysis.

1. **Phase 1 — Browser RUM.** Smallest, most independent. Validates the CSP widening pattern in isolation before Phase 3 needs a similar (smaller) widening for self-origin.
2. **Phase 2a — `lib/log.ts` foundation.** Pino wrapper + the `log.*` surface. No migration yet, no middleware change. Edge runtime preserved.
3. **Phase 2b — Migrate the 11 enumerated `console.*` call sites.** Mechanical. Each route handler that needs correlation initialises a `requestId` via `crypto.randomUUID()` at the top and threads it into `log.*` ctx parameters. Gated by the drift test in success criterion 5.
4. **Phase 3a — Custom error endpoint `app/api/log/route.ts`.** Server-side primitive ready before clients use it.
5. **Phase 3b — Client-side bridge (`lib/error-bridge.ts` + `ErrorBoundary.client.tsx` extension).** Wires the browser into the now-existing endpoint with the 100ms tail-window dedup.
6. **Phase 3c — `/api/ask` Q+A persistence + `X-Request-Id` response header.** Uses the structured-logging primitive from Phase 2.
7. **Phase 3d — `/api/log/forget` endpoint + privacy notice on `/api/ask` UI.** GDPR/LGPD right-of-erasure affordance. Depends on Phase 3c (forget needs persisted records to act on).
8. **Final cleanup commit** — Update `DECISIONS.md` (4 bullets) and `ARCHITECTURE.md §9` (replace observability section). Post-merge ops checklist (§9b) runs after merge.

---

## 12. References

- 8-pillar production-harness framework: João Lucas Moreira Tardim's "Anatomia de um Harness de Produção (Os 8 Pilares)"
- Audit findings (Pillar 7 — Flywheel): this session's output; reproduced in the dispatch brief for this brainstorm
- `CLAUDE.md` — operating contract (stack, gates, performance budgets)
- `ARCHITECTURE.md §9` — current observability strategy (to be rewritten by this spec's final cleanup commit)
- `ARCHITECTURE.md §12` — security posture (CSP context for the widening)
- `DECISIONS.md` 2026-05-18 — CSP cleanup; CSS architecture lock-in (the "no extra plugins" rule the pino deviation acknowledges)
- `DECISIONS.md` 2026-05-15 — Anthropic monthly budget cap; contact route KV durability (the precedent pattern for `/api/ask` Q+A persistence)
- `proxy.ts` — Next middleware (CSP only; Phase 1 widens `connect-src` for Vercel analytics origins)
- `lib/rate-limit.ts` — Upstash Ratelimit primitives (reused for `getErrorLogLimit()`)
- `app/api/contact/route.ts` — durability-first KV pattern + IP hashing (the precedent for Phase 3c)
- `components/ErrorBoundary.client.tsx` — existing client error boundary (to be extended in Phase 3b)
- `components/AppShell.client.tsx` — single point where `lib/error-bridge.ts` mounts
- This session's commits: `2ae0def` (CI fix), `2b748c9` (pnpm action-setup fix), and PR #9 + PR #10 spec/plan context
