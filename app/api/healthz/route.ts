import { connection, type NextRequest } from 'next/server';
import { log } from '@/lib/log';
import { getHealthzLimit, getRedis } from '@/lib/rate-limit';
import { clientRateLimitKey } from '@/lib/server/rate-limit-key';
import { err } from '@/lib/server/route';

const HTTP_TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_SECONDS = '60';
const PSI_STALE_MS = 25 * 60 * 60 * 1000;
const PSI_CACHE_TTL_MS = 5_000;

let _psiCache: { psiLastRun: string | null; cachedAt: number } | null = null;

export async function GET(req: NextRequest): Promise<Response> {
  await connection();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  try {
    const { success } = await getHealthzLimit().limit(await clientRateLimitKey(req));
    if (!success) {
      return err({
        requestId: crypto.randomUUID(),
        status: HTTP_TOO_MANY_REQUESTS,
        code: 'rate_limited',
        message: 'too many requests',
        extraHeaders: { 'Cache-Control': 'no-store', 'Retry-After': RETRY_AFTER_SECONDS },
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
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
