// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const held = new Set<string>();
const setMock = vi.fn(async (key: string, _value: string, options: { nx: boolean }) => {
  if (options.nx && held.has(key)) return null;
  held.add(key);
  return 'OK';
});
const delMock = vi.fn(async (key: string) => (held.delete(key) ? 1 : 0));

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ set: setMock, del: delMock }) },
}));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: { slidingWindow: () => ({}) } }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const IP = 'hashed-ip';
const QUESTION = 'What does Erik build?';

describe('identical-question lock', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();
    held.clear();
    setMock.mockClear();
    delMock.mockClear();
  });

  it('refuses the same question twice until the lock is released', async () => {
    const { checkIdenticalQuestion, releaseIdenticalQuestion } = await import('@/lib/rate-limit');
    expect(await checkIdenticalQuestion(IP, QUESTION)).toEqual({ allowed: true });
    expect(await checkIdenticalQuestion(IP, QUESTION)).toEqual({ allowed: false });

    await releaseIdenticalQuestion(IP, QUESTION);

    expect(
      await checkIdenticalQuestion(IP, QUESTION),
      'a question that was refused or failed before an answer must be askable again at once',
    ).toEqual({ allowed: true });
  });

  it('releases only the lock of that client and that question', async () => {
    const { checkIdenticalQuestion, releaseIdenticalQuestion } = await import('@/lib/rate-limit');
    await checkIdenticalQuestion(IP, QUESTION);
    await checkIdenticalQuestion(IP, 'another question');
    await checkIdenticalQuestion('other-ip', QUESTION);

    await releaseIdenticalQuestion(IP, QUESTION);

    expect(held.size).toBe(2);
  });

  it('carries on when Redis cannot delete the lock', async () => {
    delMock.mockRejectedValueOnce(new Error('Redis unavailable'));
    const { releaseIdenticalQuestion } = await import('@/lib/rate-limit');
    await expect(releaseIdenticalQuestion(IP, QUESTION)).resolves.toBeUndefined();
  });
});
