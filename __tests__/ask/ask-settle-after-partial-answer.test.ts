import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { askRequest } from '../helpers/ask-route';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const settleBudgetMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const persistMock = vi.hoisted(() => vi.fn(async (_row: { status: string }) => undefined));
const guardCountMock = vi.hoisted(() => vi.fn(async (_kind: string) => undefined));

const registeredTask = (): Promise<void> => {
  const [task] = afterMock.mock.calls[0] as [() => Promise<void>];
  return task();
};

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/redis', () => ({ hasRedisCredentials: vi.fn(() => true) }));
vi.mock('@/lib/server/client-ip', async () =>
  (await import('../helpers/ask-route')).clientIpModule(),
);
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/ask-route')).rateLimitModule());
vi.mock('@/lib/ask/budget', async () =>
  (await import('../helpers/ask-route')).budgetModule({
    reserveBudget: vi.fn(async () => ({
      allowed: true,
      reserved: 2712,
      pct: 0,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    })),
    settleBudget: settleBudgetMock,
  }),
);
vi.mock('@/lib/ask/dedup', async () => (await import('../helpers/ask-route')).dedupModule());
vi.mock('@/lib/ask/interaction-log', async () =>
  (await import('../helpers/ask-route')).askLogModule(persistMock),
);
vi.mock('@/lib/ask/guard-count', () => ({ countAskGuardFinding: guardCountMock }));
vi.mock('@/lib/ip-hash', async () => (await import('../helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('../helpers/ask-route')).logModule());

function request(): NextRequest {
  return askRequest({ question: 'Who is Erik?' });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

type StreamOptions = { onError: (event: { error: unknown }) => void };

function failingUpstream(textBeforeFailure: string[]) {
  return (options: StreamOptions) => ({
    textStream: (async function* () {
      yield* textBeforeFailure;
      options.onError({ error: new Error('upstream dropped') });
    })(),
    usage: Promise.reject(new Error('no usage after upstream error')),
    finishReason: Promise.resolve(undefined),
  });
}

async function settleRequest(): Promise<void> {
  const { POST } = await import('@/app/api/ask/route');
  const res = await POST(request());
  await res.text();
  await flush();
  await registeredTask();
}

describe('/api/ask settlement when the upstream fails and usage is lost', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.resetModules();
    afterMock.mockReset();
    streamTextMock.mockReset();
    settleBudgetMock.mockClear();
    persistMock.mockClear();
    guardCountMock.mockClear();
  });

  it('keeps the reservation when answer text was already sent', async () => {
    streamTextMock.mockImplementation(failingUpstream(['Erik builds web applications.']));

    await settleRequest();

    expect(
      settleBudgetMock,
      'tokens were generated and streamed, so refunding the whole reservation would let a failing upstream serve answers for free',
    ).not.toHaveBeenCalled();
    expect(persistMock.mock.calls[0]?.[0].status).toBe('errored');
  });

  it('refunds the whole reservation when the upstream failed before any answer text', async () => {
    streamTextMock.mockImplementation(failingUpstream([]));

    await settleRequest();

    expect(settleBudgetMock).toHaveBeenCalledOnce();
    expect(settleBudgetMock).toHaveBeenCalledWith(
      2712,
      0,
      0,
      'ask:tokens:test',
      'ask:tokens:day:test',
    );
  });
});
