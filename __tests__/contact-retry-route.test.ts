import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = { zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
const redis = {
  zrange: vi.fn(),
  get: vi.fn(),
  hget: vi.fn(),
  eval: vi.fn(),
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
    redis.eval.mockResolvedValue(1);
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

  it('logs run counts even when the pending list cannot be read', async () => {
    redis.zrange.mockRejectedValueOnce(new Error(stored.email));
    const { GET } = await import('@/app/api/contact-retry/route');
    await expect(GET(request())).rejects.toThrow(stored.email);
    expect(logger.info).toHaveBeenCalledWith('contact retry completed', {
      requestId: expect.any(String),
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 0,
    });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(stored.email);
    expect(send).not.toHaveBeenCalled();
  });

  it('counts a successful retry and removes only the outbox record', async () => {
    const { GET } = await import('@/app/api/contact-retry/route');
    const res = await GET(request());
    expect(await res.json()).toEqual({ sent: 1, failed: 0, expired: 0, exhausted: 0 });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      ['contact:outbox', 'contact:outbox:attempts'],
      ['message-id', 1],
    );
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
    redis.eval.mockResolvedValueOnce(3);
    send.mockResolvedValueOnce({ error: { message: `${stored.email} ${stored.message}` } });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 1,
      expired: 0,
      exhausted: 0,
    });
    expect(redis.eval).toHaveBeenCalledOnce();
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
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(transaction.exec).not.toHaveBeenCalled();
  });

  it('drops messages already at three attempts and alerts without redelivering', async () => {
    redis.hget.mockResolvedValueOnce(3);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 1,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(redis.eval).not.toHaveBeenCalled();
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
  });

  it('alerts without redelivering when a concurrent increment consumed the last attempt', async () => {
    redis.hget.mockResolvedValueOnce(2);
    redis.eval.mockResolvedValueOnce(4);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 1,
    });
    expect(send).toHaveBeenCalledOnce();
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
    expect(send).toHaveBeenCalledOnce();
    expect(redis.eval).not.toHaveBeenCalled();
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
  });

  it('still retries a message exactly seven days old', async () => {
    redis.get.mockResolvedValueOnce({ ...stored, receivedAt: '2026-10-17T04:00:00.000Z' });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toMatchObject({ sent: 1, expired: 0 });
  });

  it('removes orphaned pending ids and alerts without trying to deliver a missing message', async () => {
    redis.get.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toMatchObject({ expired: 1 });
    expect(send).toHaveBeenCalledOnce();
  });

  it.each([{ ids: [] }, { ids: ['message-id'] }])(
    'logs run counts without PII for pending ids %j',
    async ({ ids }) => {
      redis.zrange.mockResolvedValueOnce(ids);
      const { GET } = await import('@/app/api/contact-retry/route');
      const counts = await (await GET(request())).json();
      expect(logger.info).toHaveBeenCalledWith(
        'contact retry completed',
        expect.objectContaining(counts),
      );
      const logs = JSON.stringify([...logger.info.mock.calls, ...logger.error.mock.calls]);
      expect(logs).not.toContain(stored.email);
      expect(JSON.stringify(logger.info.mock.calls)).not.toContain(stored.message);
    },
  );

  it('logs each dropped id and sends one owner alert for expired and exhausted messages', async () => {
    redis.zrange.mockResolvedValueOnce(['expired-id', 'exhausted-id', 'missing-id']);
    redis.get
      .mockResolvedValueOnce({ ...stored, receivedAt: '2026-10-01T00:00:00.000Z' })
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(null);
    redis.hget.mockResolvedValueOnce(3);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 2,
      exhausted: 1,
    });
    for (const msgId of ['expired-id', 'exhausted-id', 'missing-id']) {
      expect(logger.error).toHaveBeenCalledWith(
        'contact retry dropped',
        expect.objectContaining({ msgId }),
      );
    }
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@erikunha.dev',
        to: 'erikhenriquealvescunha@gmail.com',
        text: expect.stringContaining('expired-id'),
      }),
    );
    const alert = send.mock.calls[0]?.[0];
    expect(alert.text).toContain('exhausted-id');
    expect(alert.text).toContain('missing-id');
    for (const pii of [stored.email, stored.name, stored.message, stored.ipHash]) {
      expect(alert.text).not.toContain(pii);
      expect(JSON.stringify([...logger.error.mock.calls, ...logger.info.mock.calls])).not.toContain(
        pii,
      );
    }
  });

  it.each(['rejected', 'throws', 'timeout', 'missing-key'])(
    'logs owner alert failure (%s) and still returns counts',
    async (failure) => {
      redis.get.mockResolvedValueOnce(null);
      if (failure === 'rejected') send.mockResolvedValueOnce({ error: { message: stored.email } });
      if (failure === 'throws') send.mockRejectedValueOnce(new Error(stored.email));
      if (failure === 'timeout') send.mockReturnValueOnce(new Promise(() => undefined));
      if (failure === 'missing-key') vi.stubEnv('RESEND_API_KEY', '');
      const { GET } = await import('@/app/api/contact-retry/route');
      const pending = GET(request());
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await (await pending).json()).toMatchObject({ expired: 1 });
      expect(logger.error).toHaveBeenCalledWith(
        'contact retry alert failed',
        expect.objectContaining({ requestId: expect.any(String) }),
      );
      expect(logger.info).toHaveBeenCalled();
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(stored.email);
    },
  );

  it('stops at 50 seconds and leaves later ids without consuming attempts', async () => {
    redis.zrange.mockResolvedValueOnce([
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'untouched',
    ]);
    send.mockImplementation(() => new Promise(() => undefined));
    const { GET } = await import('@/app/api/contact-retry/route');
    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(50_000);
    expect(await (await pending).json()).toEqual({ sent: 0, failed: 5, expired: 0, exhausted: 0 });
    expect(redis.eval).toHaveBeenCalledTimes(5);
    expect(redis.get).not.toHaveBeenCalledWith('contact:msg:untouched');
    expect(transaction.exec).not.toHaveBeenCalled();
  });

  it('bounds a send started near the deadline and leaves time for the owner alert', async () => {
    const startedAt = Date.now();
    redis.zrange.mockResolvedValueOnce(['expired-id', 'slow-id', 'untouched']);
    redis.get
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(stored), 49_000)),
      );
    send.mockReturnValueOnce(new Promise(() => undefined));
    const { GET } = await import('@/app/api/contact-retry/route');
    let completedAt = 0;
    const pending = GET(request()).then((response) => {
      completedAt = Date.now();
      return response;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await (await pending).json()).toEqual({ sent: 0, failed: 1, expired: 1, exhausted: 0 });
    expect(completedAt - startedAt).toBe(50_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toMatchObject({ from: 'alerts@erikunha.dev' });
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(redis.get).not.toHaveBeenCalledWith('contact:msg:untouched');
  });

  it('does not consume an attempt when Redis reads reach the deadline', async () => {
    redis.get.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2026-10-24T04:00:50.000Z'));
      return stored;
    });
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 0,
    });
    expect(redis.eval).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('skips an id removed by another run before incrementing attempts', async () => {
    redis.eval.mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/contact-retry/route');
    expect(await (await GET(request())).json()).toEqual({
      sent: 0,
      failed: 0,
      expired: 0,
      exhausted: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(transaction.exec).not.toHaveBeenCalled();
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
