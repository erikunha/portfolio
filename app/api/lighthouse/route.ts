import type { NextRequest } from 'next/server';
import { getScores, LIGHTHOUSE_FALLBACK, LIGHTHOUSE_TTL_S } from '@/lib/lighthouse-scores';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<Response> {
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
