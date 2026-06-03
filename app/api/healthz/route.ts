import { getRedis } from '@/lib/rate-limit';

// WHY: PSI cron runs daily; 25h window allows for schedule drift before marking stale.
const PSI_STALE_MS = 25 * 60 * 60 * 1000;

export async function GET(): Promise<Response> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  let psiLastRun: string | null = null;
  let status: 'ok' | 'degraded' = 'ok';

  try {
    psiLastRun = await getRedis().get<string>('meta:psi-last-run');
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
