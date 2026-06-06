# Design: PSI Refresh Cron — Live Desktop + Mobile Lighthouse Scores

**Date:** 2026-05-29
**Branch:** `feat/psi-refresh-cron`
**Reversibility:** High — reverts to cache-on-demand by removing the cron handler, `vercel.json` crons entry, and reverting `lib/lighthouse-scores.ts`.

---

## Problem

`lib/lighthouse-scores.ts` fetches PSI on cache miss (Redis TTL = 24h). No proactive refresh exists. The first visitor after TTL expiry triggers a live PSI call with an 8-second timeout — visible latency or a `—` fallback if PSI is slow. The `LIVE_PERF.JSON` section shows desktop scores only; mobile scores are absent despite the site having mobile-specific budgets.

---

## Scope

- Proactive daily PSI refresh via Vercel cron (eliminates user-triggered live fetches)
- Desktop + mobile scores, independently cached, independently fallback-safe
- `LIVE_PERF.JSON` section updated to display both strategies in a stacked layout
- No UI interaction (no toggle) — pure RSC, both rows rendered at SSR time

Out of scope: real-time scores, on-demand refresh endpoint, visitor-triggered fallback removal.

---

## Section 1: `lib/lighthouse-scores.ts` — Strategy Extension

### Changes

Add `Strategy = 'desktop' | 'mobile'` type. Split the single Redis key into:
- `lh:scores:desktop`
- `lh:scores:mobile`

Bump TTL from `86_400` (24h) to `90_000` (25h) — survives a single missed cron run without a cache miss.

Extract the PSI fetch + cache-write into `fetchAndCache(strategy)` (private). Two public exports:

```typescript
export async function getScores(strategy: Strategy = 'desktop'): Promise<LighthouseScores>
```
Cache-first. On miss calls `fetchAndCache`. Falls back to `LIGHTHOUSE_FALLBACK` on any error. Default arg preserves backward compat with `/api/lighthouse`.

```typescript
export async function refreshScores(strategy: Strategy): Promise<LighthouseScores>
```
Always calls `fetchAndCache`. Throws on PSI failure (cron handler catches per-strategy via `Promise.allSettled`). Used only by the cron handler — forces a fresh fetch even if cache is warm.

`fetchAndCache` fires the PSI URL with `&strategy={desktop|mobile}`, parses the response identically for both, writes to `lh:scores:{strategy}` with TTL 25h (fire-and-forget), returns scores.

### Key: old `lh:scores` key

The old desktop key (`lh:scores`) becomes orphaned in Redis after deploy. It will expire on its own TTL. No migration needed.

---

## Section 2: `app/api/psi-refresh/route.ts` — Cron Handler

GET-only route. Auth check is the first and only gate:

```
Authorization: Bearer {CRON_SECRET}
```

Vercel injects this header automatically for cron invocations when `CRON_SECRET` is set in the project environment. Any other caller gets `401`. If `CRON_SECRET` is unset, all requests get `401` (fail-closed on missing secret).

After auth:
1. `Promise.allSettled([refreshScores('desktop'), refreshScores('mobile')])`
2. Log result summary with `durationMs`
3. Return `{ desktop: scores|null, mobile: scores|null, durationMs }` as JSON

Each strategy is independent — a mobile PSI failure does not block the desktop write.

Does NOT use `defineHandler` — that helper is for rate-limited, body-parsed JSON routes. Cron route has no body and no rate-limit concern (it's auth-gated).

---

## Section 3: `vercel.json` — Cron Schedule

```json
{
  "crons": [
    {
      "path": "/api/psi-refresh",
      "schedule": "0 3 * * *"
    }
  ]
}
```

3 AM UTC daily — low-traffic window, ahead of EU morning. Vercel cron documentation: the `schedule` field uses standard cron syntax. Vercel automatically injects `Authorization: Bearer {CRON_SECRET}` if the env var is set.

---

## Section 4: `LivePerfSection.tsx` + CSS — Stacked Desktop + Mobile

### Component changes

`PerfData` gains a required `strategy: Strategy` prop. `PerfBody` gains the same prop (for the footer label). The strategy label replaces the current "SOURCE: PageSpeed Insights · cached daily" suffix — instead each block footer reads `SOURCE: PSI · desktop` or `SOURCE: PSI · mobile`.

`LivePerfSection` renders two `PerfData` instances inside one `<Suspense>`:

```tsx
<Suspense fallback={<PerfFallback />}>
  <div className={styles.strategyBlock}>
    <p className={styles.strategyLabel}>DESKTOP</p>
    <PerfData strategy="desktop" />
  </div>
  <div className={styles.strategyBlock}>
    <p className={styles.strategyLabel}>MOBILE</p>
    <PerfData strategy="mobile" />
  </div>
</Suspense>
```

React fetches both in parallel (RSC concurrent rendering). Each fails independently — if mobile PSI returns fallback, the mobile block shows `—` while desktop shows real scores.

`PerfFallback` renders two skeleton blocks (DESKTOP + MOBILE) to avoid layout shift on Suspense hydration.

### CSS additions (`.module.css`)

```css
.strategyBlock + .strategyBlock {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--ds-color-border);
}

.strategyLabel {
  color: var(--ds-color-text-muted);
  font-size: var(--ds-font-size-xs);
  letter-spacing: 0.18em;
  margin-bottom: 10px;
}
```

---

## Section 5: Env + Docs

`.env.example` gains:
```
# Vercel Cron Secret — authenticates /api/psi-refresh.
# Vercel injects this automatically into cron requests.
# Set in Vercel project settings. Generate: openssl rand -hex 32
CRON_SECRET=
```

`DECISIONS.md` entry: cron architecture decision, TTL rationale, strategy split.

---

## Testing

| What | Where | How |
|---|---|---|
| `getScores` cache-hit path | `__tests__/lighthouse-scores.test.ts` | Mock Redis `get` returns cached value; assert PSI fetch not called |
| `getScores` cache-miss path | same | Mock Redis `get` returns null; mock PSI fetch; assert write |
| `getScores` fallback on PSI error | same | Mock PSI fetch to throw; assert returns `LIGHTHOUSE_FALLBACK` |
| `refreshScores` always fetches | same | Mock Redis `get`; assert PSI fetch called regardless |
| `refreshScores` throws on error | same | Mock PSI fetch to throw; assert rejects |
| Cron handler: 401 on bad auth | `__tests__/psi-refresh-route.test.ts` | Call GET with wrong/missing Bearer; assert 401 |
| Cron handler: 200 with both strategies | same | Mock `refreshScores`; assert both called; assert JSON shape |
| Cron handler: partial failure | same | Mock mobile `refreshScores` to throw; assert desktop data present, mobile null |
| `PerfData` desktop + mobile render | `LivePerfSection.test.tsx` | Two `getScores` calls with correct strategy args |
| Existing fallback tests | `__tests__/lighthouse-fallback.test.ts` | No change — `LIGHTHOUSE_FALLBACK` shape unchanged |
