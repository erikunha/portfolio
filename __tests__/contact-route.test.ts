import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisSet = vi.fn();
const transaction = { hset: vi.fn(), zadd: vi.fn(), exec: vi.fn() };
const send = vi.fn();
const limit = vi.fn();
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  getContactLimit: () => ({ limit }),
  getRedis: () => ({ set: redisSet, multi: () => transaction }),
}));
vi.mock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip' }));
vi.mock('@/lib/log', () => ({ log: logger }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const validBody = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'A private contact message.',
};
const request = (body: unknown = validBody) =>
  new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('contact delivery outcome', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redisSet.mockResolvedValue('OK');
    transaction.exec.mockResolvedValue([1, 1]);
    send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
    limit.mockResolvedValue({ success: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('keeps the honeypot fake success and jitter without saving or sending', async () => {
    vi.useFakeTimers();
    const { POST } = await import('@/app/api/contact/route');
    let settled = false;
    const pending = POST(request({ ...validBody, field_company: 'bot' })).then((res) => {
      settled = true;
      return res;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(101);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, requestId: expect.any(String) });
    expect(redisSet).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(transaction.exec).not.toHaveBeenCalled();
  });

  it('returns storage_unavailable without sending or queuing when KV fails', async () => {
    redisSet.mockRejectedValueOnce(new Error(validBody.email));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: { code: 'storage_unavailable', message: expect.stringMatching(/try again/) },
    });
    expect(send).not.toHaveBeenCalled();
    expect(transaction.exec).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(validBody.email);
  });

  it('reports 200 with requestId only after Resend accepts', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, requestId: expect.any(String) });
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
    const [key, stored, options] = redisSet.mock.calls[0] ?? [];
    expect(key).toMatch(/^contact:msg:/);
    expect(JSON.parse(stored)).toMatchObject({
      ...validBody,
      receivedAt: expect.any(String),
      ipHash: 'hashed-ip',
    });
    expect(options).toEqual({ ex: 7_776_000 });
    expect(send).toHaveBeenCalledOnce();
    expect(transaction.exec).not.toHaveBeenCalled();
  });

  it.each(['returned error', 'rejected request', 'missing configuration'])(
    'keeps KV and queues on %s',
    async (failure) => {
      if (failure === 'returned error')
        send.mockResolvedValueOnce({ data: null, error: { message: validBody.email } });
      if (failure === 'rejected request') send.mockRejectedValueOnce(new Error(validBody.message));
      if (failure === 'missing configuration') vi.stubEnv('RESEND_API_KEY', '');
      const { POST } = await import('@/app/api/contact/route');
      const res = await POST(request());
      const body = await res.json();
      expect(res.status).toBe(202);
      expect(body).toMatchObject({
        ok: false,
        requestId: expect.any(String),
        error: { code: 'queued' },
      });
      expect(res.headers.get('x-request-id')).toBe(body.requestId);
      expect(redisSet).toHaveBeenCalledOnce();
      const [key, value] = redisSet.mock.calls[0] ?? [];
      const msgId = key.replace('contact:msg:', '');
      const stored = JSON.parse(value);
      expect(transaction.hset).toHaveBeenCalledWith('contact:outbox:attempts', { [msgId]: 0 });
      expect(transaction.zadd).toHaveBeenCalledWith('contact:outbox', {
        member: msgId,
        score: Date.parse(stored.receivedAt),
      });
      expect(transaction.exec).toHaveBeenCalledOnce();
      const logs = JSON.stringify(logger.error.mock.calls);
      expect(logs).not.toContain(validBody.email);
      expect(logs).not.toContain(validBody.message);
    },
  );

  it('queues after ten seconds when Resend never responds and clears its timer', async () => {
    vi.useFakeTimers();
    send.mockReturnValueOnce(new Promise(() => undefined));
    const { POST } = await import('@/app/api/contact/route');
    let settled = false;
    const pending = POST(request()).then((res) => {
      settled = true;
      return res;
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ error: { code: 'queued' } });
    expect(redisSet).toHaveBeenCalledOnce();
    expect(transaction.exec).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not promise automatic retry when adding to the outbox fails', async () => {
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    transaction.exec.mockRejectedValueOnce(new Error('redis down'));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'storage_unavailable' } });
  });

  it.each([
    {
      body: { ...validBody, email: 'invalid' },
      allowed: true,
      status: 400,
      code: 'validation_failed',
    },
    { body: validBody, allowed: false, status: 429, code: 'rate_limited' },
  ])('preserves $code before storage and delivery', async ({ body, allowed, status, code }) => {
    limit.mockResolvedValueOnce({ success: allowed });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request(body));
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error: { code, message: expect.any(String) } });
    expect(redisSet).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
