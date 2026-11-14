import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';
import { askRequest } from './helpers/ask-route';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const redisSet = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => 'OK'));
const tx = vi.hoisted(() => ({
  set: vi.fn(),
  sadd: vi.fn(),
  expire: vi.fn(),
  exec: vi.fn(async () => ['OK', 1, 1]),
}));
const reserveBudget = vi.hoisted(() =>
  vi.fn(async () => ({
    allowed: true,
    reserved: 2712,
    pct: 0,
    budgetKey: 'ask:tokens:test',
    dailyKey: 'ask:tokens:day:test',
  })),
);

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    hasRedisCredentials: vi.fn(() => true),
    getRedis: vi.fn(() => ({ set: redisSet, multi: () => tx })),
    reserveBudget,
  }),
);
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

const CONVERSATION = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const KV_TTL_S = 7_776_000;

function answering(): void {
  streamTextMock.mockReturnValue({
    textStream: (async function* () {
      yield 'Erik builds web applications.';
    })(),
    usage: Promise.resolve({ inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} }),
    finishReason: Promise.resolve('stop'),
  });
}

async function ask(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import('@/app/api/ask/route');
  const res = await POST(askRequest(body));
  await res.text();
  const [task] = (afterMock.mock.calls[0] ?? []) as [(() => Promise<void>)?];
  await task?.();
  return res;
}

describe('/api/ask stores each answer under its conversation', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    afterMock.mockReset();
    redisSet.mockClear();
    reserveBudget.mockClear();
    for (const fn of Object.values(tx)) fn.mockClear();
    streamTextMock.mockReset();
    answering();
  });

  it('writes the record with its conversation id and indexes its key for the log TTL, in one transaction', async () => {
    const res = await ask({ question: 'who is erik?', conversationId: CONVERSATION });
    const requestId = res.headers.get('X-Request-Id') ?? '';

    expect(tx.set).toHaveBeenCalledOnce();
    const [key, value, options] = tx.set.mock.calls[0] ?? [];
    expect(String(key)).toMatch(new RegExp(`^ask:log:\\d{4}-\\d{2}-\\d{2}:${requestId}$`));
    expect(JSON.parse(String(value))).toMatchObject({ requestId, conversationId: CONVERSATION });
    expect(options).toEqual({ ex: KV_TTL_S });
    expect(tx.sadd).toHaveBeenCalledWith(`ask:conv:${CONVERSATION}`, key);
    expect(tx.expire).toHaveBeenCalledWith(`ask:conv:${CONVERSATION}`, KV_TTL_S);
    expect(tx.exec).toHaveBeenCalledOnce();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('stores the conversation id in lower case', async () => {
    await ask({ question: 'who is erik?', conversationId: CONVERSATION.toUpperCase() });
    expect(tx.sadd).toHaveBeenCalledWith(`ask:conv:${CONVERSATION}`, expect.any(String));
  });

  it('keeps a request without a conversation id as a standalone record with no index', async () => {
    await ask({ question: 'who is erik?' });
    expect(redisSet).toHaveBeenCalledOnce();
    const [, value] = redisSet.mock.calls[0] ?? [];
    expect(JSON.parse(String(value))).not.toHaveProperty('conversationId');
    expect(tx.sadd).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-uuid string', 'not-a-conversation'],
    ['a number', 42],
    ['an empty string', ''],
    ['an object', { id: CONVERSATION }],
  ])('rejects %s as conversation id with 400 before reserving budget', async (_label, value) => {
    const res = await ask({ question: 'who is erik?', conversationId: value });
    expect(res.status).toBe(400);
    expect(reserveBudget).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('answers the invalid conversation id with the invalid body copy', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(askRequest({ question: 'who is erik?', conversationId: 'nope' }));
    expect(await res.json()).toEqual({ error: askErrors[SITE_LOCALE.en].invalidBody });
  });
});
