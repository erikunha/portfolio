// lib/eval/redis-publish.ts
//
// Env-gated Redis-publish helper, extracted from scripts/ask-eval.ts. Publishes
// an eval aggregate under a well-known key the metrics panel reads — but ONLY
// when both Upstash credentials are present (Redis.fromEnv() requires URL +
// token; guarding on both avoids a noisy non-fatal error on partial config).
// A Redis throw is caught and reported non-fatally so a publish failure never
// fails the eval run itself.

import { getRedis } from '@/lib/rate-limit';

export async function publishAggregate(
  key: string,
  aggregate: unknown,
): Promise<{ published: boolean; error?: string }> {
  if (!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return { published: false };
  }
  try {
    await getRedis().set(key, JSON.stringify(aggregate));
    return { published: true };
  } catch (err) {
    return { published: false, error: err instanceof Error ? err.message : String(err) };
  }
}
