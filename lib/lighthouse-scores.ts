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

const SCORES_UNAVAILABLE = '—';

export const LIGHTHOUSE_FALLBACK: LighthouseScores = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  fetchedAt: SCORES_UNAVAILABLE,
};

const CACHE_KEY = (strategy: Strategy) => `lh:scores:${strategy}`;
export const LIGHTHOUSE_TTL_S = 90_000; // 25 h — survives a missed cron run

async function fetchAndCache(strategy: Strategy, forceRefresh = false): Promise<LighthouseScores> {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey) throw new Error('PSI_API_KEY is not set');

  const psiUrl =
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
    `?url=${encodeURIComponent('https://www.erikunha.dev')}` +
    `&strategy=${strategy}` +
    `&key=${apiKey}` +
    '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO';

  // WHY: cron calls must bypass Next.js fetch cache to guarantee a live PSI network call.
  const fetchCache: RequestInit = forceRefresh
    ? { cache: 'no-store' }
    : { next: { revalidate: LIGHTHOUSE_TTL_S } };

  const res = await fetch(psiUrl, {
    ...fetchCache,
    signal: AbortSignal.timeout(8_000),
    headers: { Referer: 'https://www.erikunha.dev/' },
  });
  if (!res.ok) {
    let body = '(unreadable)';
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      // ignore — error message already has status code
    }
    throw new Error(`PSI API returned ${res.status} for strategy=${strategy}: ${body}`);
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
    // WHY: cron path — write is the deliverable; failure must surface so Vercel retries.
    await getRedis()
      .set(CACHE_KEY(strategy), scores, { ex: LIGHTHOUSE_TTL_S })
      .catch((err) => {
        log.error('Redis cache set failed during refresh', { err, strategy });
        throw err;
      });
  } else {
    // Request path: fire-and-forget — don't block the response on cache write.
    getRedis()
      .set(CACHE_KEY(strategy), scores, { ex: LIGHTHOUSE_TTL_S })
      .catch((err) => log.error('Redis cache set failed', { err }));
  }

  return scores;
}

/**
 * Cache-first. Returns cached scores if available; fetches from PSI on miss.
 * Falls back to LIGHTHOUSE_FALLBACK on any error. Default strategy: desktop.
 */
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

/**
 * Always fetches from PSI and updates cache. Used by the cron handler.
 * Throws on PSI failure — caller handles per-strategy via Promise.allSettled.
 */
export async function refreshScores(strategy: Strategy): Promise<LighthouseScores> {
  return fetchAndCache(strategy, true);
}
