import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const handlerRan = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => {
    handlerRan();
    return '127.0.0.1';
  }),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  getContactLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  getErrorLogLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  getRedis: vi.fn(() => null),
  reserveBudget: vi.fn(async () => ({ allowed: false, reserved: 0, pct: 100, budgetKey: 'k' })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed') }));

const post = (path: string, bytes: number) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'x'.repeat(bytes), message: 'x'.repeat(bytes) }),
  });

describe.each([
  ['/api/ask', '@/app/api/ask/route', 8_192],
  ['/api/contact', '@/app/api/contact/route', 16_384],
  ['/api/log', '@/app/api/log/route', 32_768],
])('%s body limit', (path, modulePath, limit) => {
  it(`answers 413 to a body over ${limit} bytes before the handler runs`, async () => {
    handlerRan.mockClear();
    const { POST } = (await import(modulePath)) as {
      POST: (req: NextRequest) => Promise<Response>;
    };
    const response = await POST(post(path, limit));
    expect(response.status).toBe(413);
    expect(handlerRan).not.toHaveBeenCalled();
  });
});
