import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStreamText = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true }));
const reserveBudgetMock = vi.fn(async () => ({
  allowed: true,
  reserved: 1512,
  pct: 0,
  budgetKey: 'ask:tokens:test',
}));
const persistMock = vi.fn(async () => undefined);

vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

function makeStreamTextResult(text = 'ok') {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 1 }),
  };
}

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
  mockStreamText.mockReset();
  rateLimitMock.mockReset().mockResolvedValue({ success: true });
  reserveBudgetMock
    .mockReset()
    .mockResolvedValue({ allowed: true, reserved: 1512, pct: 0, budgetKey: 'ask:tokens:test' });
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
      expect(rateLimitMock).not.toHaveBeenCalled();
      expect(reserveBudgetMock).not.toHaveBeenCalled();
      expect(mockStreamText).not.toHaveBeenCalled();
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
    mockStreamText.mockReturnValue(makeStreamTextResult());
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledOnce();
    expect(reserveBudgetMock).toHaveBeenCalledOnce();
    expect(mockStreamText).toHaveBeenCalledOnce();

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
    mockStreamText.mockReturnValue(makeStreamTextResult());
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
      mockStreamText.mockReturnValueOnce(makeStreamTextResult());
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
