# PSI cron reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the psi-refresh cron's ~30% daily failure noise by retrying fast-failing transient PSI errors within the invocation budget and emailing only after 3 consecutive per-strategy failures.

**Architecture:** Add a typed `PsiHttpError` so the cron fetch path can classify retryable (429/5xx) vs non-retryable (timeout/4xx/parse) failures; wrap the cron fetch in a deadline-budgeted retry that stays under the 60s Hobby ceiling; replace alert-on-`anyFailed` with per-strategy consecutive-failure counters in Redis (`INCR`/`EXPIRE`/`DEL`), threshold 3. The request/LCP path stays single-shot.

**Tech Stack:** TypeScript (strict), Next.js route handler, `@upstash/redis` (pipeline `incr`/`expire`, `del`), Vitest, Resend.

## Global Constraints

- `maxDuration = 60` on `app/api/psi-refresh/route.ts` — Vercel Hobby ceiling; total wall time must stay under it.
- Retry ONLY in the cron path (`forceRefresh=true`); the request path (`forceRefresh=false`, 8s budget) stays single-shot to protect LCP.
- Read env only via `@/lib/env` (Zod accessor) — never `process.env.*` in the handler.
- Redis operations must be fail-open/fail-quiet: a Redis error must never 500 a user or throw out of the route; the freshness write and the counter ops live in independent try/catch blocks.
- `Math.random`/`Date.now` are allowed here (app runtime code, not a workflow script).
- No user-facing copy in `.tsx`/`.ts` beyond the existing alert email text pattern.
- Spec: `docs/superpowers/specs/2026-07-02-psi-cron-reliability-design.md`.

---

### Task 1: Typed `PsiHttpError` (classification seam, no behavior change)

**Files:**
- Modify: `lib/lighthouse-scores.ts` (the `!res.ok` throw, ~line 58-66)
- Test: `__tests__/lighthouse-scores.test.ts`

**Interfaces:**
- Produces: `class PsiHttpError extends Error { readonly status: number }` (module-internal, not exported from the package surface but referencable in-module). The thrown error's `.message` MUST remain the exact `PSI API returned ${status} for strategy=${strategy}: ${body}` string (the alert body depends on it).

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lighthouse-scores.test.ts` (it already stubs `fetch`, `getRedis`, `log`):

```ts
describe('refreshScores — error typing', () => {
  it('throws with status + preserved message on a non-ok PSI response', async () => {
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"error":{"code":500,"message":"Lighthouse returned error"}}',
    });
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('PSI API returned 500 for strategy=mobile'),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/lighthouse-scores.test.ts -t "error typing"`
Expected: FAIL — thrown error has no `status` property.

- [ ] **Step 3: Write minimal implementation**

In `lib/lighthouse-scores.ts`, add near the top (after imports):

```ts
/** PSI returned a non-2xx HTTP status. Carries `status` so the cron retry can
 *  classify retryable (429/5xx) vs terminal (4xx) failures. */
class PsiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PsiHttpError';
  }
}
```

Replace the existing `throw new Error(...)` in the `!res.ok` block with:

```ts
    throw new PsiHttpError(res.status, `PSI API returned ${res.status} for strategy=${strategy}: ${body}`);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run __tests__/lighthouse-scores.test.ts`
Expected: PASS (all existing + new case).

- [ ] **Step 5: Commit**

```bash
git add lib/lighthouse-scores.ts __tests__/lighthouse-scores.test.ts
git commit -m "refactor(psi-refresh): typed PsiHttpError carrying HTTP status"
```

---

### Task 2: Deadline-budgeted retry on the cron fetch path

**Files:**
- Modify: `lib/lighthouse-scores.ts` (extract `fetchScoresOnce`, add retry loop + constants + `_now` test seam)
- Test: `__tests__/lighthouse-scores.test.ts`

**Interfaces:**
- Consumes: `PsiHttpError` (Task 1).
- Produces (exported module consts, for tests + the route comment): `PSI_STRATEGY_BUDGET_MS = 50_000`, `PSI_MIN_RETRY_BUDGET_MS = 8_000`, `PSI_RETRY_BACKOFF_MS = 500`, `PSI_MAX_ATTEMPTS = 2`, and `__setNowForTest(fn: (() => number) | null): void`. `refreshScores(strategy)` signature unchanged; behavior gains bounded retry.

**Design notes for the implementer:**
- Extract `async function fetchScoresOnce(strategy, timeoutMs, forceRefresh): Promise<LighthouseScores>` = the current fetch + parse (+ write on success). It throws `PsiHttpError` on non-ok, native `TimeoutError`/`AbortError` on timeout, generic `Error` on JSON parse failure.
- Retry predicate: `err instanceof PsiHttpError && (err.status === 429 || (err.status >= 500 && err.status <= 599))`. Everything else is non-retryable by construction.
- Per-attempt timeout = `min(PSI_REFRESH_TIMEOUT_MS, PSI_STRATEGY_BUDGET_MS − elapsed)` where `elapsed = _now() − start`.
- Retry only if `attempt < PSI_MAX_ATTEMPTS`, predicate true, and `PSI_STRATEGY_BUDGET_MS − elapsed ≥ PSI_MIN_RETRY_BUDGET_MS`. The budget gate is checked BEFORE backoff, so the 2nd attempt's timeout can be slightly under `PSI_MIN_RETRY_BUDGET_MS`; the `min(...)` cap keeps the ceiling correct.
- Backoff: `PSI_RETRY_BACKOFF_MS + Math.floor(Math.random() * 500)` ms via `setTimeout`.
- `refreshScores` (cron) calls the retry loop; the request path (`getScores` cache-miss) calls `fetchScoresOnce` exactly once with `PSI_REQUEST_TIMEOUT_MS`.
- `_now` seam: `let _now = () => Date.now();` used for `start`/`elapsed`; `__setNowForTest` overrides it. Reset in `afterEach`.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lighthouse-scores.test.ts`. Add `afterEach(() => __setNowForTest?.(null))` guard once available, and mock jitter deterministically:

```ts
describe('refreshScores — cron retry', () => {
  const okResp = () => makePsiResponse(0.99);
  const errResp = (status: number) => ({ ok: false, status, text: async () => 'err' });

  it('retries once on 500 then succeeds, writing the cache exactly once', async () => {
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValueOnce(errResp(500)).mockResolvedValueOnce(okResp());
    mockSet.mockResolvedValue('OK');
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const res = await refreshScores('mobile');
    expect(res.performance).toBe(99);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValueOnce(errResp(429)).mockResolvedValueOnce(okResp());
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).resolves.toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a timeout', async () => {
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toThrow(/aborted/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a non-429 4xx', async () => {
    process.env.PSI_API_KEY = 'k';
    mockFetch.mockResolvedValue(errResp(403));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toMatchObject({ status: 403 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries on a persistent 500 (2 attempts, then throws)', async () => {
    process.env.PSI_API_KEY = 'k';
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockFetch.mockResolvedValue(errResp(500));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('mobile')).rejects.toMatchObject({ status: 500 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips the retry when the remaining budget is below the floor', async () => {
    process.env.PSI_API_KEY = 'k';
    const { refreshScores, __setNowForTest, PSI_STRATEGY_BUDGET_MS } = await import('@/lib/lighthouse-scores');
    let t = 0;
    // start=0; after the first attempt, jump elapsed past (budget - floor) so the retry is skipped.
    __setNowForTest(() => {
      const v = t;
      t = PSI_STRATEGY_BUDGET_MS - 1_000; // second read: only 1s left (< 8s floor)
      return v;
    });
    mockFetch.mockResolvedValue(errResp(500));
    await expect(refreshScores('mobile')).rejects.toMatchObject({ status: 500 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    __setNowForTest(null);
  });

  it('request path (getScores cache-miss) is single-shot — no retry on 500', async () => {
    process.env.PSI_API_KEY = 'k';
    mockGet.mockResolvedValue(null); // cache miss
    mockFetch.mockResolvedValue(errResp(500));
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const res = await getScores('mobile');
    expect(res).toEqual(LIGHTHOUSE_FALLBACK); // getScores swallows to fallback
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/lighthouse-scores.test.ts -t "cron retry"`
Expected: FAIL — no retry today (single fetch), `__setNowForTest`/consts undefined.

- [ ] **Step 3: Write the implementation**

In `lib/lighthouse-scores.ts`:

```ts
export const PSI_STRATEGY_BUDGET_MS = 50_000; // reserves 10s of the 60s Hobby ceiling for the alert + response
export const PSI_MIN_RETRY_BUDGET_MS = 8_000; // don't retry if less than this remains
export const PSI_RETRY_BACKOFF_MS = 500;
export const PSI_MAX_ATTEMPTS = 2;

// Test seam: overridable monotonic clock so the deadline-budget path is
// deterministically testable without fake timers. Production uses Date.now.
let _now: () => number = () => Date.now();
export function __setNowForTest(fn: (() => number) | null): void {
  _now = fn ?? (() => Date.now());
}

function isRetryablePsiError(err: unknown): err is PsiHttpError {
  return err instanceof PsiHttpError && (err.status === 429 || (err.status >= 500 && err.status <= 599));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
```

Refactor: rename the body of `fetchAndCache` into `fetchScoresOnce(strategy, timeoutMs, forceRefresh)` that uses `timeoutMs` for `AbortSignal.timeout` and keeps the existing write-on-success logic (blocking write for cron, fire-and-forget for request). Then:

```ts
async function fetchAndCache(strategy: Strategy, forceRefresh = false): Promise<LighthouseScores> {
  if (!forceRefresh) {
    return fetchScoresOnce(strategy, PSI_REQUEST_TIMEOUT_MS, false); // single-shot request/LCP path
  }
  const start = _now();
  for (let attempt = 1; ; attempt++) {
    const remaining = PSI_STRATEGY_BUDGET_MS - (_now() - start);
    const perAttempt = Math.min(PSI_REFRESH_TIMEOUT_MS, Math.max(0, remaining));
    try {
      return await fetchScoresOnce(strategy, perAttempt, true);
    } catch (err) {
      const budgetLeft = PSI_STRATEGY_BUDGET_MS - (_now() - start);
      if (attempt >= PSI_MAX_ATTEMPTS || !isRetryablePsiError(err) || budgetLeft < PSI_MIN_RETRY_BUDGET_MS) {
        throw err;
      }
      await sleep(PSI_RETRY_BACKOFF_MS + Math.floor(Math.random() * 500));
    }
  }
}
```

Add `__setNowForTest(null)` reset to the test file's `afterEach`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/lighthouse-scores.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/lighthouse-scores.ts __tests__/lighthouse-scores.test.ts
git commit -m "feat(psi-refresh): deadline-budgeted retry for transient 429/5xx on the cron path"
```

---

### Task 3: Per-strategy consecutive-failure alert gating

**Files:**
- Modify: `app/api/psi-refresh/route.ts`
- Test: `__tests__/psi-refresh.test.ts` AND `__tests__/psi-refresh-route.test.ts` (update the getRedis mock in both to add `pipeline`/`del`)

**Interfaces:**
- Consumes: `getRedis()` with `.pipeline()` (chaining `.incr(key)` + `.expire(key, s)`, then `.exec<[number, number]>()`) and `.del(key)`, mirroring `lib/rate-limit.ts` `reserveBudget`.
- Produces: alert email sent only when a strategy's post-INCR consecutive-failure count ≥ 3.

**Design notes:**
- Constants: `const PSI_CONSEC_KEY = (s: Strategy) => \`meta:psi-consec-failures:${s}\`;` `const PSI_CONSEC_TTL_S = 604_800;` (7d) `const PSI_ALERT_THRESHOLD = 3;`
- After `Promise.allSettled`, for each strategy compute failed/succeeded. Update counters in ONE try/catch (independent of the freshness write): success → `getRedis().del(key)`; failure → pipeline `incr` + `expire`, read back the new count. Collect strategies whose count ≥ threshold.
- Email only if that collection is non-empty; body lists `${strategy}: ${count} consecutive failures — ${latestError}`.
- Keep: `return Response.json(result, { status: anyFailed ? 500 : 200 })` (dashboard signal preserved).
- Keep the `anySucceeded → set meta:psi-last-run` block in its OWN try/catch, untouched.
- On Redis error in the counter block: `log.error(...)` and skip alerting (fail-quiet). Do NOT rethrow.

- [ ] **Step 1: Update both getRedis mocks + write failing tests**

In `__tests__/psi-refresh.test.ts` and `__tests__/psi-refresh-route.test.ts`, extend the getRedis mock:

```ts
const redisMockSet = vi.fn(async () => 'OK');
const redisMockDel = vi.fn(async () => 1);
const pipeExec = vi.fn(async () => [1, 1] as [number, number]); // [countAfterIncr, expireResult]
const redisMockPipeline = vi.fn(() => ({
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: pipeExec,
}));
vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ set: redisMockSet, del: redisMockDel, pipeline: redisMockPipeline })),
}));
```

Add cases to `__tests__/psi-refresh.test.ts`:

```ts
it('does NOT email on a single (1st) strategy failure', async () => {
  const { refreshScores } = await import('@/lib/lighthouse-scores');
  vi.mocked(refreshScores).mockImplementation(async (s) => {
    if (s === 'mobile') throw new Error('PSI API returned 500 for strategy=mobile: x');
    return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
  });
  pipeExec.mockResolvedValue([1, 1]); // 1st consecutive failure
  const { GET } = await import('@/app/api/psi-refresh/route');
  const res = await GET(makeRequest());
  expect(res.status).toBe(500); // dashboard signal preserved
  expect(sendMock).not.toHaveBeenCalled();
});

it('emails on the 3rd consecutive strategy failure', async () => {
  const { refreshScores } = await import('@/lib/lighthouse-scores');
  vi.mocked(refreshScores).mockImplementation(async (s) => {
    if (s === 'mobile') throw new Error('PSI API returned 500 for strategy=mobile: x');
    return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
  });
  pipeExec.mockResolvedValue([3, 1]); // 3rd consecutive failure
  const { GET } = await import('@/app/api/psi-refresh/route');
  await GET(makeRequest());
  expect(sendMock).toHaveBeenCalledTimes(1);
  expect(sendMock.mock.calls[0][0].text).toContain('mobile');
});

it('resets (DEL) a strategy counter on its success and does not email', async () => {
  const { refreshScores } = await import('@/lib/lighthouse-scores');
  vi.mocked(refreshScores).mockResolvedValue({ performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' });
  const { GET } = await import('@/app/api/psi-refresh/route');
  const res = await GET(makeRequest());
  expect(res.status).toBe(200);
  expect(redisMockDel).toHaveBeenCalledWith('meta:psi-consec-failures:desktop');
  expect(redisMockDel).toHaveBeenCalledWith('meta:psi-consec-failures:mobile');
  expect(sendMock).not.toHaveBeenCalled();
});

it('still writes meta:psi-last-run and does not throw when the counter pipeline fails', async () => {
  const { refreshScores } = await import('@/lib/lighthouse-scores');
  vi.mocked(refreshScores).mockImplementation(async (s) => {
    if (s === 'mobile') throw new Error('boom');
    return { performance: 99, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: 'now' };
  });
  pipeExec.mockRejectedValue(new Error('redis down'));
  const { GET } = await import('@/app/api/psi-refresh/route');
  const res = await GET(makeRequest());
  expect(res.status).toBe(500);
  expect(redisMockSet).toHaveBeenCalledWith('meta:psi-last-run', expect.any(String)); // freshness still written
  expect(sendMock).not.toHaveBeenCalled(); // fail-quiet
});
```

Update any EXISTING test in these files that asserts "email sent on any failure" to the new threshold gating (a single failure no longer emails).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run __tests__/psi-refresh.test.ts`
Expected: FAIL — route still emails on `anyFailed`, no counter logic.

- [ ] **Step 3: Write the implementation**

Edit `app/api/psi-refresh/route.ts`: import `Strategy` type (or inline `'desktop'|'mobile'`), add the consts, and replace the alert block. Sketch:

```ts
const PSI_CONSEC_KEY = (s: 'desktop' | 'mobile') => `meta:psi-consec-failures:${s}`;
const PSI_CONSEC_TTL_S = 604_800; // 7d GC backstop; reset-on-success is primary
const PSI_ALERT_THRESHOLD = 3;

// ...after computing desktopResult/mobileResult...
const strategies: Array<['desktop' | 'mobile', PromiseSettledResult<unknown>]> = [
  ['desktop', desktopResult],
  ['mobile', mobileResult],
];

const overThreshold: Array<{ strategy: string; count: number; error: string }> = [];
try {
  for (const [name, r] of strategies) {
    const key = PSI_CONSEC_KEY(name);
    if (r.status === 'fulfilled') {
      await getRedis().del(key);
    } else {
      const pipe = getRedis().pipeline();
      pipe.incr(key);
      pipe.expire(key, PSI_CONSEC_TTL_S);
      const [count] = await pipe.exec<[number, number]>();
      if (count >= PSI_ALERT_THRESHOLD) {
        overThreshold.push({
          strategy: name,
          count,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }
  }
} catch (counterErr) {
  // Fail-quiet: counter/Redis failure must not throw or reintroduce noise; healthz covers Redis-down.
  log.error('psi-refresh: consecutive-failure counter update failed — alert gating skipped', { err: counterErr });
}

if (overThreshold.length > 0) {
  // ...existing Resend send, but build text from overThreshold...
}
```

Build the email `text` from `overThreshold` (`strategy: N consecutive failures — message`). Keep the existing 5s Resend timeout race and the `RESEND_API_KEY` guard. Leave the `anySucceeded` freshness block and the final `Response.json(..., { status: anyFailed ? 500 : 200 })` untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run __tests__/psi-refresh.test.ts __tests__/psi-refresh-route.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add app/api/psi-refresh/route.ts __tests__/psi-refresh.test.ts __tests__/psi-refresh-route.test.ts
git commit -m "feat(psi-refresh): per-strategy consecutive-failure alert gating (threshold 3)"
```

---

### Task 4: Update the maxDuration WHY comment + e2e consumer audit

**Files:**
- Modify: `app/api/psi-refresh/route.ts` (the `maxDuration` WHY comment, ~line 8-14)
- Audit/Modify: `tests/e2e/observability-smoke.spec.ts`

- [ ] **Step 1: Audit the e2e consumer**

Run: `rg -n "psi-refresh|consec|alert|anyFailed|500" tests/e2e/observability-smoke.spec.ts`
If it asserts the cron emails/500s on any single failure, update the expectation to the new gating (a single transient failure still returns 500 for the dashboard but does NOT email). If it only smoke-checks the endpoint contract (200/500 + shape), no change needed — note that in the commit.

- [ ] **Step 2: Update the maxDuration WHY comment**

Rewrite the comment block to document the retry budget: two parallel strategies, each bounded by `PSI_STRATEGY_BUDGET_MS=50s` (retry only fast-fail 429/5xx, per-attempt timeout capped at `min(45s, budget−elapsed)`), + the 5s Resend race = ≤55s < 60s. Note the `8s-check-before-backoff` nuance (2nd attempt may get slightly under 8s; the `min(...)` cap keeps the ceiling correct).

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm vitest run __tests__/psi-refresh.test.ts __tests__/lighthouse-scores.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/psi-refresh/route.ts tests/e2e/observability-smoke.spec.ts
git commit -m "docs(psi-refresh): document retry budget in maxDuration comment; align e2e smoke"
```

---

### Task 5: ADR in DECISIONS.md

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Append the ADR bullet**

Add a dated (2026-07-02) entry: measured ~30% daily psi-refresh failure (6/20 runs); added deadline-budgeted retry for fast-failing 429/5xx and per-strategy consecutive-failure alert gating (threshold 3) to kill non-actionable alert noise; the mobile-timeout class is accepted as a Hobby-tier 60s constraint (the only real fix is raising `maxDuration` via Vercel Pro); reversibility: high (revert restores alert-on-anyFailed). Cite before/after: alert fires on 1 failure → alert fires on 3 consecutive per-strategy failures.

- [ ] **Step 2: Commit**

```bash
git add DECISIONS.md
git commit -m "docs(psi-refresh): ADR for retry + consecutive-failure alert gating"
```

---

## Post-implementation gates (not tasks — run after all tasks)

1. `pnpm typecheck && pnpm test --run && pnpm build` — verification-before-completion; cite output.
2. 5-agent review battery scoped to code commits (incl. **`security-auditor`** — hook-enforced by the `app/api/psi-refresh/route.ts` edit; the push is blocked until it runs) + `performance-engineer`, `accessibility-tester`, `dependency-manager`, `pr-review-toolkit:review-pr`. Then `battery-synthesis` → `pnpm review:stamp`.
3. Invoke the `vercel:vercel-functions` skill for the route edit (per `.claude/rules/api-boundary.md`).
4. Visual baseline impact: **NO** — no CSS/layout/rendering change; single push.
5. `pnpm ready-for-pr` before opening the PR; fill the PR template; note the branch also carries the `fix(ci)` architect-gate helper fix (commit `5658b43`), reviewed as part of this PR.

## Self-Review

- **Spec coverage:** Unit 1 (retry) → Tasks 1-2; Unit 2 (alert gating) → Task 3; Unit 3 (tests) → embedded per task; Unit 4 (ADR) → Task 5; maxDuration comment + consumer audit → Task 4. All spec sections mapped.
- **Placeholder scan:** every code step shows real code; test bodies are concrete.
- **Type consistency:** `PsiHttpError.status`, `PSI_STRATEGY_BUDGET_MS`, `PSI_MIN_RETRY_BUDGET_MS`, `__setNowForTest`, `PSI_CONSEC_KEY`, `PSI_ALERT_THRESHOLD` used identically across tasks; `pipeline().incr/expire/exec` + `del` match `lib/rate-limit.ts`.
