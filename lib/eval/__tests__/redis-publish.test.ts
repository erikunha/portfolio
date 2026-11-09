import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSet, mockGetRedis } = vi.hoisted(() => {
  const mockSet = vi.fn(async () => 'OK');
  return { mockSet, mockGetRedis: vi.fn(() => ({ set: mockSet })) };
});

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  hasRedisCredentials: (await importOriginal<typeof import('@/lib/rate-limit')>())
    .hasRedisCredentials,
  getRedis: mockGetRedis,
}));

import { EVAL_PUBLISH_ENV, EVAL_PUBLISH_VALUE } from '@/lib/eval/publish-gate';
import { publishAggregate, publishWithCredentials } from '@/lib/eval/redis-publish';

const ORIGINAL_ENV = { ...process.env };

type EnvKey =
  | 'UPSTASH_REDIS_REST_URL'
  | 'UPSTASH_REDIS_REST_TOKEN'
  | 'KV_REST_API_URL'
  | 'KV_REST_API_TOKEN'
  | typeof EVAL_PUBLISH_ENV;

function restoreEnv(key: EnvKey) {
  if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
  else process.env[key] = ORIGINAL_ENV[key];
}

beforeEach(() => {
  mockSet.mockClear();
  mockGetRedis.mockClear();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env[EVAL_PUBLISH_ENV];
});

afterEach(() => {
  restoreEnv('UPSTASH_REDIS_REST_URL');
  restoreEnv('UPSTASH_REDIS_REST_TOKEN');
  restoreEnv('KV_REST_API_URL');
  restoreEnv('KV_REST_API_TOKEN');
  restoreEnv(EVAL_PUBLISH_ENV);
});

describe('lib/eval/redis-publish', () => {
  it('returns { published: false } and never calls Redis when env is unset', async () => {
    const r = await publishAggregate('agent-eval:latest', { ok: true });
    expect(r.published).toBe(false);
    expect(mockGetRedis).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('calls getRedis().set(key, json) once when both credentials are present', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    const aggregate = { a: 1 };
    const r = await publishAggregate('agent-eval:latest', aggregate);
    expect(r).toEqual({ published: true });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith('agent-eval:latest', JSON.stringify(aggregate));
  });

  it('catches a Redis throw and returns { published: false, error } (non-fatal)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    const r = await publishAggregate('agent-eval:latest', { a: 1 });
    expect(r.published).toBe(false);
    expect(r.error).toContain('redis down');
  });

  it('does not publish with Upstash credentials when the opt-in flag is unset', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    const r = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(r.published).toBe(false);
    expect(r.skipped).toBeTruthy();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not publish with the Vercel-injected KV credentials when the opt-in flag is unset', async () => {
    process.env.KV_REST_API_URL = 'https://prod-redis.example';
    process.env.KV_REST_API_TOKEN = 'tok';
    const r = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(r.published).toBe(false);
    expect(mockGetRedis).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not publish when the flag is set but no credentials exist', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    const r = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(r.published).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('restores the withheld credentials only while the publish runs and drops them after', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    const seenDuringSet: Array<string | undefined> = [];
    mockSet.mockImplementationOnce(async () => {
      seenDuringSet.push(process.env.UPSTASH_REDIS_REST_URL);
      return 'OK';
    });
    const r = await publishWithCredentials(
      'ask:eval:latest',
      { a: 1 },
      { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'tok' },
    );
    expect(r).toEqual({ published: true });
    expect(seenDuringSet).toEqual(['https://redis.example']);
    expect(process.env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(process.env.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it('drops the credentials again when the publish throws', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    const r = await publishWithCredentials(
      'ask:eval:latest',
      { a: 1 },
      { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'tok' },
    );
    expect(r.error).toContain('redis down');
    expect(process.env.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });
});
