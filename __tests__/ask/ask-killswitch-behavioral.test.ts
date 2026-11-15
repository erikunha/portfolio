import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from '../helpers/ask-route';
import { streamTextResult } from '../helpers/modules';

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

vi.mock('@/lib/server/client-ip', async () =>
  (await import('../helpers/ask-route')).clientIpModule(),
);
vi.mock('@/lib/rate-limit', async () =>
  (await import('../helpers/ask-route')).rateLimitModule({
    getAskLimit: vi.fn(() => ({ limit: rateLimitMock })),
  }),
);
vi.mock('@/lib/ask/budget', async () =>
  (await import('../helpers/ask-route')).budgetModule({ reserveBudget: reserveBudgetMock }),
);
vi.mock('@/lib/ask/dedup', async () => (await import('../helpers/ask-route')).dedupModule());

vi.mock('@/lib/ask/interaction-log', async () =>
  (await import('../helpers/ask-route')).askLogModule(persistMock),
);

vi.mock('@/lib/ip-hash', async () => (await import('../helpers/ask-route')).ipHashModule());

vi.mock('@/lib/log', async () => (await import('../helpers/ask-route')).logModule());

function makeRequest(question = 'Who is Erik?'): NextRequest {
  return askRequest({ question });
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

describe('/api/ask kill switch: behavioral (PR 7, replaces source-grep)', () => {
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
    mockStreamText.mockReturnValue(streamTextResult());
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
    mockStreamText.mockReturnValue(streamTextResult());
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
      mockStreamText.mockReturnValueOnce(streamTextResult());
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
