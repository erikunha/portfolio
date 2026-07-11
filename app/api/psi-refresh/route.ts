import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { refreshScores, type Strategy } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const PSI_CONSEC_KEY = (s: Strategy) => `meta:psi-consec-failures:${s}`;
const PSI_CONSEC_TTL_S = 604_800;
const PSI_ALERT_THRESHOLD = 3;

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = env.CRON_SECRET;
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
  const anySucceeded = desktopResult.status === 'fulfilled' || mobileResult.status === 'fulfilled';

  if (anyFailed) {
    const errors = (
      [
        ['desktop', desktopResult],
        ['mobile', mobileResult],
      ] as Array<[string, PromiseSettledResult<unknown>]>
    )
      .filter((e): e is [string, PromiseRejectedResult] => e[1].status === 'rejected')
      .map(([s, r]) => `${s}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
      .join('; ');

    log.error('psi-refresh failed', { errors });
  }

  const strategies: Array<['desktop' | 'mobile', PromiseSettledResult<unknown>]> = [
    ['desktop', desktopResult],
    ['mobile', mobileResult],
  ];
  const overThreshold: Array<{ strategy: string; count: number; error: string }> = [];
  for (const [name, r] of strategies) {
    try {
      const key = PSI_CONSEC_KEY(name);
      if (r.status === 'fulfilled') {
        await getRedis().del(key);
      } else {
        const pipe = getRedis().pipeline();
        pipe.incr(key);
        pipe.expire(key, PSI_CONSEC_TTL_S);
        const [count] = await pipe.exec<[number, number]>();
        if (count >= PSI_ALERT_THRESHOLD) {
          overThreshold.push({
            strategy: name,
            count,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    } catch (counterErr) {
      log.error(
        'psi-refresh: consecutive-failure counter update failed for a strategy — that strategy skipped this run',
        { strategy: name, err: counterErr },
      );
    }
  }

  if (overThreshold.length > 0) {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      log.error('psi-refresh: RESEND_API_KEY not set, skipping alert');
    } else {
      try {
        const resend = new Resend(apiKey);
        const alertText = overThreshold
          .map((o) => `${o.strategy}: ${o.count} consecutive failures — ${o.error}`)
          .join('\n');
        const sendPromise = resend.emails.send({
          from: 'alerts@erikunha.dev',
          to: 'erikhenriquealvescunha@gmail.com',
          subject: '[portfolio] psi-refresh cron failed',
          text: `One or more PSI strategies have reached ${PSI_ALERT_THRESHOLD}+ consecutive failures.\n\n${alertText}\nTimestamp: ${new Date().toISOString()}`,
        });
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error('resend alert timeout (5s)')), 5_000);
        });
        try {
          const { error: sendError } = await Promise.race([sendPromise, timeoutPromise]);
          if (sendError) {
            log.error('psi-refresh alert email API error', { err: sendError });
          }
        } finally {
          clearTimeout(timerId);
        }
      } catch (alertErr) {
        log.error('psi-refresh alert email failed to send', { err: alertErr });
      }
    }
  }

  if (anySucceeded) {
    try {
      await getRedis().set('meta:psi-last-run', new Date().toISOString());
    } catch (redisErr) {
      log.error('psi-refresh: failed to write meta:psi-last-run — healthz will report degraded', {
        err: redisErr,
      });
    }
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs, anyFailed });
  return Response.json(result, { status: anyFailed ? 500 : 200 });
}
