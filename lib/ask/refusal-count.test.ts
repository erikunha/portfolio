import { beforeEach, describe, expect, it, vi } from 'vitest';

const incr = vi.hoisted(() => vi.fn());
const expire = vi.hoisted(() => vi.fn());
const exec = vi.hoisted(() => vi.fn(async () => [1, 1]));
const logError = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rate-limit', () => ({
  getRedis: () => ({ pipeline: () => ({ incr, expire, exec }) }),
}));
vi.mock('@/lib/log', () => ({ log: { error: logError, info: vi.fn(), warn: vi.fn() } }));

describe('countAskRefusal', () => {
  beforeEach(() => {
    incr.mockClear();
    expire.mockClear();
    exec.mockReset();
    exec.mockResolvedValue([1, 1]);
    logError.mockClear();
  });

  it('adds to one counter per day and status, with a TTL set once', async () => {
    const { countAskRefusal } = await import('./refusal-count');
    await countAskRefusal('rate-limited', new Date('2026-11-07T10:00:00Z'));

    expect(incr).toHaveBeenCalledWith('ask:refused:2026-11-07:rate-limited');
    expect(expire).toHaveBeenCalledWith('ask:refused:2026-11-07:rate-limited', 2_764_800, 'NX');
  });

  it('logs and carries on when Redis is down', async () => {
    exec.mockRejectedValue(new Error('Redis unavailable'));
    const { countAskRefusal } = await import('./refusal-count');
    await expect(countAskRefusal('dedup-rejected')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });

  it('logs the failure as name and message only, never the raw error object', async () => {
    const failure = Object.assign(new Error('Redis unavailable'), {
      command: ['SET', 'ask:log', 'canary-question-9d2c'],
    });
    exec.mockRejectedValue(failure);
    const { countAskRefusal } = await import('./refusal-count');
    await countAskRefusal('rate-limited');

    expect(
      logError,
      'a client error can carry the command it sent; serialising it writes request data to the log drain',
    ).toHaveBeenCalledWith('ask refusal counter write failed', {
      status: 'rate-limited',
      error: { name: 'Error', message: 'Redis unavailable' },
    });
  });
});
