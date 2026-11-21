import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';
import { resendModule } from './helpers/modules';

const CALLER_IP = '203.0.113.9';
const IP_HASH = 'ip-hash-sentinel-91c4e7';
const CONVERSATION = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const redisSet = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => 'OK'));
const redisGet = vi.hoisted(() => vi.fn());
const redisDel = vi.hoisted(() => vi.fn(async () => 1));
const zcard = vi.hoisted(() => vi.fn(async () => 0));
const tx = vi.hoisted(() => ({
  set: vi.fn(),
  sadd: vi.fn(),
  expire: vi.fn(),
  hset: vi.fn(),
  zadd: vi.fn(),
  exec: vi.fn(async () => ['OK', 1, 1]),
}));
const send = vi.hoisted(() => vi.fn());

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/redis', () => ({
  hasRedisCredentials: vi.fn(() => true),
  getRedis: vi.fn(() => ({
    set: redisSet,
    get: redisGet,
    del: redisDel,
    zcard,
    multi: () => tx,
  })),
}));
vi.mock('@/lib/server/client-ip', async () =>
  (await import('./helpers/ask-route')).clientIpModule({ getClientIp: vi.fn(() => CALLER_IP) }),
);
vi.mock('@/lib/ip-hash', async () =>
  (await import('./helpers/ask-route')).ipHashModule(vi.fn(async () => IP_HASH)),
);
vi.mock('@/lib/rate-limit', async () => ({
  ...(await import('./helpers/ask-route')).rateLimitModule(),
  getContactLimit: () => ({ limit: vi.fn(async () => ({ success: true })) }),
}));
vi.mock('@/lib/ask/budget', async () => (await import('./helpers/ask-route')).budgetModule());
vi.mock('@/lib/ask/dedup', async () => (await import('./helpers/ask-route')).dedupModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());
vi.mock('resend', async () => resendModule(send));

const IP_FIELD = 'ipHash';

function persistedValues(): string[] {
  const calls = [...redisSet.mock.calls, ...tx.set.mock.calls];
  return calls.map((call) => String(call[1]));
}

function expectNoIpDerivedData(serialized: string): void {
  const record = JSON.parse(serialized) as Record<string, unknown>;
  expect(Object.keys(record)).not.toContain(IP_FIELD);
  expect(serialized).not.toContain(IP_HASH);
  expect(serialized).not.toContain(CALLER_IP);
}

async function askAndSettle(body: Record<string, unknown>): Promise<void> {
  const { POST } = await import('@/app/api/ask/route');
  const res = await POST(askRequest(body));
  await res.text();
  const [task] = (afterMock.mock.calls[0] ?? []) as [(() => Promise<void>)?];
  await task?.();
}

function contactRequest(): NextRequest {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'A private contact message.',
    }),
  });
}

describe('persisted records hold no IP hash', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    redisSet.mockResolvedValue('OK');
    redisDel.mockResolvedValue(1);
    zcard.mockResolvedValue(0);
    tx.exec.mockResolvedValue(['OK', 1, 1]);
    send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield 'Erik builds web applications.';
      })(),
      usage: Promise.resolve({ inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} }),
      finishReason: Promise.resolve('stop'),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes an ask record without the hash when it has no conversation id', async () => {
    await askAndSettle({ question: 'who is erik?' });

    const values = persistedValues();
    expect(values).toHaveLength(1);
    expectNoIpDerivedData(values[0] ?? '');
    expect(JSON.parse(values[0] ?? '')).toMatchObject({ question: 'who is erik?' });
  });

  it('writes an ask record without the hash when it joins a conversation', async () => {
    await askAndSettle({ question: 'who is erik?', conversationId: CONVERSATION });

    const values = persistedValues();
    expect(values).toHaveLength(1);
    expectNoIpDerivedData(values[0] ?? '');
    expect(JSON.parse(values[0] ?? '')).toMatchObject({ conversationId: CONVERSATION });
  });

  it('writes a delivered contact message without the hash', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(contactRequest());

    expect(res.status).toBe(200);
    const values = persistedValues();
    expect(values).toHaveLength(1);
    expectNoIpDerivedData(values[0] ?? '');
    expect(JSON.parse(values[0] ?? '')).toMatchObject({
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'A private contact message.',
    });
  });

  it('writes a queued contact message without the hash', async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: 'rejected' } });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(contactRequest());

    expect(res.status).toBe(202);
    const values = persistedValues();
    expect(values).toHaveLength(1);
    expectNoIpDerivedData(values[0] ?? '');
  });

  it('still delivers a record stored before the field was dropped', async () => {
    const legacy = {
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Stored with the old shape.',
      receivedAt: new Date().toISOString(),
      ipHash: 'legacy-hash',
    };
    redisGet.mockResolvedValue(legacy);
    const { getContactMessage } = await import('@/lib/contact/outbox');
    const { sendContactMessage } = await import('@/lib/contact/delivery');

    const stored = await getContactMessage('legacy-1');
    expect(stored).not.toBeNull();
    expect(await sendContactMessage('legacy-1', stored ?? legacy, 'req-1')).toBe(true);
    expect(send.mock.calls[0]?.[0].text).toContain('Stored with the old shape.');
  });
});
