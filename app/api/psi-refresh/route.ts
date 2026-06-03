import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { refreshScores } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

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

  const anyFailed = desktopResult.status === 'rejected' || mobileResult.status === 'rejected';

  if (anyFailed) {
    const errors = [desktopResult, mobileResult]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
      .join('; ');

    log.error('psi-refresh failed', { errors });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      log.error('psi-refresh: RESEND_API_KEY not set, skipping alert');
    } else {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: 'alerts@erikunha.dev',
          to: 'erikhenriquealvescunha@gmail.com',
          subject: '[portfolio] psi-refresh cron failed',
          text: `One or more PSI refreshes failed.\n\nErrors: ${errors}\nTimestamp: ${new Date().toISOString()}`,
        });
      } catch (alertErr) {
        // Alert delivery failure must not mask the original error or change the response.
        log.error('psi-refresh alert email failed to send', { err: alertErr });
      }
    }
  } else {
    // Both succeeded — record the timestamp so /api/healthz can report freshness.
    try {
      await getRedis().set('meta:psi-last-run', new Date().toISOString());
    } catch (redisErr) {
      // WHY: Redis write failure must not corrupt cron return code; PSI data is already stored.
      log.error('psi-refresh: failed to write meta:psi-last-run', { err: redisErr });
    }
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs, anyFailed });
  // WHY: non-2xx signals Vercel Cron to retry and surface the failure in the dashboard.
  return Response.json(result, { status: anyFailed ? 500 : 200 });
}
