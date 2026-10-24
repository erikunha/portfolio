import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const stored = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Private message',
  receivedAt: '2026-10-24T00:00:00.000Z',
  ipHash: 'hash',
};
const request = (bearer: string | null = 'Bearer cron-secret') =>
  new NextRequest('http://localhost/api/contact-retry', {
    headers: bearer ? { authorization: bearer } : {},
  });

describe('daily contact delivery retry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T04:00:00.000Z'));
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redis.zrange.mockResolvedValue(['message-id']);
    redis.get.mockResolvedValue(stored);
    redis.hget.mockResolvedValue(0);
    redis.hincrby.mockResolvedValue(1);
    transaction.exec.mockResolvedValue([1, 1]);
    send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([null, 'Bearer wrong', 'cron-secret'])(
    'rejects unauthorized bearer %s before accessing Redis or Resend',
    async (bearer) => {
      const { GET } = await import('@/app/api/contact-retry/route');
      expect((await GET(request(bearer))).status).toBe(401);
      expect(redis.zrange).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('rejects even a matching string when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { GET } = await import('@/app/api/contact-retry/route');
    expect((await GET(request('Bearer '))).status).toBe(401);
  });

  it('returns zero counts for an empty outbox', async () => {
    redis.zrange.mockResolvedValueOnce([]);
    const { GET } = await import('@/app/api/contact-retry/route');
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, expired: 0, exhausted: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('counts a successful retry and removes only the outbox record', async () => {
    const { GET } = await import('@/app/api/contact-retry/route');
    const res = await GET(request());
    expect(await res.json()).toEqual({ sent: 1, failed: 0, expired: 0, exhausted: 0 });
    expect(redis.hincrby).toHaveBeenCalledWith('contact:outbox:attempts', 'message-id', 1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: stored.email,
        text: expect.stringContaining(stored.message),
      }),
      expect.any(Object),
    );
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
    expect(transaction.hdel).toHaveBeenCalledWith('contact:outbox:attempts', 'message-id');
    expect(transaction.exec).toHaveBeenCalledOnce();
  });

  it('counts a failed retry, increments attempts and keeps pending membership without PII logs', async () => {
    redis.hget.mockResolvedValueOnce(2);
    redis.hincrby.mockResolvedValueOnce(3);
    send.mockResolvedValueOnce({ error: { message: `${stored.email} ${stored.message}` } });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 1,
      expired: 0,
      exhausted: 0,
    });
    expect(redis.hincrby).toHaveBeenCalledOnce();
    expect(transaction.exec).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(stored.email);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(stored.message);
  });

  it('counts a timeout as a failed attempt and keeps it pending', async () => {
    send.mockReturnValueOnce(new Promise(() => undefined));
    const { GET } = await import('@/app/api/contact-retry/route');
    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await (await pending).json()).toEqual({ sent: 0, failed: 1, expired: 0, exhausted: 0 });
    expect(redis.hincrby).toHaveBeenCalledOnce();
    expect(transaction.exec).not.toHaveBeenCalled();
  });

  it('drops messages already at three attempts without sending', async () => {
    redis.hget.mockResolvedValueOnce(3);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 1,
    });
    expect(send).not.toHaveBeenCalled();
    expect(redis.hincrby).not.toHaveBeenCalled();
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
  });

  it('never sends when a concurrent increment has consumed the last attempt', async () => {
    redis.hget.mockResolvedValueOnce(2);
    redis.hincrby.mockResolvedValueOnce(4);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 1,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('expires messages older than seven days, leaving the message for audit', async () => {
    redis.get.mockResolvedValueOnce({ ...stored, receivedAt: '2026-10-17T03:59:59.999Z' });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 1,
      exhausted: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(redis.hincrby).not.toHaveBeenCalled();
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
  });

  it('still retries a message exactly seven days old', async () => {
    redis.get.mockResolvedValueOnce({ ...stored, receivedAt: '2026-10-17T04:00:00.000Z' });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toMatchObject({ sent: 1, expired: 0 });
  });

  it('removes orphaned pending ids without trying to send a missing message', async () => {
    redis.get.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toMatchObject({ expired: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it('continues processing later ids after one message cannot be read', async () => {
    redis.zrange.mockResolvedValueOnce(['unreadable', 'message-id']);
    redis.get.mockRejectedValueOnce(new Error(stored.email));
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 1,
      failed: 1,
      expired: 0,
      exhausted: 0,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(stored.email);
  });
});
