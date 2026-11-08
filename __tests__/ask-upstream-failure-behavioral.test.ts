import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';
import { askRequest, readBody } from './helpers/ask-route';

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

vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    hasRedisCredentials: vi.fn(() => false),
    reserveBudget: vi.fn(async () => ({
      allowed: true,
      reserved: 1512,
      pct: 0,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    })),
    settleBudget: settleMock,
  }),
);

vi.mock('@/lib/ask-log', async () =>
  (await import('./helpers/ask-route')).askLogModule(persistMock),
);
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

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
    const res = await POST(askRequest({ question: 'Who is Erik?' }));

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
    const res = await POST(askRequest({ question: 'What does Erik build?' }));

    const body = await readBody(res);

    expect(body, 'provider and billing detail must stay in the server log').not.toContain(
      'credit balance',
    );
    expect(body).not.toContain('sk-ant');
  });

  it('refunds the whole budget reservation when the provider fails before reporting any usage', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(askRequest({ question: 'Where does Erik work?' }));
    await readBody(res);

    await vi.waitFor(() => expect(persistMock).toHaveBeenCalledOnce());
    expect(
      settleMock,
      'no usage was reported, so settlement was skipped and every failed call kept its 1512-token reservation against the monthly cap',
    ).toHaveBeenCalledWith(1512, 0, 0, 'ask:tokens:test', 'ask:tokens:day:test');
  });
});
