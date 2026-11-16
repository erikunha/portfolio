import {
  dropRedisCredentials,
  EVAL_PUBLISH_ENV,
  isPublishEnabled,
  type RedisCredentials,
  restoreRedisCredentials,
} from '@/lib/eval/publish-gate';
import { getRedis, hasRedisCredentials } from '@/lib/rate-limit';
import { REDIS_ENV_PAIRS } from '@/lib/redis-env';

const REDACTED = '[redacted]';
const MIN_REDACTED_LENGTH = 8;

function hostOf(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function credentialValues(env: NodeJS.ProcessEnv): string[] {
  const values = new Set<string>();
  for (const { url, token } of REDIS_ENV_PAIRS) {
    for (const name of [url, token]) {
      const raw = env[name];
      if (!raw) continue;
      values.add(raw);
      values.add(raw.trim());
    }
    const host = hostOf((env[url] ?? '').trim());
    if (host) values.add(host);
  }
  return [...values]
    .filter((value) => value.length >= MIN_REDACTED_LENGTH)
    .sort((a, b) => b.length - a.length);
}

function redactSecrets(message: string): string {
  let redacted = message;
  for (const value of credentialValues(process.env)) {
    redacted = redacted.split(value).join(REDACTED);
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
