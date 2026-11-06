import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';

const limit = vi.fn(async () => ({ success: false, reset: 0 }));
const persist = vi.fn(async () => undefined);

vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit })),
  hasRedisCredentials: vi.fn(() => false),
  reserveBudget: vi.fn(async () => ({ allowed: true, reserved: 0, pct: 0, budgetKey: 'k' })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: persist }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function ask(site: string | null, locale?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (site !== null) headers['Sec-Fetch-Site'] = site;
  if (locale) headers['x-site-locale'] = locale;
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'hi' }),
    headers,
  });
}

describe('ask cross-site gate', () => {
  beforeEach(() => {
    vi.resetModules();
    limit.mockClear();
    persist.mockClear();
  });

  it.each(['cross-site', 'same-site'])(
    'refuses a %s browser request before it spends the visitor rate limit',
    async (site) => {
      const { POST } = await import('@/app/api/ask/route');
      const res = await POST(ask(site));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: askErrors.en.forbiddenOrigin });
      expect(limit).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    },
  );

  it('answers the refusal in the page locale', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(ask('cross-site', 'pt'));
    expect(await res.json()).toEqual({ error: askErrors.pt.forbiddenOrigin });
  });

  it.each([['same-origin'], ['none'], [null]])(
    'lets Sec-Fetch-Site %s reach the rate limit',
    async (site) => {
      const { POST } = await import('@/app/api/ask/route');
      await POST(ask(site));
      expect(limit).toHaveBeenCalledTimes(1);
    },
  );
});
