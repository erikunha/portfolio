import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_TEMPERATURE } from '@/lib/ask/limits';
import { ASK_MODEL } from '@/lib/ask/model';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({ streamText: mockStreamText }));

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
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 1512,
    pct: 0,
    budgetKey: 'ask:tokens:test',
  })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
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

async function drain(res: Response): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

beforeEach(() => {
  vi.resetModules();
  mockStreamText.mockReset().mockReturnValue(makeStreamTextResult());
  for (const key of [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'AI_GATEWAY_API_KEY',
    'RESEND_API_KEY',
    'PSI_API_KEY',
    'CRON_SECRET',
    'DEPLOY_SALT',
  ]) {
    vi.stubEnv(key, '');
  }
  vi.stubEnv('ASK_ENABLED', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ASK_MODEL — single source of truth', () => {
  it('is the exact model string POST /api/ask hands to streamText', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledOnce();
    const arg = mockStreamText.mock.calls[0]?.[0] as { model: string };
    expect(arg.model).toBe(ASK_MODEL);
    await drain(res);
  });

  it('hands streamText the named low temperature so one question answers the same way across runs', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const arg = mockStreamText.mock.calls[0]?.[0] as { temperature?: number };
    expect(arg.temperature).toBe(ASK_TEMPERATURE);
    expect(ASK_TEMPERATURE).toBeGreaterThan(0);
    expect(ASK_TEMPERATURE).toBeLessThanOrEqual(0.3);
    await drain(res);
  });

  it('exposes a non-empty provider/model string', () => {
    expect(ASK_MODEL).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
  });

  it('follows ASK_MODEL, so no second copy of the model string can drift from it', async () => {
    const sentinel = 'sentinel-provider/sentinel-model';
    vi.doMock('@/lib/ask/model', () => ({ ASK_MODEL: sentinel }));
    try {
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(makeRequest());
      const arg = mockStreamText.mock.calls[0]?.[0] as { model: string };
      expect(
        arg.model,
        'a model string written into the stream module would still equal the real ASK_MODEL; a stand-in value exposes it',
      ).toBe(sentinel);
      await drain(res);
    } finally {
      vi.doUnmock('@/lib/ask/model');
    }
  });
});
