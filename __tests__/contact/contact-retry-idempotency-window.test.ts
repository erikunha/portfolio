import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_CRON_SECRET = 'x'.repeat(24);
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const CRON_RUN_AT = '2026-11-13T04:00:00.000Z';

const transaction = { zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
const redis = {
  zrange: vi.fn(),
  get: vi.fn(),
  hget: vi.fn(),
  hincrby: vi.fn(),
  multi: () => transaction,
};
const send = vi.fn();
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => redis }));
vi.mock('@/lib/log', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const stored = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Private message',
  ipHash: 'hash',
};

function receivedAgo(ms: number): string {
  return new Date(Date.parse(CRON_RUN_AT) - ms).toISOString();
}

async function runRetry(): Promise<{ sent: number; expired: number }> {
  const { GET } = await import('@/app/api/contact-retry/route');
  const res = await GET(
    new NextRequest('http://localhost/api/contact-retry', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    }),
  );
  return (await res.json()).data;
}

describe('contact retry stays inside the provider idempotency window', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CRON_RUN_AT));
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redis.zrange.mockResolvedValue(['message-id']);
    redis.hget.mockResolvedValue(0);
    redis.hincrby.mockResolvedValue(1);
    transaction.exec.mockResolvedValue([1, 1]);
    send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('does not resend a message once the idempotency key could have expired', async () => {
    redis.get.mockResolvedValue({
      ...stored,
      receivedAt: receivedAgo(RESEND_IDEMPOTENCY_WINDOW_MS + 1),
    });

    const data = await runRetry();

    expect(
      send,
      'a delivered-but-timed-out send retried after the key expired would email twice',
    ).not.toHaveBeenCalled();
    expect(data).toMatchObject({ sent: 0, expired: 1 });
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
  });

  it('resends a message still inside the window under the same idempotency key', async () => {
    redis.get.mockResolvedValue({
      ...stored,
      receivedAt: receivedAgo(RESEND_IDEMPOTENCY_WINDOW_MS - 1),
    });

    const data = await runRetry();

    expect(data).toMatchObject({ sent: 1, expired: 0 });
    expect(send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'contact:message-id' }),
    );
  });
});
