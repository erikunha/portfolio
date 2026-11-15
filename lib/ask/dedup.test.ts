// @vitest-environment node

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('@/lib/redis', () => ({ getRedis: () => ({ set, del }) }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: logError, debug: vi.fn() },
}));

const IP_HASH = 'hashed-ip';
const QUESTION = 'What does Erik build?';

const expectedKey = (ipHash: string, question: string) =>
  `ask:dedup:${ipHash}:${createHash('sha256').update(question).digest('hex').slice(0, 16)}`;

describe('checkIdenticalQuestion', () => {
  beforeEach(() => {
    vi.resetModules();
    set.mockReset();
    del.mockReset();
    logError.mockClear();
  });

  it('takes a 60 second lock keyed by the IP hash and a digest of the question', async () => {
    set.mockResolvedValue('OK');
    const { checkIdenticalQuestion } = await import('@/lib/ask/dedup');

    expect(await checkIdenticalQuestion(IP_HASH, QUESTION)).toEqual({ allowed: true });
    expect(set).toHaveBeenCalledWith(expectedKey(IP_HASH, QUESTION), '1', { nx: true, ex: 60 });
  });

  it('refuses when the lock is already held', async () => {
    set.mockResolvedValue(null);
    const { checkIdenticalQuestion } = await import('@/lib/ask/dedup');
    expect(await checkIdenticalQuestion(IP_HASH, QUESTION)).toEqual({ allowed: false });
  });

  it('keys a different question or a different client separately', async () => {
    set.mockResolvedValue('OK');
    const { checkIdenticalQuestion } = await import('@/lib/ask/dedup');
    await checkIdenticalQuestion(IP_HASH, QUESTION);
    await checkIdenticalQuestion(IP_HASH, 'Another question');
    await checkIdenticalQuestion('other-ip', QUESTION);
    const keys = set.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(3);
  });

  it('never stores the question text in the key', async () => {
    set.mockResolvedValue('OK');
    const { checkIdenticalQuestion } = await import('@/lib/ask/dedup');
    await checkIdenticalQuestion(IP_HASH, QUESTION);
    expect(String(set.mock.calls[0]?.[0])).not.toContain('Erik');
  });

  it('allows the question and logs when Redis fails', async () => {
    set.mockRejectedValue(new Error('redis down'));
    const { checkIdenticalQuestion } = await import('@/lib/ask/dedup');
    expect(await checkIdenticalQuestion(IP_HASH, QUESTION)).toEqual({ allowed: true });
    expect(logError).toHaveBeenCalledWith(
      'identical-question check failed, allowing',
      expect.any(Object),
    );
  });
});

describe('releaseIdenticalQuestion', () => {
  beforeEach(() => {
    vi.resetModules();
    set.mockReset();
    del.mockReset();
    logError.mockClear();
  });

  it('deletes the same key the check took', async () => {
    set.mockResolvedValue('OK');
    del.mockResolvedValue(1);
    const { checkIdenticalQuestion, releaseIdenticalQuestion } = await import('@/lib/ask/dedup');
    await checkIdenticalQuestion(IP_HASH, QUESTION);
    await releaseIdenticalQuestion(IP_HASH, QUESTION);
    expect(del).toHaveBeenCalledWith(set.mock.calls[0]?.[0]);
    expect(del).toHaveBeenCalledWith(expectedKey(IP_HASH, QUESTION));
  });

  it('logs and resolves when Redis fails, leaving the lock to expire', async () => {
    del.mockRejectedValue(new Error('redis down'));
    const { releaseIdenticalQuestion } = await import('@/lib/ask/dedup');
    await expect(releaseIdenticalQuestion(IP_HASH, QUESTION)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      'identical-question release failed, the lock expires on its own',
      expect.any(Object),
    );
  });
});
