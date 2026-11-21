import { connection, type NextRequest } from 'next/server';
import { commitSha } from '@/lib/env-build';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { getHealthzLimit } from '@/lib/rate-limit';
import { getRedis } from '@/lib/redis';
import { clientRateLimitKey } from '@/lib/server/rate-limit-key';
import { err } from '@/lib/server/route';

const RETRY_AFTER_SECONDS = '60';
const PSI_LAST_RUN_KEY = 'meta:psi-last-run';
const PSI_STALE_MS = 25 * 60 * 60 * 1000;
const PSI_CACHE_TTL_MS = 5_000;

let _psiCache: { psiLastRun: string | null; cachedAt: number } | null = null;

async function readPsiLastRun(now: number): Promise<string | null> {
  if (_psiCache && now - _psiCache.cachedAt < PSI_CACHE_TTL_MS) return _psiCache.psiLastRun;
  const psiLastRun = await getRedis().get<string>(PSI_LAST_RUN_KEY);
  _psiCache = { psiLastRun, cachedAt: now };
  return psiLastRun;
}

export async function GET(req: NextRequest): Promise<Response> {
  await connection();
  const sha = commitSha();

  try {
    const { success } = await getHealthzLimit().limit(await clientRateLimitKey(req));
    if (!success) {
      return err({
        requestId: crypto.randomUUID(),
        status: HTTP_STATUS.tooManyRequests,
        code: 'rate_limited',
        message: 'too many requests',
        extraHeaders: { 'Cache-Control': 'no-store', 'Retry-After': RETRY_AFTER_SECONDS },
      });
    }
  } catch (err) {
    log.warn('status rate-limit unavailable, allowing request', { err });
  }

  let psiLastRun: string | null = null;
  try {
    psiLastRun = await readPsiLastRun(Date.now());
  } catch {
    psiLastRun = null;
  }

  const lastRunMs = psiLastRun ? new Date(psiLastRun).getTime() : Number.NaN;
  const psiAgeMs = Number.isNaN(lastRunMs) ? null : Math.max(0, Date.now() - lastRunMs);
  const stale = psiAgeMs === null || psiAgeMs > PSI_STALE_MS;

  return Response.json(
    { sha, stale, psiLastRun, psiAgeMs },
    { status: HTTP_STATUS.ok, headers: { 'Cache-Control': 'no-store' } },
  );
}
