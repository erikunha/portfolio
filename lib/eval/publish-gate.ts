import { REDIS_ENV_PAIRS } from '@/lib/rate-limit';

export const EVAL_PUBLISH_ENV = 'EVAL_PUBLISH';
export const EVAL_PUBLISH_VALUE = '1';

export function isPublishEnabled(env: Record<string, string | undefined>): boolean {
  return env[EVAL_PUBLISH_ENV] === EVAL_PUBLISH_VALUE;
}

export function isolateFromRedis(env: Record<string, string | undefined>): void {
  if (isPublishEnabled(env)) return;
  for (const { url, token } of REDIS_ENV_PAIRS) {
    delete env[url];
    delete env[token];
  }
}
