import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { refreshScores, type Strategy } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const PSI_CONSEC_KEY = (s: Strategy) => `meta:psi-consec-failures:${s}`;
const PSI_CONSEC_TTL_S = 604_800; // 7d GC backstop; reset-on-success is primary
const PSI_ALERT_THRESHOLD = 3;

// WHY: this cron fires two PSI audits in parallel; each can take 15–40s (see
// PSI_REFRESH_TIMEOUT_MS=45s in lib/lighthouse-scores.ts). The default function budget
// would kill the invocation before PSI returns, so the freshness key is never written
// and /api/healthz stays degraded. 60s is the Hobby-plan ceiling; the worst case —
// both PSI fetches at 45s (parallel, so ~45s wall) + the 5s failure-path Resend alert —
// lands ~51s, leaving headroom to return the structured response before a force-kill.
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

  // WHY: a single transient 429/5xx no longer emails — only >= PSI_ALERT_THRESHOLD
  // CONSECUTIVE failures for a given strategy do. This block is isolated in its own
  // try/catch, independent of the meta:psi-last-run freshness write below: a Redis
  // outage here must fail quiet (log + skip alerting), never mask the cron's response
  // or block the freshness write that /api/healthz depends on.
  const strategies: Array<['desktop' | 'mobile', PromiseSettledResult<unknown>]> = [
    ['desktop', desktopResult],
    ['mobile', mobileResult],
  ];
  const overThreshold: Array<{ strategy: string; count: number; error: string }> = [];
  try {
    for (const [name, r] of strategies) {
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
    }
  } catch (counterErr) {
    // Fail-quiet: counter/Redis failure must not throw or reintroduce email noise;
    // /api/healthz already covers Redis-down via the freshness key below.
    log.error('psi-refresh: consecutive-failure counter update failed — alert gating skipped', {
      err: counterErr,
    });
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
        // WHY: Resend SDK lacks native AbortSignal; race a 5s timer to avoid
        // blocking the cron response if the alert API hangs. 5s (not 10s) keeps the
        // worst-case wall time — two PSI fetches at 45s + this alert on the failure
        // path — safely under maxDuration=60 so the structured 500 still returns
        // before Vercel force-kills the function. The alert is best-effort.
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
        // Alert delivery failure must not mask the original error or change the response.
        log.error('psi-refresh alert email failed to send', { err: alertErr });
      }
    }
  }

  if (anySucceeded) {
    // WHY: record freshness when AT LEAST ONE strategy succeeded, not only on full
    // success. The Hobby plan caps the cron at once/day (a more frequent schedule fails
    // deployment), so gating the key on both-success meant a single transient mobile
    // timeout left /api/healthz degraded for ~a full day. A partial failure still returns
    // 500 and alerts (above), so the failure stays visible; per-strategy scores still
    // degrade independently via the lh:scores:* cache TTL. Total failure skips this block
    // (anySucceeded === false) so a genuine outage still degrades healthz.
    try {
      await getRedis().set('meta:psi-last-run', new Date().toISOString());
    } catch (redisErr) {
      // WHY: Redis write failure must not corrupt cron return code; PSI data is already stored.
      // WHY: healthz depends on this key to report freshness. A write failure
      // here means healthz will report degraded/503 until the next successful
      // cron run — the cron dashboard will show 200 with no obvious correlation.
      log.error('psi-refresh: failed to write meta:psi-last-run — healthz will report degraded', {
        err: redisErr,
      });
    }
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs, anyFailed });
  // WHY: non-2xx surfaces the failure in the Vercel Cron dashboard and triggers the
  // alert email. Vercel Cron does NOT auto-retry on failure; it only re-fires at the
  // next scheduled tick, and the Hobby plan caps the cron at once per day (a more
  // frequent schedule fails deployment). The freshness key is written on partial success
  // (see above), so a single transient mobile timeout still returns 500 + alerts here
  // but no longer degrades /api/healthz; only a total failure does.
  return Response.json(result, { status: anyFailed ? 500 : 200 });
}
