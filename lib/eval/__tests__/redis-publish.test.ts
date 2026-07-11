import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSet, mockGetRedis } = vi.hoisted(() => {
  const mockSet = vi.fn(async () => 'OK');
  return { mockSet, mockGetRedis: vi.fn(() => ({ set: mockSet })) };
});

vi.mock('@/lib/rate-limit', () => ({ getRedis: mockGetRedis }));

import { publishAggregate } from '@/lib/eval/redis-publish';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(key: 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN') {
  if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
  else process.env[key] = ORIGINAL_ENV[key];
}

beforeEach(() => {
  mockSet.mockClear();
  mockGetRedis.mockClear();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  restoreEnv('UPSTASH_REDIS_REST_URL');
  restoreEnv('UPSTASH_REDIS_REST_TOKEN');
});

describe('lib/eval/redis-publish', () => {
  it('returns { published: false } and never calls Redis when env is unset', async () => {
    const r = await publishAggregate('agent-eval:latest', { ok: true });
    expect(r).toEqual({ published: false });
    expect(mockGetRedis).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('calls getRedis().set(key, json) once when both credentials are present', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    const aggregate = { a: 1 };
    const r = await publishAggregate('agent-eval:latest', aggregate);
    expect(r).toEqual({ published: true });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith('agent-eval:latest', JSON.stringify(aggregate));
  });

  it('catches a Redis throw and returns { published: false, error } (non-fatal)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    const r = await publishAggregate('agent-eval:latest', { a: 1 });
    expect(r.published).toBe(false);
    expect(r.error).toContain('redis down');
  });
});
