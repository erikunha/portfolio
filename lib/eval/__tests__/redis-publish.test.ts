// lib/eval/__tests__/redis-publish.test.ts
// Behavioral test for the env-gated Redis-publish helper (lib/eval/redis-publish.ts),
// extracted from scripts/ask-eval.ts. The both-credentials guard and the
// try/catch non-fatal semantics are preserved exactly:
//   - env unset → { published: false }, Redis never called
//   - both env vars set → getRedis().set(key, json) called once
//   - a Redis throw → caught, { published: false, error } (non-fatal)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSet, mockGetRedis } = vi.hoisted(() => {
  const mockSet = vi.fn(async () => 'OK');
  return { mockSet, mockGetRedis: vi.fn(() => ({ set: mockSet })) };
});

vi.mock('@/lib/rate-limit', () => ({ getRedis: mockGetRedis }));

import { publishAggregate } from '@/lib/eval/redis-publish';

const ORIGINAL_ENV = { ...process.env };

// Restore a managed var to its module-load state: a deleted key if it was unset,
// else its original value. (Assigning `undefined` to process.env coerces to the
// string "undefined" — truthy — so it must NEVER be used to "clear" a var.)
function restoreEnv(key: 'UPSTASH_REDIS_REST_URL' | 'UPSTASH_REDIS_REST_TOKEN') {
  if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
  else process.env[key] = ORIGINAL_ENV[key];
}

beforeEach(() => {
  mockSet.mockClear();
  mockGetRedis.mockClear();
  // Genuinely UNSET both vars (delete, not `= undefined`) so the default test
  // state is "no credentials" — what the guard actually checks.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  restoreEnv('UPSTASH_REDIS_REST_URL');
  restoreEnv('UPSTASH_REDIS_REST_TOKEN');
});

describe('lib/eval/redis-publish', () => {
  it('returns { published: false } and never calls Redis when env is unset', async () => {
    // No env mutation here: beforeEach genuinely deletes both vars, so this
    // exercises the real "no credentials" baseline (the guard sees undefined).
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
