import { NextRequest } from 'next/server';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { mountClient } from './helpers/render';

describe('lib/ask-log — persistAskInteraction', () => {
  const redisSetMock = vi.fn();
  const logErrorMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisSetMock.mockReset();
    logErrorMock.mockReset();
    vi.doMock('@/lib/rate-limit', () => ({ getRedis: vi.fn(() => ({ set: redisSetMock })) }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: logErrorMock, warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/log');
  });

  const interaction = {
    requestId: 'req-abc-123',
    ts: '2026-05-20T12:34:56.000Z',
    ipHash: 'hashed-ip',
    question: 'Q',
    answer: 'A',
    inputTokens: 10,
    outputTokens: 20,
    durationMs: 100,
    status: 'completed' as const,
  };

  it('writes to the date-partitioned ask:log: key with a 90-day TTL', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await persistAskInteraction(interaction);

    expect(redisSetMock).toHaveBeenCalledOnce();
    const [key, , opts] = redisSetMock.mock.calls[0] ?? [];
    expect(String(key)).toBe('ask:log:2026-05-20:req-abc-123');
    expect(opts).toEqual({ ex: 7_776_000 });
  });

  it('truncates the question to 500 chars and the answer to 1000 chars', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await persistAskInteraction({
      ...interaction,
      question: 'q'.repeat(900),
      answer: 'a'.repeat(2000),
    });

    const [, value] = redisSetMock.mock.calls[0] ?? [];
    const record = JSON.parse(String(value)) as { question: string; answer: string };
    expect(record.question).toHaveLength(500);
    expect(record.answer).toHaveLength(1000);
  });

  it('fails quiet on a KV outage — never throws into the /api/ask path', async () => {
    redisSetMock.mockRejectedValueOnce(new Error('Upstash down'));
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await expect(persistAskInteraction(interaction)).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ requestId: 'req-abc-123' }),
    );
  });
});

describe('/api/log/forget endpoint', () => {
  const redisDelMock = vi.fn();
  const logInfoMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisDelMock.mockReset();
    logInfoMock.mockReset();
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getForgetLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({
        del: redisDelMock,
        multi: () => ({ zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn(async () => []) }),
      })),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: logInfoMock, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('@/lib/log');
  });

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/log/forget', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const REAL_UUID = '11111111-2222-4333-8444-555555555555';

  it('DELETEs against the ask:log: key pattern for the given requestId', async () => {
    redisDelMock.mockResolvedValueOnce(1);
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: REAL_UUID }));

    expect(res.status).toBe(200);
    expect(redisDelMock).toHaveBeenCalledOnce();
    const deletedKeys = redisDelMock.mock.calls[0] ?? [];
    expect(deletedKeys.length).toBeGreaterThan(0);
    for (const key of deletedKeys) {
      expect(String(key)).toMatch(
        /^(ask:log:\d{4}-\d{2}-\d{2}|contact:msg):11111111-2222-4333-8444-555555555555$/,
      );
    }
  });

  it('does NOT leak a deleted count on the success response (existence-oracle fix)', async () => {
    redisDelMock.mockResolvedValueOnce(1);
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: REAL_UUID }));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, requestId: expect.any(String) });
    expect('deleted' in body).toBe(false);
    expect(logInfoMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deleted: 1 }),
    );
  });

  it('answers 413 payload_too_large for a body past the cap, before any delete', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: REAL_UUID, padding: 'x'.repeat(4096) }));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('payload_too_large');
    expect(redisDelMock).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID requestId with a 400 validation error', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });
});

describe('/api/ask privacy notice on the shell', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/use-breakpoint.client', () => ({
      useBreakpoint: () => ({ isMobile: false }),
    }));
    vi.doMock('@/lib/motion', () => ({ readMotion: () => false }));
    vi.doMock('@/content/shell-commands', () => ({ default: [] }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/use-breakpoint.client');
    vi.doUnmock('@/lib/motion');
    vi.doUnmock('@/content/shell-commands');
  });

  it('renders a privacy notice mentioning 90-day retention and a deletion route', async () => {
    const { InteractiveShell } = await import(
      '@/components/client/InteractiveShell/InteractiveShell'
    );

    const { container, unmount } = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );

    const notice = container.querySelector('[data-testid="shell-privacy-notice"]');
    expect(notice).not.toBeNull();
    const text = notice?.textContent ?? '';
    expect(text).toMatch(/90 days|90-day/);
    expect(text).toContain('/api/log/forget');

    unmount();
  });
});

describe('lib/ask-log: persistAskInteraction minimization', () => {
  const redisSetMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    redisSetMock.mockReset();
    vi.doMock('@/lib/rate-limit', () => ({ getRedis: vi.fn(() => ({ set: redisSetMock })) }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/log');
  });

  it('stores neither an email address nor a phone number from the question or the answer, and keeps the request id', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await persistAskInteraction({
      requestId: 'req-pii-1',
      ts: '2026-11-07T12:00:00.000Z',
      ipHash: 'hashed-ip',
      question: 'Write to jane@example.com or call +55 11 99999-9999',
      answer: 'I cannot contact jane@example.com',
      inputTokens: 1,
      outputTokens: 1,
      durationMs: 1,
      status: 'completed',
    });

    const [key, value] = redisSetMock.mock.calls[0] ?? [];
    expect(String(key)).toBe('ask:log:2026-11-07:req-pii-1');
    const stored = JSON.parse(String(value)) as {
      requestId: string;
      question: string;
      answer: string;
    };
    expect(stored.requestId).toBe('req-pii-1');
    expect(stored.question).not.toMatch(/jane@example\.com|99999-9999/);
    expect(stored.answer).not.toContain('jane@example.com');
  });

  it('redacts before truncating, so a cut address never leaves a readable prefix', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    const { persistAskInteraction } = await import('@/lib/ask-log');
    const padding = 'x'.repeat(490);
    await persistAskInteraction({
      requestId: 'req-pii-2',
      ts: '2026-11-07T12:00:00.000Z',
      ipHash: 'hashed-ip',
      question: `${padding} jane.doe@example.com`,
      answer: 'A',
      inputTokens: 1,
      outputTokens: 1,
      durationMs: 1,
      status: 'completed',
    });

    const [, value] = redisSetMock.mock.calls[0] ?? [];
    const stored = JSON.parse(String(value)) as { question: string };
    expect(stored.question).not.toContain('jane');
  });
});
