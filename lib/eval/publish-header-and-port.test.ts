import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  publishPreflightError,
} from '@/lib/eval/publish-gate';

const PUBLISHING = { [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE };
const CLEAN_URL = 'https://redis-host.upstash.io';
const PORTED_URL = 'https://redis-host.example:8443';
const BARE_HOST = 'redis-host.example';
const TOKEN_VALUE = 'tok-secret-value';

describe('the preflight rejects a token an HTTP header cannot carry', () => {
  it.each([
    ['an internal newline', 'tok-secret\nvalue'],
    ['an internal space', 'tok-secret value'],
    ['a control character', 'tok-secret\u0007value'],
    ['a non-Latin-1 character', 'tok-secret-välue☃'],
  ])('rejects a token with %s, naming it but not printing it', (_case, token) => {
    const message = publishPreflightError(PUBLISHING, {
      UPSTASH_REDIS_REST_URL: CLEAN_URL,
      UPSTASH_REDIS_REST_TOKEN: token,
    });
    expect(message).toContain('UPSTASH_REDIS_REST_TOKEN');
    expect(message).not.toContain('tok-secret');
  });

  it('accepts a clean token', () => {
    expect(
      publishPreflightError(PUBLISHING, {
        UPSTASH_REDIS_REST_URL: CLEAN_URL,
        UPSTASH_REDIS_REST_TOKEN: TOKEN_VALUE,
      }),
    ).toBeNull();
  });
});

describe('a publish error never carries the bare hostname of a URL with a port', () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env[EVAL_PUBLISH_ENV];
    vi.resetModules();
  });

  it('redacts the hostname without its port', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    process.env.UPSTASH_REDIS_REST_URL = PORTED_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN_VALUE;
    vi.doMock('@/lib/redis', () => ({
      hasRedisCredentials: () => true,
      getRedis: () => ({
        set: async () => {
          throw new Error(`getaddrinfo ENOTFOUND ${BARE_HOST}`);
        },
      }),
    }));
    const { publishAggregate } = await import('@/lib/eval/redis-publish');
    const result = await publishAggregate('key', { ok: true });
    expect(result.error).toContain('ENOTFOUND');
    expect(result.error).not.toContain(BARE_HOST);
  });
});
