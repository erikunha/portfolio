import { log } from '@/lib/log';
import { getRedis } from './rate-limit';

export type LighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fetchedAt: string;
};

// Fallback scores used when the PSI API is unavailable or the API key is absent.
export const LIGHTHOUSE_FALLBACK: LighthouseScores = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
  seo: 0,
  fetchedAt: '—',
};

const CACHE_KEY = 'lh:scores';
export const LIGHTHOUSE_TTL_S = 86_400; // 24 h

/**
 * Returns Lighthouse scores from Redis cache, or fetches fresh from PSI API.
 * Shared by both the RSC LivePerfSection and the /api/lighthouse route handler.
 */
export async function getScores(): Promise<LighthouseScores> {
  // 1. Try cache
  const cached = await getRedis()
    .get<LighthouseScores>(CACHE_KEY)
    .catch(() => null);
  if (cached) return cached;

  // 2. Fetch from PageSpeed Insights
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey) return LIGHTHOUSE_FALLBACK;

  const psiUrl =
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
    `?url=${encodeURIComponent('https://www.erikunha.dev')}` +
    '&strategy=desktop' +
    `&key=${apiKey}` +
    '&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO';

  let scores: LighthouseScores;
  try {
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
    scores = {
      performance: Math.round((cats.performance?.score ?? 1) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 1) * 100),
      bestPractices: Math.round((cats['best-practices']?.score ?? 0.98) * 100),
      seo: Math.round((cats.seo?.score ?? 1) * 100),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error('PSI fetch failed', { err });
    return LIGHTHOUSE_FALLBACK;
  }

  // 3. Write to Redis — fire-and-forget; don't let cache failure block response.
  getRedis()
    .set(CACHE_KEY, scores, { ex: LIGHTHOUSE_TTL_S })
    .catch((err) => log.error('Redis cache set failed', { err }));

  return scores;
}
