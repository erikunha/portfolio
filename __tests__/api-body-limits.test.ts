import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const limiterAdmits = vi.hoisted(() => ({ value: true }));
const limiterCalls = vi.hoisted(() => ({ count: 0 }));
const admit = vi.hoisted(() => async () => {
  limiterCalls.count += 1;
  return { success: limiterAdmits.value };
});

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: admit })),
  getContactLimit: vi.fn(() => ({ limit: admit })),
  getErrorLogLimit: vi.fn(() => ({ limit: admit })),
  getErrorLogDailyLimit: vi.fn(() => ({ limit: admit })),
  getErrorLogIpDailyLimit: vi.fn(() => ({ limit: admit })),
  getRedis: vi.fn(() => null),
  reserveBudget: vi.fn(async () => ({
    allowed: false,
    reserved: 0,
    pct: 100,
    budgetKey: 'k',
    dailyKey: 'd',
  })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ask/refusal-count', () => ({ countAskRefusal: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed') }));

const post = (path: string, bytes: number) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'x'.repeat(bytes), message: 'x'.repeat(bytes) }),
  });

function untouchedStreamPost(path: string): { request: NextRequest; wasRead: () => boolean } {
  let read = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        read = true;
        controller.enqueue(new TextEncoder().encode('{}'));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    duplex: 'half',
  };
  const request = new NextRequest(
    `http://localhost${path}`,
    init as ConstructorParameters<typeof NextRequest>[1],
  );
  return { request, wasRead: () => read };
}

const ROUTES = [
  ['/api/ask', '@/app/api/ask/route', 8_192],
  ['/api/contact', '@/app/api/contact/route', 16_384],
  ['/api/log', '@/app/api/log/route', 32_768],
] as const;

type PostHandler = { POST: (req: NextRequest) => Promise<Response> };

describe.each(ROUTES)('%s body limit', (path, modulePath, limit) => {
  beforeEach(() => {
    limiterAdmits.value = true;
    limiterCalls.count = 0;
  });

  it(`answers 413 to a body over ${limit} bytes once the rate limiter has admitted the request`, async () => {
    const { POST } = (await import(modulePath)) as PostHandler;
    const response = await POST(post(path, limit));
    expect(response.status).toBe(413);
    expect(limiterCalls.count).toBeGreaterThan(0);
  });

  it('does not read the body of a request the rate limiter refuses', async () => {
    limiterAdmits.value = false;
    const { POST } = (await import(modulePath)) as PostHandler;
    const { request, wasRead } = untouchedStreamPost(path);
    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(
      wasRead(),
      'buffering the body before the limiter lets a slow-drip sender hold a function instance for free',
    ).toBe(false);
  });
});
