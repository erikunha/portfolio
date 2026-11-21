import { beforeEach, describe, expect, it, vi } from 'vitest';

const incr = vi.hoisted(() => vi.fn());
const expire = vi.hoisted(() => vi.fn());
const exec = vi.hoisted(() => vi.fn(async () => [1, 1]));

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ pipeline: () => ({ incr, expire, exec }) }),
}));

describe('incrementDailyCounter', () => {
  beforeEach(() => {
    incr.mockClear();
    expire.mockClear();
    exec.mockReset();
    exec.mockResolvedValue([1, 1]);
  });

  it('adds to the counter named prefix, UTC day and key, with a month TTL set once', async () => {
    const { incrementDailyCounter, MONTH_TTL_S } = await import('./daily-counter');
    await incrementDailyCounter('ask:guard', 'leak', new Date('2026-11-07T10:00:00Z'));

    expect(incr).toHaveBeenCalledWith('ask:guard:2026-11-07:leak');
    expect(expire).toHaveBeenCalledWith('ask:guard:2026-11-07:leak', MONTH_TTL_S, 'NX');
    expect(MONTH_TTL_S).toBe(2_764_800);
  });

  it('keys by the UTC day, not the local day', async () => {
    const { incrementDailyCounter } = await import('./daily-counter');
    await incrementDailyCounter('ask:refused', 'x', new Date('2026-11-07T23:59:59.999Z'));
    expect(incr).toHaveBeenCalledWith('ask:refused:2026-11-07:x');
  });

  it('lets a Redis failure reach the caller, which owns the log line', async () => {
    exec.mockRejectedValue(new Error('Redis unavailable'));
    const { incrementDailyCounter } = await import('./daily-counter');
    await expect(incrementDailyCounter('ask:guard', 'leak')).rejects.toThrow('Redis unavailable');
  });
});
