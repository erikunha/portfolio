import { EVAL_PUBLISH_ENV, isPublishEnabled } from '@/lib/eval/publish-gate';
import { getRedis, hasRedisCredentials } from '@/lib/rate-limit';

export type PublishResult = { published: boolean; skipped?: string; error?: string };

export async function publishAggregate(key: string, aggregate: unknown): Promise<PublishResult> {
  if (!isPublishEnabled(process.env)) {
    return { published: false, skipped: `${EVAL_PUBLISH_ENV} is not set` };
  }
  if (!hasRedisCredentials()) {
    return { published: false, skipped: 'no Redis credentials' };
  }
  try {
    await getRedis().set(key, JSON.stringify(aggregate));
    return { published: true };
  } catch (err) {
    return { published: false, error: err instanceof Error ? err.message : String(err) };
  }
}
