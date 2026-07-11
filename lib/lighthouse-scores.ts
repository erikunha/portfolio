import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { getRedis } from './rate-limit';

class PsiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PsiHttpError';
  }
}

export type Strategy = 'desktop' | 'mobile';

export type LighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fetchedAt: string;
};

const SCORES_UNAVAILABLE = '—';

export const LIGHTHOUSE_FALLBACK: LighthouseScores = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  fetchedAt: SCORES_UNAVAILABLE,
};

const CACHE_KEY = (strategy: Strategy) => `lh:scores:${strategy}`;
export const LIGHTHOUSE_TTL_S = 90_000;

export const PSI_REFRESH_TIMEOUT_MS = 45_000;
export const PSI_REQUEST_TIMEOUT_MS = 8_000;

export const PSI_STRATEGY_BUDGET_MS = 50_000;
export const PSI_MIN_RETRY_BUDGET_MS = 8_000;
export const PSI_RETRY_BACKOFF_MS = 500;
export const PSI_MAX_ATTEMPTS = 2;

let _now: () => number = () => Date.now();
export function __setNowForTest(fn: (() => number) | null): void {
  _now = fn ?? (() => Date.now());
}

function isRetryablePsiError(err: unknown): err is PsiHttpError {
  return (
    err instanceof PsiHttpError && (err.status === 429 || (err.status >= 500 && err.status <= 599))
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchScoresOnce(
  strategy: Strategy,
  timeoutMs: number,
  forceRefresh: boolean,
): Promise<LighthouseScores> {
  const apiKey = env.PSI_API_KEY;
  if (!apiKey) throw new Error('PSI_API_KEY is not set');

  const psiUrl =
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
    `?url=${encodeURIComponent('https://www.erikunha.dev')}` +
    `&strategy=${strategy}` +
    `&key=${apiKey}` +
    '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO';

  const fetchCache: RequestInit = forceRefresh
    ? { cache: 'no-store' }
    : { next: { revalidate: LIGHTHOUSE_TTL_S } };

  const res = await fetch(psiUrl, {
    ...fetchCache,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Referer: 'https://www.erikunha.dev/' },
  });
  if (!res.ok) {
    let body = '(unreadable)';
    try {
      body = (await res.text()).slice(0, 500);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
    throw new PsiHttpError(
      res.status,
      `PSI API returned ${res.status} for strategy=${strategy}: ${body}`,
    );
  }

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

  if (forceRefresh) {
    await getRedis()
      .set(CACHE_KEY(strategy), scores, { ex: LIGHTHOUSE_TTL_S })
      .catch((err) => {
        log.error('Redis cache set failed during refresh', { err, strategy });
        throw err;
      });
  } else {
    getRedis()
      .set(CACHE_KEY(strategy), scores, { ex: LIGHTHOUSE_TTL_S })
      .catch((err) => log.error('Redis cache set failed', { err }));
  }

  return scores;
}

async function fetchAndCache(strategy: Strategy, forceRefresh = false): Promise<LighthouseScores> {
  if (!forceRefresh) {
    return fetchScoresOnce(strategy, PSI_REQUEST_TIMEOUT_MS, false);
  }
  const start = _now();
  for (let attempt = 1; ; attempt++) {
    const remaining = PSI_STRATEGY_BUDGET_MS - (_now() - start);
    const perAttempt = Math.min(PSI_REFRESH_TIMEOUT_MS, Math.max(0, remaining));
    try {
      return await fetchScoresOnce(strategy, perAttempt, true);
    } catch (err) {
      const budgetLeft = PSI_STRATEGY_BUDGET_MS - (_now() - start);
      if (
        attempt >= PSI_MAX_ATTEMPTS ||
        !isRetryablePsiError(err) ||
        budgetLeft < PSI_MIN_RETRY_BUDGET_MS
      ) {
        throw err;
      }
      await sleep(PSI_RETRY_BACKOFF_MS + Math.floor(Math.random() * 500));
    }
  }
}

export async function getScores(strategy: Strategy = 'desktop'): Promise<LighthouseScores> {
  const cached = await getRedis()
    .get<LighthouseScores>(CACHE_KEY(strategy))
    .catch((err) => {
      log.error('Redis cache GET failed', { err, strategy });
      return null;
    });
  if (cached) return cached;

  try {
    return await fetchAndCache(strategy);
  } catch (err) {
    log.error('PSI fetch failed', { err, strategy });
    return LIGHTHOUSE_FALLBACK;
  }
}

export async function refreshScores(strategy: Strategy): Promise<LighthouseScores> {
  return fetchAndCache(strategy, true);
}
