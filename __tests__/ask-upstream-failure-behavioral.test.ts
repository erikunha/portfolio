import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';

const PROVIDER_DETAIL = 'Your credit balance is too low; key sk-ant-demo rejected by gateway.eu-1';
const persistMock = vi.fn(async (_interaction: { status: string }) => undefined);
const settleMock = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock('@/lib/ask/model', async () => {
  const { MockLanguageModelV4 } = await import('ai/test');
  return {
    ASK_MODEL: new MockLanguageModelV4({
      doStream: async () => {
        throw new Error(PROVIDER_DETAIL);
      },
    }),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  hasRedisCredentials: vi.fn(() => false),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 1512,
    pct: 0,
    budgetKey: 'ask:tokens:test',
    dailyKey: 'ask:tokens:day:test',
  })),
  settleBudget: settleMock,
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: persistMock }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: !done });
  }
  return out;
}

describe('/api/ask when the model provider fails', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    persistMock.mockClear();
    settleMock.mockClear();
  });

  it('tells the visitor the model failed instead of streaming an empty successful answer', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const { STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
    const res = await POST(
      new NextRequest('http://localhost/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'Who is Erik?' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = await readBody(res);

    expect(
      body,
      'the AI SDK reports a provider failure through onError and ends textStream with no text, so an unhandled failure reaches the shell as "(empty response)"',
    ).toBe(`${STREAM_ERR_SENTINEL}${askErrors[SITE_LOCALE.en].interrupted}`);
    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(persistMock.mock.calls[0]?.[0].status).toBe('errored');
  });

  it('never forwards the provider error text to the visitor', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(
      new NextRequest('http://localhost/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'What does Erik build?' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = await readBody(res);

    expect(body, 'provider and billing detail must stay in the server log').not.toContain(
      'credit balance',
    );
    expect(body).not.toContain('sk-ant');
  });

  it('refunds the whole budget reservation when the provider fails before reporting any usage', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(
      new NextRequest('http://localhost/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question: 'Where does Erik work?' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await readBody(res);

    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(
      settleMock,
      'no usage was reported, so settlement was skipped and every failed call kept its 1512-token reservation against the monthly cap',
    ).toHaveBeenCalledWith(1512, 0, 0, 'ask:tokens:test', 'ask:tokens:day:test');
  });
});
