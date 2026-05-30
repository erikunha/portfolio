import type { NextRequest } from 'next/server';
import { refreshScores } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const t0 = Date.now();
  const [desktopResult, mobileResult] = await Promise.allSettled([
    refreshScores('desktop'),
    refreshScores('mobile'),
  ]);

  const result = {
    desktop: desktopResult.status === 'fulfilled' ? desktopResult.value : null,
    mobile: mobileResult.status === 'fulfilled' ? mobileResult.value : null,
    durationMs: Date.now() - t0,
  };

  if (desktopResult.status === 'rejected') {
    log.error('psi-refresh desktop failed', { err: desktopResult.reason });
  }
  if (mobileResult.status === 'rejected') {
    log.error('psi-refresh mobile failed', { err: mobileResult.reason });
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs });
  return Response.json(result);
}
