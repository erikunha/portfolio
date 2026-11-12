import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({ streamText: mockStreamText }));

function makeStreamTextResult(text = 'ok', finishReason = 'stop') {
  return {
    finishReason: Promise.resolve(finishReason),
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

async function drain(res: Response): Promise<string> {
  return res.text();
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

describe('/api/ask request shape for Haiku 5.5', () => {
  it('sends no sampling parameter, because Haiku 5.5 rejects a non-default temperature, top_p or top_k with a 400', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const arg = mockStreamText.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('temperature');
    expect(arg).not.toHaveProperty('topP');
    expect(arg).not.toHaveProperty('topK');
    await drain(res);
  });

  it('turns thinking off, so no thinking token competes with the answer for the output cap', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const arg = mockStreamText.mock.calls[0]?.[0] as {
      providerOptions?: { anthropic?: { thinking?: { type?: string } } };
    };
    expect(arg.providerOptions?.anthropic?.thinking).toEqual({ type: 'disabled' });
    await drain(res);
  });

  it('carries no sampling parameter in the Anthropic provider options either', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    const arg = mockStreamText.mock.calls[0]?.[0] as {
      providerOptions?: { anthropic?: Record<string, unknown> };
    };
    const anthropic = arg.providerOptions?.anthropic ?? {};
    expect(anthropic).not.toHaveProperty('temperature');
    expect(anthropic).not.toHaveProperty('topP');
    expect(anthropic).not.toHaveProperty('topK');
    expect(anthropic).not.toHaveProperty('top_p');
    expect(anthropic).not.toHaveProperty('top_k');
    await drain(res);
  });

  it('ends a refused answer with the refusal line instead of a silent cut or the interrupted line', async () => {
    mockStreamText.mockReturnValueOnce(makeStreamTextResult('partial', 'content-filter'));
    const { POST } = await import('@/app/api/ask/route');
    const { REFUSAL_PREFIX } = await import('@/lib/stream-protocol');
    const res = await POST(makeRequest());
    const body = await drain(res);
    expect(body).toContain(`${REFUSAL_PREFIX}${askErrors.en.refused}`);
    expect(body).not.toContain(askErrors.en.interrupted);
  });
});
