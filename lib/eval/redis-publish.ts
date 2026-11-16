import {
  dropRedisCredentials,
  EVAL_PUBLISH_ENV,
  isPublishEnabled,
  type RedisCredentials,
  restoreRedisCredentials,
} from '@/lib/eval/publish-gate';
import { getRedis, hasRedisCredentials } from '@/lib/rate-limit';

const REDACTED = '[redacted]';
const REST_CREDENTIAL_NAME = /REST.*(URL|TOKEN)$/;
const URL_IN_TEXT = /https?:\/\/\S+/gi;

function redactSecrets(message: string): string {
  let redacted = message.replace(URL_IN_TEXT, REDACTED);
  for (const [name, value] of Object.entries(process.env)) {
    if (value && REST_CREDENTIAL_NAME.test(name)) redacted = redacted.split(value).join(REDACTED);
  }
  return redacted;
}

export type PublishResult = { published: boolean; skipped?: string; error?: string };

export async function publishAggregate(key: string, aggregate: unknown): Promise<PublishResult> {
  if (!isPublishEnabled(process.env)) {
    return { published: false, skipped: `${EVAL_PUBLISH_ENV} is not set` };
  }
  if (!hasRedisCredentials()) {
    return { published: false, error: 'no Redis credentials are set, nothing was written' };
  }
  try {
    await getRedis().set(key, JSON.stringify(aggregate));
    return { published: true };
  } catch (err) {
    return {
      published: false,
      error: redactSecrets(err instanceof Error ? err.message : String(err)),
    };
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
