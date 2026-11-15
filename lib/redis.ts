import { Redis, type Requester } from '@upstash/redis';

const REDIS_RETRIES = 1;
const REDIS_RETRY_BACKOFF_MS = 50;

let _redis: Redis | undefined;

export const REDIS_ENV_PAIRS = [
  { url: 'UPSTASH_REDIS_REST_URL', token: 'UPSTASH_REDIS_REST_TOKEN' },
  { url: 'KV_REST_API_URL', token: 'KV_REST_API_TOKEN' },
] as const;
const REDIS_ENV_NAMES = REDIS_ENV_PAIRS.map(({ url, token }) => `${url} and ${token}`).join(' or ');

export class RedisNotConfiguredError extends Error {
  constructor() {
    super(`Redis is not configured: ${REDIS_ENV_NAMES} must be set`);
    this.name = 'RedisNotConfiguredError';
  }
}

const notConfiguredRequester: Requester = {
  request: () => Promise.reject(new RedisNotConfiguredError()),
};

function rejectedClient(): Redis {
  return new Redis(notConfiguredRequester);
}

export function hasRedisCredentials(): boolean {
  return REDIS_ENV_PAIRS.some(({ url, token }) => Boolean(process.env[url] && process.env[token]));
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  if (!hasRedisCredentials()) return rejectedClient();
  const instance = Redis.fromEnv({
    retry: { retries: REDIS_RETRIES, backoff: () => REDIS_RETRY_BACKOFF_MS },
  });
  _redis = instance;
  return instance;
}
