import { getRedis } from '@/lib/rate-limit';

export async function GET(): Promise<Response> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  let psiLastRun: string | null = null;
  let status: 'ok' | 'degraded' = 'ok';

  try {
    psiLastRun = await getRedis().get<string>('meta:psi-last-run');
  } catch {
    status = 'degraded';
  }

  return Response.json({ status, sha, psiLastRun }, { status: status === 'ok' ? 200 : 503 });
}
