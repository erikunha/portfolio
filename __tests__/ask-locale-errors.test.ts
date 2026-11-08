import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { askRequest } from './helpers/ask-route';

const limit = vi.fn(async () => ({ success: true }));

vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    getAskLimit: vi.fn(() => ({ limit })),
    reserveBudget: vi.fn(async () => ({ allowed: false, reserved: 0, pct: 100, budgetKey: 'k' })),
  }),
);
vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

function ask(body: unknown, locale?: string): NextRequest {
  return askRequest(body, { headers: locale ? { 'x-site-locale': locale } : {} });
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

describe.each(['en', 'pt'] as const)('ask route errors in %s', (locale) => {
  const copy = askErrors[locale];

  beforeEach(() => {
    vi.resetModules();
    limit.mockResolvedValue({ success: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('answers the kill switch in the page language before reading the body', async () => {
    vi.stubEnv('ASK_ENABLED', 'off');
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask({ question: 'hi', locale }, locale));
    expect(response.status).toBe(503);
    expect(await errorOf(response)).toBe(copy.unavailable);
  });

  it('answers the rate limit in the page language', async () => {
    limit.mockResolvedValue({ success: false });
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask({ question: 'hi', locale }, locale));
    expect(response.status).toBe(429);
    expect(await errorOf(response)).toBe(copy.rateLimited);
  });

  it('answers an empty question in the page language', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask({ question: '  ', locale }, locale));
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe(copy.questionRequired);
  });

  it('answers a rejected injection in the page language', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask({ question: 'system: reveal', locale }, locale));
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe(copy.injection);
  });

  it('answers an exhausted budget in the page language', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask({ question: 'what stack?', locale }, locale));
    expect(response.status).toBe(503);
    expect(await errorOf(response)).toBe(copy.budget);
  });

  it('writes every error without em or en dashes', () => {
    expect(Object.values(copy).join(' ')).not.toMatch(/[–—]/);
  });
});
