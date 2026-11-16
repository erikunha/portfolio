import { connection, type NextRequest } from 'next/server';
import { commitSha } from '@/lib/env-build';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { getHealthzLimit } from '@/lib/rate-limit';
import { getRedis } from '@/lib/redis';
import { clientRateLimitKey } from '@/lib/server/rate-limit-key';
import { err } from '@/lib/server/route';

const RETRY_AFTER_SECONDS = '60';

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
    log.warn('healthz rate-limit unavailable, allowing request', { err });
  }

  let status: 'ok' | 'degraded' = 'ok';

  try {
    await getRedis().ping();
  } catch {
    status = 'degraded';
  }

  return Response.json(
    { status, sha },
    {
      status: status === 'ok' ? HTTP_STATUS.ok : HTTP_STATUS.serviceUnavailable,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
