import type { NextRequest } from 'next/server';
import { getScores, LIGHTHOUSE_FALLBACK, LIGHTHOUSE_TTL_S } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getClientIp, getLighthouseLimit } from '@/lib/rate-limit';

const TOO_MANY_REQUESTS_STATUS = 429;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { success } = await getLighthouseLimit().limit(getClientIp(req));
    if (!success) {
      return new Response('Too Many Requests', {
        status: TOO_MANY_REQUESTS_STATUS,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch (err) {
    log.warn('lighthouse rate-limit unavailable, allowing request', { err });
  }

  try {
    const scores = await getScores();
    const isFallback = scores.fetchedAt === LIGHTHOUSE_FALLBACK.fetchedAt;
    return Response.json(scores, {
      headers: isFallback
        ? { 'Cache-Control': 'no-store' }
        : { 'Cache-Control': `public, max-age=${LIGHTHOUSE_TTL_S}, stale-while-revalidate=3600` },
    });
  } catch {
    return Response.json(LIGHTHOUSE_FALLBACK, { headers: { 'Cache-Control': 'no-store' } });
  }
}
