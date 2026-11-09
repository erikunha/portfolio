import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactContent } from '@/content/contact';
import {
  driveAbortTimeoutWithFakeTimers,
  stalledUntilAborted,
} from '../tests/mocks/stalled-resend-send';

const redisSet = vi.fn();
const redisDel = vi.fn();
const zcard = vi.fn();
const transaction = { hset: vi.fn(), zadd: vi.fn(), exec: vi.fn() };
const send = vi.fn();
const limit = vi.fn();
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  getContactLimit: () => ({ limit }),
  getRedis: () => ({ set: redisSet, del: redisDel, zcard, multi: () => transaction }),
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
    redisDel.mockResolvedValue(1);
    zcard.mockResolvedValue(0);
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
      error: { code: 'storage_unavailable', message: contactContent.en.errors.storageUnavailable },
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
    expect(key).toBe(`contact:msg:${body.requestId}`);
    expect(send.mock.calls[0]?.[0].text).toContain(`Ref: ${body.requestId}`);
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
      expect(msgId).toBe(body.requestId);
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
    driveAbortTimeoutWithFakeTimers();
    send.mockImplementationOnce(stalledUntilAborted);
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

  it('refuses to queue past the outbox cap instead of growing it without bound', async () => {
    const { CONTACT_OUTBOX_MAX } = await import('@/lib/contact-outbox');
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    zcard.mockResolvedValueOnce(CONTACT_OUTBOX_MAX);
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'delivery_unavailable' } });
    expect(transaction.zadd).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'contact outbox full',
      expect.objectContaining({ msgId: expect.any(String) }),
    );
  });

  it('deletes the stored message when delivery failed and the outbox is full', async () => {
    const { CONTACT_OUTBOX_MAX } = await import('@/lib/contact-outbox');
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    zcard.mockResolvedValueOnce(CONTACT_OUTBOX_MAX);
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    const { requestId } = (await res.json()) as { requestId: string };

    expect(
      redisDel,
      'the visitor was told delivery failed and nothing will retry, so the name, email and message must not stay in Redis for 90 days',
    ).toHaveBeenCalledWith(`contact:msg:${requestId}`);
  });

  it('deletes the stored message when delivery failed and the outbox write throws', async () => {
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    transaction.exec.mockRejectedValueOnce(new Error('redis down'));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    const { requestId } = (await res.json()) as { requestId: string };

    expect(redisDel).toHaveBeenCalledWith(`contact:msg:${requestId}`);
  });

  it('keeps the stored message when the delivery failure was queued for retry', async () => {
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());

    expect(res.status).toBe(202);
    expect(redisDel).not.toHaveBeenCalled();
  });

  it('still answers 502 when deleting the stored message fails', async () => {
    const { CONTACT_OUTBOX_MAX } = await import('@/lib/contact-outbox');
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    zcard.mockResolvedValueOnce(CONTACT_OUTBOX_MAX);
    redisDel.mockRejectedValueOnce(new Error('redis down'));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());

    expect(res.status).toBe(502);
    expect(logger.error).toHaveBeenCalledWith(
      'contact message cleanup failed',
      expect.objectContaining({ msgId: expect.any(String) }),
    );
  });

  it('does not promise automatic retry when adding to the outbox fails', async () => {
    send.mockResolvedValueOnce({ error: { message: 'unavailable' } });
    transaction.exec.mockRejectedValueOnce(new Error('redis down'));
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'delivery_unavailable' } });
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

describe('/api/log/forget for a contact message', () => {
  const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
  const del = vi.fn();
  const multiTx = { zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
  const forgetLimit = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    del.mockResolvedValue(1);
    multiTx.exec.mockResolvedValue([1, 1]);
    forgetLimit.mockResolvedValue({ success: true });
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: () => '127.0.0.1',
      getForgetLimit: () => ({ limit: forgetLimit }),
      getRedis: () => ({ del, multi: () => multiTx }),
    }));
  });
  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
  });

  const forget = (body: unknown) =>
    new NextRequest('http://localhost/api/log/forget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('deletes the stored message and its outbox entry for the ref', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(forget({ requestId: REF }));

    expect(res.status).toBe(200);
    const deleted = del.mock.calls.flat().map(String);
    expect(deleted).toContain(`contact:msg:${REF}`);
    expect(multiTx.zrem).toHaveBeenCalledWith('contact:outbox', REF);
    expect(multiTx.hdel).toHaveBeenCalledWith('contact:outbox:attempts', REF);
    expect(multiTx.exec).toHaveBeenCalledOnce();
  });

  it('erases the stored message when the ref is sent in upper case', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(forget({ requestId: REF.toUpperCase() }));

    expect(res.status).toBe(200);
    const deleted = del.mock.calls.flat().map(String);
    expect(deleted).toContain(`contact:msg:${REF}`);
    expect(deleted.some((key) => key !== key.toLowerCase())).toBe(false);
    expect(multiTx.zrem).toHaveBeenCalledWith('contact:outbox', REF);
  });

  it('answers a known and an unknown ref the same and never echoes stored content', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    del.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const known = await POST(forget({ requestId: REF }));
    del.mockReset();
    del.mockResolvedValue(0);
    const unknown = await POST(forget({ requestId: '11111111-2222-4333-8444-555555555555' }));

    expect(unknown.status).toBe(known.status);
    const knownBody = await known.json();
    const unknownBody = await unknown.json();
    expect(Object.keys(unknownBody).sort()).toEqual(Object.keys(knownBody).sort());
    expect(JSON.stringify(knownBody)).not.toContain('Visitor');
  });

  it.each(['../contact:outbox', 'contact:outbox', `${REF}*`, 'x'.repeat(40)])(
    'rejects a ref that is not a UUID before building any key (%s)',
    async (requestId) => {
      const { POST } = await import('@/app/api/log/forget/route');
      const res = await POST(forget({ requestId }));

      expect(res.status).toBe(400);
      expect(del).not.toHaveBeenCalled();
      expect(multiTx.exec).not.toHaveBeenCalled();
    },
  );

  it('keeps the forget rate limit', async () => {
    forgetLimit.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(forget({ requestId: REF }));

    expect(res.status).toBe(429);
    expect(del).not.toHaveBeenCalled();
  });

  it('answers 503 and keeps the outbox entry when the delete fails', async () => {
    del.mockRejectedValueOnce(new Error('kv down'));
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(forget({ requestId: REF }));

    expect(res.status).toBe(503);
    expect(multiTx.exec).not.toHaveBeenCalled();
  });
});

describe('queued copy states the real retry schedule', () => {
  it.each(['en', 'pt'] as const)(
    'names the daily cron and the attempt cap (%s)',
    async (locale) => {
      const { CONTACT_MAX_RETRY_ATTEMPTS } = await import('@/lib/contact-outbox');
      const { contactContent } = await import('@/content/contact');
      // behavioral-test-allow: configuration-invariant, the copy must match the cron in vercel.json
      const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
        crons: Array<{ path: string; schedule: string }>;
      };
      const retry = crons.find((cron) => cron.path === '/api/contact-retry');

      expect(retry?.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
      expect(contactContent[locale].queued.message).toContain(String(CONTACT_MAX_RETRY_ATTEMPTS));
    },
  );
});
