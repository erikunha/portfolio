// __tests__/contact-honeypot.test.ts
// Behavioral test: verifies /api/contact silently returns 200 when the
// `field_company` honeypot is filled, WITHOUT touching KV or Resend.
//
// Closes audit Theme 1.4 (documented anti-spam control was missing).
// See docs/audit/2026-05-19-principal-audit.md.

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisSetMock = vi.fn();
const resendSendMock = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true }));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getContactLimit: vi.fn(() => ({ limit: rateLimitMock })),
  getRedis: vi.fn(() => ({ set: redisSetMock })),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/contact honeypot (audit Theme 1.4)', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'fake-key-for-tests';
    vi.resetModules();
    redisSetMock.mockReset();
    resendSendMock.mockReset();
  });

  it('returns 200 ok without persisting or sending when field_company is filled', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate-looking message',
        field_company: 'Acme Co', // honeypot filled — bot signature
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    // The bot must observe no side effects to learn what tripped.
    expect(redisSetMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('processes the submission normally when field_company is empty', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    resendSendMock.mockResolvedValueOnce({ error: null });

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
        field_company: '', // empty — legit user
      }),
    );

    expect(res.status).toBe(200);
    expect(redisSetMock).toHaveBeenCalledOnce();
    expect(resendSendMock).toHaveBeenCalledOnce();
  });

  it('processes the submission normally when field_company is missing entirely', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    resendSendMock.mockResolvedValueOnce({ error: null });

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
      }),
    );

    expect(res.status).toBe(200);
    expect(redisSetMock).toHaveBeenCalledOnce();
  });

  it('also trips when field_company is whitespace-only (defensive)', async () => {
    const { isHoneypotTripped } = await import('@/lib/contact-validation');
    expect(isHoneypotTripped({ field_company: '   ' })).toBe(false); // trimmed empty
    expect(isHoneypotTripped({ field_company: '\t\n' })).toBe(false);
    expect(isHoneypotTripped({ field_company: 'x' })).toBe(true);
    expect(isHoneypotTripped({})).toBe(false);
    expect(isHoneypotTripped({ field_company: undefined })).toBe(false);
    expect(isHoneypotTripped({ field_company: 0 as unknown })).toBe(false);
  });
});
