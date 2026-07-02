# PSI cron reliability — transient retry + consecutive-failure alert gating

- **Date:** 2026-07-02
- **Status:** Approved (design)
- **Owner:** Erik Cunha
- **Reversibility:** High — additive retry + Redis-gated alerting; revert restores alert-on-anyFailed.

## Problem

The daily `psi-refresh` cron (`0 3 * * *`) has a measured **~30% failure rate**:
6 alert emails across ~20 runs (2026-06-12 → 2026-07-01). Two distinct causes:

| Cause | Count | Nature |
|---|---|---|
| Mobile 45s timeout (`AbortError`) | 4/6 | Edge-slowness: mobile Lighthouse audits sit near the `PSI_REFRESH_TIMEOUT_MS=45s` ceiling |
| Upstream PSI `500 lighthouseError` | 2/6 | Google's Lighthouse runner fails server-side |

5 of 6 involve mobile. The site itself is unaffected: `/api/healthz` stays `ok`
because partial success already writes `meta:psi-last-run`, and scores survive on
the 25h cache TTL. **The real harm is alert-blindness** — a near-daily,
non-actionable email trains the operator to ignore the alert channel (violates
the CLAUDE.md "false-positive budget" principle).

### Constraint

`maxDuration = 60` is the **Vercel Hobby-plan ceiling**. A retry of a request
that already burned the 45s timeout cannot fit the remaining budget. Therefore an
in-invocation retry can only recover the **fast-failing** class (429/5xx), not the
timeout class. The timeout class is a plan-tier constraint, not a code bug.

## Goals

1. Eliminate email noise from single transient failures (the actual harm).
2. Auto-recover the fast-failing upstream-500 class within one invocation.
3. Keep genuine sustained outages visible.
4. Stay within the 60s Hobby ceiling — verified, not assumed.

## Non-goals

- Fixing the mobile timeout class (accepted as a Hobby constraint; the only real
  fix is raising `maxDuration` via Vercel Pro — out of scope, documented in ADR).
- Changing the cron schedule or the healthz freshness mechanism.

## Design

### Unit 1 — Transient retry (`lib/lighthouse-scores.ts`)

Bounded, **deadline-budgeted** retry inside the cron fetch path (`forceRefresh=true`
only; the request path keeps its fast single-shot behavior).

**Retry predicate — retry ONLY fast-failing transient classes:**
- HTTP `429` (rate limit) and `5xx` (500/502/503/504 — covers `lighthouseError`).
- **Never** retry timeouts (`AbortError`/`TimeoutError`): no budget, edge-slowness
  won't self-heal within the ceiling.
- **Never** retry other `4xx`: won't self-heal.

Classification requires a typed error carrying the HTTP status:

```ts
class PsiHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
```

`!res.ok` throws `PsiHttpError(res.status, …)`. Timeouts surface as the native
`AbortError`/`TimeoutError` (no `status`) → not retryable.

**Deadline budget (load-bearing — prevents 60s force-kill):**
- `PSI_STRATEGY_BUDGET_MS = 50_000` — reserves 10s of the 60s ceiling for the
  alert + response.
- Each attempt's timeout = `min(PSI_REFRESH_TIMEOUT_MS, budget − elapsed)`.
- Retry a fast-class error only if `budget − elapsed ≥ PSI_MIN_RETRY_BUDGET_MS`
  (`8_000`) — else not worth attempting. (WHY comment must note the gate is checked
  *before* backoff, so the 2nd attempt's actual timeout can be slightly under 8s;
  the `min(…, budget − elapsed)` cap keeps the ceiling correct regardless.)
- Backoff between attempts: `500ms + jitter(0–500ms)`.
- Max 2 attempts total (1 retry).

**Budget proof:** worst single-strategy chain = fast 500 (~8s) + backoff (~1s) +
retry timeout capped at `budget − elapsed` (~41s) = ≤ 50s. Desktop + mobile run in
parallel (`Promise.allSettled`), so wall ≤ 50s; alert path ≤ 5s → ≤ 55s < 60s.

`refreshScores(strategy)` remains the public entry; the retry loop is internal to
`fetchAndCache`. On success within budget it performs exactly **one** cache write.
On exhaustion it throws (caller handles per-strategy via `allSettled`).

### Unit 2 — Consecutive-failure alert gating (`app/api/psi-refresh/route.ts`)

Replace "email whenever `anyFailed`" with **per-strategy consecutive-failure
counters**, threshold **3**.

- Redis keys: `meta:psi-consec-failures:desktop`, `meta:psi-consec-failures:mobile`
  (integer, `ex` = 7 days as GC backstop; reset-on-success is the primary reset).
- Per run, per strategy: **success → `DEL` (absent ≡ 0)**, **failure → atomic
  `INCR` + `EXPIRE` 7d pipelined in one round-trip** (mirror `lib/rate-limit.ts`
  `reserveBudget`'s `pipe.incrby` + `pipe.expire`). `INCR` returns the new count
  directly — no GET+SET read-modify-write, so there is no lost-increment race even
  if invocations ever overlap. If `EXPIRE` alone fails the key persists without a
  TTL; reset-on-success `DEL` + the 7d GC backstop both cover that, so it is not a
  correctness risk.
- **Send email only if any strategy's post-`INCR` count ≥ 3.** Body names the
  offending strategy, its count, and the latest error string.
- **Route still returns `500` on `anyFailed`.** The Vercel Cron dashboard remains a
  truthful, non-noisy channel; only the *email* is threshold-gated. Preserves
  "keep genuine outages visible."
- Counter `INCR`/`DEL` wrapped in **its own** try/catch, **separate from** the
  freshness write: on Redis error, **log + skip alert gating** (fail-quiet). A
  counter/Redis failure must never block `meta:psi-last-run`. Redis-down is already
  surfaced by `/api/healthz` degradation, so we avoid double-alerting and avoid
  reintroducing noise.
- `anySucceeded → write meta:psi-last-run` — **unchanged**, in its own try/catch.
- Update the `maxDuration` WHY comment to reflect the retry budget.

### Unit 3 — Tests (TDD)

`lib/lighthouse-scores` (cron path):
- retry on 500 then success → returns scores, **one** cache write
- retry on 429 then success
- **no** retry on timeout (`AbortError`/`TimeoutError`) → throws after 1 attempt
- **no** retry on non-429 `4xx` (e.g. 400/403) → throws after 1 attempt
- persistent 500 → exhausts retries → throws
- insufficient remaining budget → skips retry (no 2nd attempt)
- **request path (`forceRefresh=false`) is single-shot** — a 500 throws
  immediately with no retry (protects the 8s LCP budget)
- retryable-error message string is preserved verbatim (alert body depends on it)

Backoff is a module const (small/overridable) so tests use fake timers and stay
fast and deterministic.

`app/api/psi-refresh` route:
- strategy fails once → no email, counter incremented
- strategy reaches 3rd consecutive failure → email sent
- strategy succeeds → counter reset to 0, no email
- still returns `500` on `anyFailed` regardless of email
- `meta:psi-last-run` written on `anySucceeded` (regression guard)
- Redis counter read failure → no throw, no email (fail-quiet)

Existing alert-on-`anyFailed` assertions in `__tests__/psi-refresh*.test.ts` are
updated to the new gating.

### Unit 4 — ADR (`DECISIONS.md`)

One bullet, dated 2026-07-02: transient retry + per-strategy consecutive-failure
alert gating (threshold 3); timeout class accepted as a Hobby-tier 60s constraint
(only real fix is Vercel Pro `maxDuration`); reversibility: high.

### Required agent/skill dispatch (hook-enforced)

Editing `app/api/psi-refresh/route.ts` trips `.claude/hooks/api-edit-marker.sh`;
`api-security-push-guard.sh` blocks the next `git push` until **`security-auditor`**
is dispatched after the edit. The **`vercel:vercel-functions`** skill also fires per
`.claude/rules/api-boundary.md` for the route edit. (`lib/lighthouse-scores.ts` is
not in the marker's path set, so only the route file triggers the guard.)

## Accepted trade-off

Threshold 3 at a 1×/day cadence means a genuinely *new* sustained outage is
email-silent for up to ~3 days. Same-day visibility remains via the dashboard 500
and healthz; only the push notification waits. Accepted by owner.

## Failure modes (`thinking-inversion`, converted to requirements/tests)

| Failure mode | Severity | Mitigation → test |
|---|---|---|
| Retry stacks past 60s → force-kill, freshness never written | Critical | Deadline budget (`min(45s, budget−elapsed)`, retry only if ≥8s left); budget proof above |
| Retry a timeout → wastes whole budget on a doomed 2nd 45s attempt | Critical | Predicate = "retry only `PsiHttpError` with retryable status"; everything else (timeout/network/parse) is non-retryable **by construction** → no-retry-on-timeout test |
| Retry a 4xx (bad key/params) → delays inevitable throw, risks budget | High | Predicate excludes non-429 4xx → no-retry-on-4xx test |
| Request path inherits retry → hurts LCP, blows 8s budget | High | Retry scoped to `forceRefresh` → single-shot request-path test |
| Duplicate cache writes across attempts | Medium | Write once after final success → one-write assertion |
| Counter never accumulates (TTL < 1d cadence) | High | `EXPIRE` 7d ≫ 1d |
| Counter never resets → false sustained alert | High | `DEL` on success → reset test |
| Off-by-one gate (alert at wrong count) | High | exactly-3 → alert, 2 → silent tests |
| Redis down → route throws / unhandled rejection | High | Counter ops in own try/catch, fail-quiet → redis-failure-no-throw test |
| Counter failure blocks freshness write | High | Separate try/catch blocks → freshness-still-written test |
| Real sustained outage goes silent | Medium | Return-500 dashboard signal preserved + healthz same-day |
| Flaky/slow tests from real backoff sleeps | Low | Backoff const + fake timers |

**Consumer audit (before changing behavior):** `tests/e2e/observability-smoke.spec.ts`
and all `__tests__/psi-refresh*.test.ts` currently assert alert-on-`anyFailed`;
enumerate and update every one.
