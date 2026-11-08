import {
  dropRedisCredentials,
  EVAL_PUBLISH_ENV,
  isPublishEnabled,
  type RedisCredentials,
  restoreRedisCredentials,
} from '@/lib/eval/publish-gate';
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

export async function publishWithCredentials(
  key: string,
  aggregate: unknown,
  credentials: RedisCredentials,
): Promise<PublishResult> {
  restoreRedisCredentials(process.env, credentials);
  try {
    return await publishAggregate(key, aggregate);
  } finally {
    dropRedisCredentials(process.env, credentials);
  }
}
