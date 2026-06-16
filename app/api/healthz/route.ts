import type { NextRequest } from 'next/server';
import { log } from '@/lib/log';
import { getClientIp, getHealthzLimit, getRedis } from '@/lib/rate-limit';

// WHY: PSI cron runs daily (vercel.json: 0 3); the Hobby plan caps crons at once per
// day, so 25h is the tightest window that still tolerates schedule drift (Hobby cron
// timing is ±59 min) before marking stale.
const PSI_STALE_MS = 25 * 60 * 60 * 1000;
const PSI_CACHE_TTL_MS = 5_000;

// WHY: per-instance cache — each Fluid Compute instance has its own 5s window.
// Multiple warm instances may each make one Redis read per 5s burst; this is
// acceptable and collapses per-instance burst reads without a shared cache layer.
let _psiCache: { psiLastRun: string | null; cachedAt: number } | null = null;

export async function GET(req: NextRequest): Promise<Response> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  // Rate limit — fail-open on Redis error so the monitoring endpoint stays available.
  try {
    const ip = getClientIp(req);
    const { success } = await getHealthzLimit().limit(ip);
    if (!success) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }
  } catch (err) {
    log.warn('healthz rate-limit unavailable, allowing request', { err });
  }

  let psiLastRun: string | null = null;
  let status: 'ok' | 'degraded' = 'ok';

  try {
    const now = Date.now();
    if (_psiCache && now - _psiCache.cachedAt < PSI_CACHE_TTL_MS) {
      psiLastRun = _psiCache.psiLastRun;
    } else {
      psiLastRun = await getRedis().get<string>('meta:psi-last-run');
      _psiCache = { psiLastRun, cachedAt: now };
    }

    if (!psiLastRun) {
      status = 'degraded';
    } else {
      const ts = new Date(psiLastRun).getTime();
      if (Number.isNaN(ts) || Date.now() - ts > PSI_STALE_MS) {
        status = 'degraded';
      }
    }
  } catch {
    status = 'degraded';
  }

  return Response.json(
    { status, sha, psiLastRun },
    {
      status: status === 'ok' ? 200 : 503,
      // WHY: monitoring endpoint must never be cached; a stale response is a false health signal.
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
