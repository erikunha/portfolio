import { getRedis, hasRedisCredentials } from '@/lib/rate-limit';

export async function publishAggregate(
  key: string,
  aggregate: unknown,
): Promise<{ published: boolean; error?: string }> {
  if (!hasRedisCredentials()) {
    return { published: false };
  }
  try {
    await getRedis().set(key, JSON.stringify(aggregate));
    return { published: true };
  } catch (err) {
    return { published: false, error: err instanceof Error ? err.message : String(err) };
  }
}
