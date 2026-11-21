import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVAL_PUBLISH_ENV, EVAL_PUBLISH_VALUE } from '@/lib/eval/publish-gate';

const SECRET_URL = 'https://redis-host.upstash.io';
const SECRET_HOST = 'redis-host.upstash.io';
const SECRET_TOKEN = 'tok-leaky-value-123';
const CREDENTIAL_NAMES = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;

let thrown = '';

async function publishError(): Promise<string> {
  vi.doMock('@/lib/redis', () => ({
    hasRedisCredentials: () => true,
    getRedis: () => ({
      set: async () => {
        throw new Error(thrown);
      },
    }),
  }));
  const { publishAggregate } = await import('@/lib/eval/redis-publish');
  const result = await publishAggregate('key', { ok: true });
  return result.error ?? '';
}

beforeEach(() => {
  for (const name of CREDENTIAL_NAMES) delete process.env[name];
  process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
  process.env.UPSTASH_REDIS_REST_URL = SECRET_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = SECRET_TOKEN;
});

afterEach(() => {
  for (const name of CREDENTIAL_NAMES) delete process.env[name];
  delete process.env[EVAL_PUBLISH_ENV];
  vi.resetModules();
  vi.doUnmock('@/lib/redis');
});

describe('a failed publish redacts only the configured credentials', () => {
  it('redacts a host-only network error', async () => {
    thrown = `getaddrinfo ENOTFOUND ${SECRET_HOST}`;
    const error = await publishError();
    expect(error).not.toContain(SECRET_HOST);
    expect(error).toContain('getaddrinfo ENOTFOUND');
  });

  it('keeps a benign URL and its trailing comma', async () => {
    thrown = 'see https://upstash.com/docs, then retry';
    expect(await publishError()).toBe(thrown);
  });

  it('redacts a token embedded in a longer message', async () => {
    thrown = `rejected: Bearer ${SECRET_TOKEN}, retry later`;
    const error = await publishError();
    expect(error).not.toContain(SECRET_TOKEN);
    expect(error).toContain('retry later');
  });

  it('redacts the padded form of a value', async () => {
    process.env.UPSTASH_REDIS_REST_URL = `${SECRET_URL}\n`;
    thrown = `bad ${SECRET_URL}`;
    expect(await publishError()).not.toContain(SECRET_HOST);
  });

  it('redacts the KV pair as well', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = SECRET_URL;
    process.env.KV_REST_API_TOKEN = SECRET_TOKEN;
    thrown = `bad ${SECRET_TOKEN} at ${SECRET_HOST}`;
    const error = await publishError();
    expect(error).not.toContain(SECRET_TOKEN);
    expect(error).not.toContain(SECRET_HOST);
  });

  it('does not mangle words when a value is very short', async () => {
    process.env.UPSTASH_REDIS_REST_TOKEN = 'ed';
    thrown = 'connection refused';
    expect(await publishError()).toBe(thrown);
  });

  it('leaves the message unchanged when no credential is set', async () => {
    for (const name of CREDENTIAL_NAMES) delete process.env[name];
    thrown = 'connection refused by https://example.com/x';
    expect(await publishError()).toBe(thrown);
  });
});
