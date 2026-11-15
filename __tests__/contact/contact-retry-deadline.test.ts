import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_CRON_SECRET = 'x'.repeat(24);

const transaction = { zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
const redis = {
  zrange: vi.fn(),
  get: vi.fn(),
  hget: vi.fn(),
  hincrby: vi.fn(),
  multi: () => transaction,
};
const send = vi.fn();
const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => redis }));
vi.mock('@/lib/log', () => ({ log: logger }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const PENDING_COUNT = 20;
const SEND_DURATION_MS = 9_000;
const FUNCTION_MAX_DURATION_MS = 60_000;
const RESEND_TIMEOUT_MS = 10_000;
const TICK_MS = 1_000;
const TICK_LIMIT = 300;
const stored = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Private message',
  receivedAt: '2026-10-24T00:00:00.000Z',
  ipHash: 'hash',
};

describe('contact retry time budget', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T04:00:00.000Z'));
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redis.zrange.mockResolvedValue(Array.from({ length: PENDING_COUNT }, (_, i) => `message-${i}`));
    redis.get.mockResolvedValue(stored);
    redis.hget.mockResolvedValue(0);
    redis.hincrby.mockResolvedValue(1);
    transaction.exec.mockResolvedValue([1, 1]);
    send.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: { id: 'accepted' }, error: null }), SEND_DURATION_MS);
        }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('stops starting sends before the function duration limit and leaves the rest pending', async () => {
    const { GET } = await import('@/app/api/contact-retry/route');
    const startedAt = Date.now();
    const pending = GET(
      new NextRequest('http://localhost/api/contact-retry', {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      }),
    );
    let settled = false;
    const response = pending.finally(() => {
      settled = true;
    });
    for (let tick = 0; !settled && tick < TICK_LIMIT; tick++) {
      await vi.advanceTimersByTimeAsync(TICK_MS);
    }
    const body = await (await response).json();

    const elapsed = Date.now() - startedAt;
    expect(
      elapsed,
      'the last send may start only early enough to finish inside the platform limit',
    ).toBeLessThanOrEqual(FUNCTION_MAX_DURATION_MS - RESEND_TIMEOUT_MS);
    expect(body.data.sent).toBeGreaterThan(0);
    expect(body.data.sent).toBeLessThan(PENDING_COUNT);
    expect(send).toHaveBeenCalledTimes(body.data.sent);
    expect(logger.warn).toHaveBeenCalledWith(
      'contact retry deadline reached',
      expect.objectContaining({ remaining: PENDING_COUNT - body.data.sent }),
    );
  });
});
