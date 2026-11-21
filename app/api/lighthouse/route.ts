import { unstable_rethrow } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { HTTP_STATUS } from '@/lib/http-status';
import { getScores, LIGHTHOUSE_FALLBACK, LIGHTHOUSE_TTL_S } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getLighthouseLimit } from '@/lib/rate-limit';
import { clientRateLimitKey } from '@/lib/server/rate-limit-key';
import { err } from '@/lib/server/route';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { success } = await getLighthouseLimit().limit(await clientRateLimitKey(req));
    if (!success) {
      return err({
        requestId: crypto.randomUUID(),
        status: HTTP_STATUS.tooManyRequests,
        code: 'rate_limited',
        message: 'too many requests',
        extraHeaders: { 'Cache-Control': 'no-store' },
      });
    }
  } catch (err) {
    unstable_rethrow(err);
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
