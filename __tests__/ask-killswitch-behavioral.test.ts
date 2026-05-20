// __tests__/ask-killswitch-behavioral.test.ts
// Behavioral replacement for the prior source-grep ask-killswitch.test.ts.
// PR 7 of audit roadmap — Standard 5 ("tests assert behavior, not source").
//
// Verifies the actual kill-switch contract by calling POST /api/ask with
// each off-keyword AND asserts that the dependencies that SHOULD NOT have
// been touched (rate-limit, Anthropic, persistence) were not called. The
// prior source-grep version checked the symbol order by string index — it
// would have passed even if the kill-switch code was dead-branched or
// commented out.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMessagesCreate = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true }));
const reserveBudgetMock = vi.fn(async () => ({ allowed: true, reserved: 1512, pct: 0 }));
const persistMock = vi.fn(async () => undefined);

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate };
  }
  return { default: MockAnthropic };
});

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: rateLimitMock })),
  reserveBudget: reserveBudgetMock,
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@/lib/ask-log', () => ({
  persistAskInteraction: persistMock,
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(question = 'Who is Erik?'): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetModules();
  mockMessagesCreate.mockReset();
  rateLimitMock.mockReset().mockResolvedValue({ success: true });
  reserveBudgetMock.mockReset().mockResolvedValue({ allowed: true, reserved: 1512, pct: 0 });
  persistMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const OFF_KEYWORDS = ['false', '0', 'off', 'no', 'disabled'];

describe('/api/ask kill switch — behavioral (PR 7, replaces source-grep)', () => {
  for (const keyword of OFF_KEYWORDS) {
    it(`rejects with 503 + email-fallback message when ASK_ENABLED='${keyword}'`, async () => {
      vi.stubEnv('ASK_ENABLED', keyword);
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: string };
      expect(body.error.toLowerCase()).toContain('email erikhenriquealvescunha@gmail.com');
      // Most important assertion: NONE of the downstream dependencies fired.
      // The prior source-grep test could not catch a regression that
      // moved the kill check to AFTER any of these.
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(reserveBudgetMock).not.toHaveBeenCalled();
      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(persistMock).not.toHaveBeenCalled();
    });
  }

  for (const keyword of OFF_KEYWORDS) {
    it(`also rejects when ASK_ENABLED='${keyword.toUpperCase()}' (case-insensitive)`, async () => {
      vi.stubEnv('ASK_ENABLED', keyword.toUpperCase());
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(503);
      expect(rateLimitMock).not.toHaveBeenCalled();
    });
  }

  for (const keyword of OFF_KEYWORDS) {
    it(`also rejects when ASK_ENABLED=' ${keyword} ' (trimmed)`, async () => {
      vi.stubEnv('ASK_ENABLED', `  ${keyword}  `);
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(503);
      expect(rateLimitMock).not.toHaveBeenCalled();
    });
  }

  it("passes the request through when ASK_ENABLED='true'", async () => {
    vi.stubEnv('ASK_ENABLED', 'true');
    mockMessagesCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } };
        yield { type: 'message_delta', usage: { output_tokens: 1 } };
      },
    });
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledOnce();
    expect(reserveBudgetMock).toHaveBeenCalledOnce();
    expect(mockMessagesCreate).toHaveBeenCalledOnce();

    // Drain the stream so the persistAskInteraction promise in `finally`
    // can settle without leaking microtasks.
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });

  it('also passes when ASK_ENABLED is unset (treated as on)', async () => {
    vi.stubEnv('ASK_ENABLED', '');
    mockMessagesCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } };
        yield { type: 'message_delta', usage: { output_tokens: 1 } };
      },
    });
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });

  it('does NOT reject on arbitrary non-off keywords (`maybe`, `yes`, `enabled`)', async () => {
    for (const value of ['maybe', 'yes', 'enabled']) {
      vi.stubEnv('ASK_ENABLED', value);
      mockMessagesCreate.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } };
          yield { type: 'message_delta', usage: { output_tokens: 1 } };
        },
      });
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(200);

      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    }
  });
});
