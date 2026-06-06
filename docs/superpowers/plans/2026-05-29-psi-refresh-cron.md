# PSI Refresh Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vercel cron that proactively refreshes desktop + mobile PSI Lighthouse scores in Redis daily, and update `LIVE_PERF.JSON` to display both strategies in a stacked layout.

**Architecture:** Extend `lib/lighthouse-scores.ts` with a `strategy` param and `refreshScores()` export; add `app/api/psi-refresh/route.ts` (auth-gated GET); add `vercel.json` with a daily 3 AM UTC cron; update `LivePerfSection` to render two stacked `<PerfData>` instances (desktop + mobile), fetched in parallel at RSC render time.

**Tech Stack:** Next.js 16 App Router · Upstash Redis (`getRedis()` from `lib/rate-limit.ts`) · Vercel cron · PageSpeed Insights API (`PSI_API_KEY`) · Vitest · `renderToStaticMarkup` for RSC tests

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/lighthouse-scores.ts` | Modify | Add `Strategy` type, split Redis keys, add `refreshScores`, extract `fetchAndCache` |
| `__tests__/lighthouse-scores.test.ts` | Create | Unit tests for `getScores` (cache-hit, cache-miss, fallback) + `refreshScores` |
| `__tests__/lighthouse-fallback.test.ts` | No change | Shape of `LIGHTHOUSE_FALLBACK` — unchanged |
| `app/api/psi-refresh/route.ts` | Create | Cron handler: auth check + parallel refresh + JSON response |
| `__tests__/psi-refresh-route.test.ts` | Create | 401 on bad auth, 200 with both strategies, partial failure |
| `vercel.json` | Create | `{ "crons": [{ "path": "/api/psi-refresh", "schedule": "0 3 * * *" }] }` |
| `components/sections/LivePerfSection/LivePerfSection.tsx` | Modify | Add `strategy` prop to `PerfData`; render two stacked blocks in `LivePerfSection` |
| `components/sections/LivePerfSection/LivePerfSection.module.css` | Modify | Add `.strategyBlock` + `.strategyLabel` |
| `components/sections/LivePerfSection/LivePerfSection.test.tsx` | Modify | Update mocks + assertions for desktop/mobile strategy args |
| `.env.example` | Modify | Add `CRON_SECRET` variable |
| `DECISIONS.md` | Modify | Document cron architecture, TTL rationale, strategy split |

---

## Task 1: Extend `lib/lighthouse-scores.ts`

**Files:**
- Modify: `lib/lighthouse-scores.ts`
- Create: `__tests__/lighthouse-scores.test.ts`

### Step 1: Write the failing tests

- [ ] Create `__tests__/lighthouse-scores.test.ts`:

```typescript
// __tests__/lighthouse-scores.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLogError = vi.fn();
vi.mock('@/lib/log', () => ({ log: { error: mockLogError, info: vi.fn() } }));

afterEach(() => {
  vi.resetModules();
  mockGet.mockReset();
  mockSet.mockReset();
  mockFetch.mockReset();
  mockLogError.mockReset();
});

const CACHED_DESKTOP = {
  performance: 99, accessibility: 100, bestPractices: 95, seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};

function makePsiResponse(score = 0.99) {
  return {
    ok: true,
    json: async () => ({
      lighthouseResult: {
        categories: {
          performance: { score },
          accessibility: { score: 1 },
          'best-practices': { score: 0.95 },
          seo: { score: 1 },
        },
      },
    }),
  };
}

describe('getScores — cache hit', () => {
  it('returns cached value without fetching PSI', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(CACHED_DESKTOP);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('defaults to desktop strategy', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores();
    expect(mockGet).toHaveBeenCalledWith('lh:scores:desktop');
  });

  it('uses lh:scores:mobile key for mobile strategy', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('mobile');
    expect(mockGet).toHaveBeenCalledWith('lh:scores:mobile');
  });
});

describe('getScores — cache miss', () => {
  it('fetches from PSI and returns scores', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.99));
    const { getScores } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result.performance).toBe(99);
    expect(result.fetchedAt).not.toBe('—');
    delete process.env.PSI_API_KEY;
  });

  it('writes result to Redis with TTL', async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.95));
    const { getScores, LIGHTHOUSE_TTL_S } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    // fire-and-forget; wait a tick for the promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSet).toHaveBeenCalledWith(
      'lh:scores:desktop',
      expect.objectContaining({ performance: 95 }),
      { ex: LIGHTHOUSE_TTL_S },
    );
    delete process.env.PSI_API_KEY;
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI_API_KEY is absent', async () => {
    mockGet.mockResolvedValue(null);
    delete process.env.PSI_API_KEY;
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns LIGHTHOUSE_FALLBACK when PSI fetch throws', async () => {
    mockGet.mockResolvedValue(null);
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('network error'));
    const { getScores, LIGHTHOUSE_FALLBACK } = await import('@/lib/lighthouse-scores');
    const result = await getScores('desktop');
    expect(result).toEqual(LIGHTHOUSE_FALLBACK);
    delete process.env.PSI_API_KEY;
  });
});

describe('refreshScores', () => {
  it('fetches from PSI even when cache is warm', async () => {
    mockGet.mockResolvedValue(CACHED_DESKTOP); // cache has data
    mockSet.mockResolvedValue('OK');
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(makePsiResponse(0.98));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const result = await refreshScores('desktop');
    expect(result.performance).toBe(98);
    expect(mockFetch).toHaveBeenCalledOnce(); // PSI was called despite warm cache
    delete process.env.PSI_API_KEY;
  });

  it('throws when PSI fetch fails', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('PSI down'));
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow('PSI down');
    delete process.env.PSI_API_KEY;
  });

  it('throws when PSI_API_KEY is absent', async () => {
    delete process.env.PSI_API_KEY;
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await expect(refreshScores('desktop')).rejects.toThrow();
  });
});
```

- [ ] Run the tests to confirm they fail:

```bash
pnpm test --run __tests__/lighthouse-scores.test.ts 2>&1 | tail -10
```

Expected: multiple failures — `getScores` doesn't accept a `strategy` param, `refreshScores` doesn't exist.

### Step 2: Implement the changes

- [ ] Replace `lib/lighthouse-scores.ts` with:

```typescript
import { log } from '@/lib/log';
import { getRedis } from './rate-limit';

export type Strategy = 'desktop' | 'mobile';

export type LighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fetchedAt: string;
};

export const LIGHTHOUSE_FALLBACK: LighthouseScores = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  fetchedAt: '—',
};

const CACHE_KEY = (strategy: Strategy) => `lh:scores:${strategy}`;
export const LIGHTHOUSE_TTL_S = 90_000; // 25 h — survives a missed cron run

async function fetchAndCache(strategy: Strategy): Promise<LighthouseScores> {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey) throw new Error('PSI_API_KEY is not set');

  const psiUrl =
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
    `?url=${encodeURIComponent('https://www.erikunha.dev')}` +
    `&strategy=${strategy}` +
    `&key=${apiKey}` +
    '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO';

  const res = await fetch(psiUrl, {
    next: { revalidate: LIGHTHOUSE_TTL_S },
    signal: AbortSignal.timeout(8_000),
    headers: { Referer: 'https://www.erikunha.dev/' },
  });
  if (!res.ok) throw new Error(`PSI API returned ${res.status}`);

  const data = (await res.json()) as {
    lighthouseResult?: {
      categories?: {
        performance?: { score?: number };
        accessibility?: { score?: number };
        'best-practices'?: { score?: number };
        seo?: { score?: number };
      };
    };
  };
  const cats = data.lighthouseResult?.categories ?? {};
  const scores: LighthouseScores = {
    performance: Math.round((cats.performance?.score ?? 1) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 1) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0.98) * 100),
    seo: Math.round((cats.seo?.score ?? 1) * 100),
    fetchedAt: new Date().toISOString(),
  };

  // Fire-and-forget — don't let cache failure block the response.
  getRedis()
    .set(CACHE_KEY(strategy), scores, { ex: LIGHTHOUSE_TTL_S })
    .catch((err) => log.error('Redis cache set failed', { err }));

  return scores;
}

/**
 * Cache-first. Returns cached scores if available; fetches from PSI on miss.
 * Falls back to LIGHTHOUSE_FALLBACK on any error. Default strategy: desktop.
 */
export async function getScores(strategy: Strategy = 'desktop'): Promise<LighthouseScores> {
  const cached = await getRedis()
    .get<LighthouseScores>(CACHE_KEY(strategy))
    .catch(() => null);
  if (cached) return cached;

  try {
    return await fetchAndCache(strategy);
  } catch (err) {
    log.error('PSI fetch failed', { err, strategy });
    return LIGHTHOUSE_FALLBACK;
  }
}

/**
 * Always fetches from PSI and updates cache. Used by the cron handler.
 * Throws on PSI failure — caller handles per-strategy via Promise.allSettled.
 */
export async function refreshScores(strategy: Strategy): Promise<LighthouseScores> {
  return fetchAndCache(strategy);
}
```

### Step 3: Run tests and verify

- [ ] Run:

```bash
pnpm test --run __tests__/lighthouse-scores.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] Run the full suite to check for regressions:

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: `655 passed` (all prior tests still pass).

### Step 4: Commit

- [ ] Run:

```bash
git add lib/lighthouse-scores.ts __tests__/lighthouse-scores.test.ts
git commit -m "feat(perf): split lighthouse scores by strategy (desktop/mobile), add refreshScores"
```

---

## Task 2: Cron Handler `app/api/psi-refresh/route.ts`

**Files:**
- Create: `app/api/psi-refresh/route.ts`
- Create: `__tests__/psi-refresh-route.test.ts`

### Step 1: Write the failing tests

- [ ] Create `__tests__/psi-refresh-route.test.ts`:

```typescript
// __tests__/psi-refresh-route.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRefreshScores = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: mockRefreshScores,
}));

const mockLogInfo = vi.fn();
vi.mock('@/lib/log', () => ({ log: { info: mockLogInfo, error: vi.fn() } }));

afterEach(() => {
  vi.resetModules();
  mockRefreshScores.mockReset();
  mockLogInfo.mockReset();
  delete process.env.CRON_SECRET;
});

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/psi-refresh', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

const DESKTOP_SCORES = {
  performance: 99, accessibility: 100, bestPractices: 95, seo: 100,
  fetchedAt: '2026-05-29T03:00:00.000Z',
};
const MOBILE_SCORES = {
  performance: 90, accessibility: 100, bestPractices: 95, seo: 100,
  fetchedAt: '2026-05-29T03:00:01.000Z',
};

describe('GET /api/psi-refresh — auth', () => {
  it('returns 401 when CRON_SECRET is not set', async () => {
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer anything') as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'secret123';
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'secret123';
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer wrong') as any);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/psi-refresh — success', () => {
  it('returns 200 with desktop and mobile scores', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockResolvedValueOnce(MOBILE_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toEqual(MOBILE_SCORES);
    expect(typeof body.durationMs).toBe('number');
  });

  it('calls refreshScores for both desktop and mobile', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores.mockResolvedValue(DESKTOP_SCORES);
    const { GET } = await import('@/app/api/psi-refresh/route');
    await GET(makeRequest('Bearer secret123') as any);
    expect(mockRefreshScores).toHaveBeenCalledWith('desktop');
    expect(mockRefreshScores).toHaveBeenCalledWith('mobile');
  });

  it('returns null for a failed strategy while the other succeeds', async () => {
    process.env.CRON_SECRET = 'secret123';
    mockRefreshScores
      .mockResolvedValueOnce(DESKTOP_SCORES)
      .mockRejectedValueOnce(new Error('mobile PSI failed'));
    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest('Bearer secret123') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.desktop).toEqual(DESKTOP_SCORES);
    expect(body.mobile).toBeNull();
  });
});
```

- [ ] Run to confirm they fail:

```bash
pnpm test --run __tests__/psi-refresh-route.test.ts 2>&1 | tail -10
```

Expected: module not found errors.

### Step 2: Implement the route

- [ ] Create `app/api/psi-refresh/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { log } from '@/lib/log';
import { refreshScores } from '@/lib/lighthouse-scores';

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const t0 = Date.now();
  const [desktopResult, mobileResult] = await Promise.allSettled([
    refreshScores('desktop'),
    refreshScores('mobile'),
  ]);

  const result = {
    desktop: desktopResult.status === 'fulfilled' ? desktopResult.value : null,
    mobile: mobileResult.status === 'fulfilled' ? mobileResult.value : null,
    durationMs: Date.now() - t0,
  };

  if (desktopResult.status === 'rejected') {
    log.error('psi-refresh desktop failed', { err: desktopResult.reason });
  }
  if (mobileResult.status === 'rejected') {
    log.error('psi-refresh mobile failed', { err: mobileResult.reason });
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs });
  return Response.json(result);
}
```

### Step 3: Run tests and verify

- [ ] Run:

```bash
pnpm test --run __tests__/psi-refresh-route.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] Full suite:

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: 655+ passed.

### Step 4: Commit

- [ ] Run:

```bash
git add app/api/psi-refresh/route.ts __tests__/psi-refresh-route.test.ts
git commit -m "feat(cron): add psi-refresh endpoint — auth-gated desktop+mobile PSI refresh"
```

---

## Task 3: `vercel.json` and `.env.example`

**Files:**
- Create: `vercel.json`
- Modify: `.env.example`

### Step 1: Create `vercel.json`

- [ ] Create `vercel.json` at the repo root:

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

No other configuration — Next.js app configuration lives in `next.config.ts`. Vercel reads `vercel.json` for cron schedules. The `0 3 * * *` expression means 3:00 AM UTC every day.

### Step 2: Update `.env.example`

- [ ] Add to the end of `.env.example`:

```
# Vercel Cron Secret — authenticates /api/psi-refresh cron invocations.
# Vercel automatically injects this as Authorization: Bearer <value> into cron requests.
# Set the same value in Vercel project settings > Environment Variables.
# Generate with: openssl rand -hex 32
CRON_SECRET=
```

### Step 3: Verify `pnpm ci:local` passes

- [ ] Run:

```bash
pnpm ci:local 2>&1 | tail -5
```

Expected: all gates pass.

### Step 4: Commit

- [ ] Run:

```bash
git add vercel.json .env.example
git commit -m "feat(cron): add vercel.json cron schedule for daily psi-refresh at 03:00 UTC"
```

---

## Task 4: Update `LivePerfSection` — Stacked Desktop + Mobile

**Files:**
- Modify: `components/sections/LivePerfSection/LivePerfSection.tsx`
- Modify: `components/sections/LivePerfSection/LivePerfSection.module.css`
- Modify: `components/sections/LivePerfSection/LivePerfSection.test.tsx`

### Step 1: Update the tests first

- [ ] Replace the contents of `components/sections/LivePerfSection/LivePerfSection.test.tsx`:

```typescript
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  },
}));

async function renderPerfData(strategy: 'desktop' | 'mobile'): Promise<string> {
  const { PerfData } = await import('./LivePerfSection');
  const element = await PerfData({ strategy });
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getScoresMock.mockReset();
});

describe('LivePerfSection — fetch-error fallback', () => {
  it('renders without throwing when getScores throws for desktop', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData('desktop')).resolves.toBeDefined();
  });

  it('renders without throwing when getScores throws for mobile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData('mobile')).resolves.toBeDefined();
  });

  it('does not render fabricated 100 scores on fetch failure for desktop', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData('desktop');
    expect(html).not.toContain('>100<');
  });

  it('does not render fabricated 100 scores on fetch failure for mobile', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData('mobile');
    expect(html).not.toContain('>100<');
  });
});

describe('LivePerfSection — strategy routing', () => {
  it('calls getScores with desktop strategy', async () => {
    getScoresMock.mockResolvedValue({
      performance: 99, accessibility: 100, bestPractices: 95, seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    await renderPerfData('desktop');
    expect(getScoresMock).toHaveBeenCalledWith('desktop');
  });

  it('calls getScores with mobile strategy', async () => {
    getScoresMock.mockResolvedValue({
      performance: 90, accessibility: 100, bestPractices: 95, seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    await renderPerfData('mobile');
    expect(getScoresMock).toHaveBeenCalledWith('mobile');
  });

  it('renders the score value from getScores', async () => {
    getScoresMock.mockResolvedValue({
      performance: 88, accessibility: 100, bestPractices: 95, seo: 100,
      fetchedAt: '2026-05-29T03:00:00.000Z',
    });
    const html = await renderPerfData('mobile');
    expect(html).toContain('88');
  });
});
```

- [ ] Run to confirm failures:

```bash
pnpm test --run components/sections/LivePerfSection 2>&1 | tail -10
```

Expected: failures — `PerfData` doesn't accept `strategy` prop yet.

### Step 2: Update `LivePerfSection.tsx`

- [ ] Replace `components/sections/LivePerfSection/LivePerfSection.tsx` with:

```typescript
import { Suspense } from 'react';
import { getScores, LIGHTHOUSE_FALLBACK, type LighthouseScores, type Strategy } from '@/lib/lighthouse-scores';
import { IconLivePerf } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './LivePerfSection.module.css';

export async function PerfData({ strategy }: { strategy: Strategy }) {
  const scores = await getScores(strategy).catch(() => LIGHTHOUSE_FALLBACK);
  return <PerfBody scores={scores} strategy={strategy} />;
}

function PerfBody({ scores, strategy }: { scores: LighthouseScores; strategy: Strategy }) {
  const isFallback = scores.fetchedAt === LIGHTHOUSE_FALLBACK.fetchedAt;
  const cells = [
    { label: 'PERFORMANCE', value: scores.performance },
    { label: 'ACCESSIBILITY', value: scores.accessibility },
    { label: 'BEST PRACTICES', value: scores.bestPractices },
    { label: 'SEO', value: scores.seo },
  ];

  const lastCheck =
    scores.fetchedAt && scores.fetchedAt !== '—'
      ? new Date(scores.fetchedAt).toUTCString().replace(':00 GMT', ' UTC')
      : '—';

  return (
    <div>
      <div className={styles.root}>
        {cells.map((s) => (
          <div key={s.label} className={styles.cell}>
            <div className={styles.pk}>{s.label}</div>
            <div className={styles.pv}>
              {isFallback ? '—' : s.value}
              <span className={styles.of}>/100</span>
            </div>
            <div className={styles.pbar}>
              <i style={{ width: isFallback ? '0%' : `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <span>
          <span className={styles.liveDot} />
          {isFallback
            ? 'SOURCE: PSI API unavailable'
            : `SOURCE: PageSpeed Insights · ${strategy}`}
        </span>
        <span>LAST_CHECK: {lastCheck}</span>
      </div>
    </div>
  );
}

function StrategyFallback({ strategy }: { strategy: string }) {
  return (
    <div aria-busy="true" style={{ opacity: 0.4 }}>
      <div className={styles.root}>
        {['PERFORMANCE', 'ACCESSIBILITY', 'BEST PRACTICES', 'SEO'].map((label) => (
          <div key={label} className={styles.cell}>
            <div className={styles.pk}>{label}</div>
            <div className={styles.pv}>
              —<span className={styles.of}>/100</span>
            </div>
            <div className={styles.pbar}>
              <i style={{ width: '0%' }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <span>
          <span className={styles.liveDot} />
          {strategy} · loading...
        </span>
      </div>
    </div>
  );
}

function PerfFallback() {
  return (
    <>
      <div className={styles.strategyBlock}>
        <p className={styles.strategyLabel}>DESKTOP</p>
        <StrategyFallback strategy="desktop" />
      </div>
      <div className={styles.strategyBlock}>
        <p className={styles.strategyLabel}>MOBILE</p>
        <StrategyFallback strategy="mobile" />
      </div>
    </>
  );
}

export function LivePerfSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-live-perf"
      header="LIVE_PERF.JSON"
      mobileHeader="LIVE_PERF · LIGHTHOUSE"
      icon={<IconLivePerf />}
      defer={defer}
    >
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
    </Module>
  );
}
```

### Step 3: Update `LivePerfSection.module.css`

- [ ] Add to the end of `components/sections/LivePerfSection/LivePerfSection.module.css` (before the final closing brace of any media query — append at file end):

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

### Step 4: Run tests and verify

- [ ] Run:

```bash
pnpm test --run components/sections/LivePerfSection 2>&1 | tail -10
```

Expected: all pass.

- [ ] Full suite:

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: 655+ passed (new tests add to total).

- [ ] Full CI gate:

```bash
pnpm ci:local 2>&1 | tail -5
```

Expected: all gates pass.

### Step 5: Commit

- [ ] Run:

```bash
git add components/sections/LivePerfSection/
git commit -m "feat(perf): live-perf section shows desktop + mobile lighthouse scores stacked"
```

---

## Task 5: DECISIONS.md + Final Gate

**Files:**
- Modify: `DECISIONS.md`

### Step 1: Add the DECISIONS.md entry

- [ ] Append to `DECISIONS.md` (after the last existing entry):

```markdown
## 2026-05-29 — PSI refresh cron: desktop + mobile Lighthouse scores

- **2026-05-29** — **Vercel cron added for daily PSI refresh** (`vercel.json`, `app/api/psi-refresh/route.ts`). Runs at 03:00 UTC daily. Before this, the `lh:scores` Redis key expired after 24h and the first post-expiry visitor triggered a live PSI fetch (8s timeout, fallback to zeroes on failure). The cron ensures the cache is always warm. Auth: `Authorization: Bearer {CRON_SECRET}` — Vercel injects this automatically; any other caller gets 401. _Reversible: remove `vercel.json` crons entry; cache-on-demand resumes._
- **2026-05-29** — **Lighthouse score cache split by strategy**: `lh:scores` (old, single key) replaced by `lh:scores:desktop` and `lh:scores:mobile`. TTL raised from 24h to 25h to survive a single missed cron run. The old `lh:scores` key orphans in Redis and expires on its own. `getScores()` default arg (`'desktop'`) preserves backward compat for `/api/lighthouse`. `refreshScores(strategy)` added for cron use — always fetches, throws on failure, caller handles via `Promise.allSettled`. _Reversible: revert `lib/lighthouse-scores.ts`; the old single-key behavior returns._
- **2026-05-29** — **LIVE_PERF.JSON section now shows both desktop and mobile scores** in a stacked layout. Two `<PerfData strategy>` RSC instances inside one `<Suspense>` — React fetches both in parallel. Each fails independently (mobile fallback does not block desktop display). No client island added. _Reversible: revert `LivePerfSection.tsx` to single-strategy render._
```

### Step 2: Final CI gate

- [ ] Run:

```bash
pnpm ci:local 2>&1 | tail -5
```

Expected: all gates pass.

- [ ] Count tests to confirm additions landed:

```bash
pnpm test --run 2>&1 | grep "Tests "
```

Expected: more than 655 tests (new lighthouse-scores + psi-refresh-route tests added).

### Step 3: Commit

- [ ] Run:

```bash
git add DECISIONS.md
git commit -m "docs(decisions): document psi refresh cron, strategy split, stacked live-perf display"
```

---

## Failure-Mode Checklist

Generated from `thinking-inversion` before writing this plan:

| Bug class | Mitigation in plan |
|---|---|
| `CRON_SECRET` unset → any caller can trigger expensive PSI fetches | Handler fails closed: `if (!cronSecret) return 401` |
| Mobile PSI failure blocks desktop cache write | `Promise.allSettled` — each is independent |
| Cache key collision between old `lh:scores` and new `lh:scores:desktop` | Different key names; old key orphans and expires |
| `getScores()` callers break when `strategy` param added | Default arg `strategy: Strategy = 'desktop'` preserves compat |
| `refreshScores` silently returns fallback instead of throwing | `refreshScores` throws; `getScores` catches — tested separately |
| 25h TTL not long enough if cron skips two days | TTL is per-strategy; two skipped days = 48h; fallback shows `—` after 25h — acceptable |
| Suspense boundary shows partial state if one strategy loads faster | Both `PerfData` inside one `<Suspense>` — all-or-nothing display |
| Test mocks `getScores` globally, breaks strategy routing tests | Tests use `vi.resetModules()` + per-strategy mock expectations |
| Lint-token-boundary flag on `.strategyBlock` CSS if using raw hex or magic values | New CSS uses only `var(--ds-color-*)` tokens and `px` values consistent with existing file |
