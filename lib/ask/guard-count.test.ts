import { beforeEach, describe, expect, it, vi } from 'vitest';

const incr = vi.hoisted(() => vi.fn());
const expire = vi.hoisted(() => vi.fn());
const exec = vi.hoisted(() => vi.fn(async () => [1, 1]));
const logError = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rate-limit', () => ({
  getRedis: () => ({ pipeline: () => ({ incr, expire, exec }) }),
}));
vi.mock('@/lib/log', () => ({ log: { error: logError, info: vi.fn(), warn: vi.fn() } }));

describe('countAskGuardFinding', () => {
  beforeEach(() => {
    incr.mockClear();
    expire.mockClear();
    exec.mockReset();
    exec.mockResolvedValue([1, 1]);
    logError.mockClear();
  });

  it('adds to one counter per day and finding kind, with a TTL set once', async () => {
    const { countAskGuardFinding } = await import('./guard-count');
    await countAskGuardFinding('leak', new Date('2026-11-07T10:00:00Z'));

    expect(incr).toHaveBeenCalledWith('ask:guard:2026-11-07:leak');
    expect(expire).toHaveBeenCalledWith('ask:guard:2026-11-07:leak', 2_764_800, 'NX');
  });

  it('logs and carries on when Redis is down', async () => {
    exec.mockRejectedValue(new Error('Redis unavailable'));
    const { countAskGuardFinding } = await import('./guard-count');
    await expect(countAskGuardFinding('length')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });
});
