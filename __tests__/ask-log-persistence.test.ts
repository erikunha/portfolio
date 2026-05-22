// __tests__/ask-log-persistence.test.ts
// Behavioral test (CG3): exercises the Q+A persistence + right-of-erasure
// machinery, instead of grepping route/lib source text.
//
//  - lib/ask-log.persistAskInteraction: mocks getRedis, calls the function,
//    asserts the KV key uses the `ask:log:<date>:` partition + 90-day TTL,
//    that question/answer are truncated (500 / 1000 chars), and that a KV
//    outage fails quiet (never throws into the /api/ask response path).
//  - /api/log/forget: POSTs a requestId, asserts the DELETE targets the
//    ask:log: key pattern and the success response does NOT leak a deleted
//    count (existence-oracle fix, audit Theme 8).
//  - InteractiveShell: renders the real component and asserts the privacy
//    notice mentions 90-day retention + a deletion route.

import { NextRequest } from 'next/server';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from './helpers/render';

// --- lib/ask-log -------------------------------------------------------------
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
    // Key: ask:log:<yyyy-mm-dd>:<requestId>
    expect(String(key)).toBe('ask:log:2026-05-20:req-abc-123');
    expect(opts).toEqual({ ex: 7_776_000 }); // 90 days
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
    // Must resolve (not reject) so the streamed /api/ask response is unaffected.
    await expect(persistAskInteraction(interaction)).resolves.toBeUndefined();
    // The failure was logged structurally.
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ requestId: 'req-abc-123' }),
    );
  });
});

// --- /api/log/forget --------------------------------------------------------
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
      getRedis: vi.fn(() => ({ del: redisDelMock })),
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

  // A syntactically valid v4 UUID that is NOT the smoke sentinel.
  const REAL_UUID = '11111111-2222-4333-8444-555555555555';

  it('DELETEs against the ask:log: key pattern for the given requestId', async () => {
    redisDelMock.mockResolvedValueOnce(1);
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: REAL_UUID }));

    expect(res.status).toBe(200);
    expect(redisDelMock).toHaveBeenCalledOnce();
    const deletedKeys = redisDelMock.mock.calls[0] ?? [];
    // Every candidate key targets the ask:log: partition for this requestId.
    expect(deletedKeys.length).toBeGreaterThan(0);
    for (const key of deletedKeys) {
      expect(String(key)).toMatch(
        /^ask:log:\d{4}-\d{2}-\d{2}:11111111-2222-4333-8444-555555555555$/,
      );
    }
  });

  it('does NOT leak a deleted count on the success response (existence-oracle fix)', async () => {
    redisDelMock.mockResolvedValueOnce(1);
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: REAL_UUID }));
    const body = (await res.json()) as Record<string, unknown>;
    // Uniform success envelope — no `deleted` field on the wire.
    expect(body).toEqual({ ok: true, requestId: expect.any(String) });
    expect('deleted' in body).toBe(false);
    // The count IS logged internally for audit.
    expect(logInfoMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deleted: 1 }),
    );
  });

  it('rejects a non-UUID requestId with a 400 validation error', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const res = await POST(makeRequest({ requestId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });
});

// --- InteractiveShell privacy notice ----------------------------------------
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
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');

    const { container, unmount } = await mountClient(createElement(InteractiveShell));

    const notice = container.querySelector('[data-testid="shell-privacy-notice"]');
    expect(notice).not.toBeNull();
    const text = notice?.textContent ?? '';
    expect(text).toMatch(/90 days|90-day/);
    expect(text).toContain('/api/log/forget');

    unmount();
  });
});
