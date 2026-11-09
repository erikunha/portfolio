import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';

const limit = vi.fn();

vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    getAskLimit: vi.fn(() => ({ limit })),
    reserveBudget: vi.fn(async () => ({ allowed: true, reserved: 0, pct: 0, budgetKey: 'k' })),
  }),
);
vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

const NOW = Date.parse('2026-11-05T12:00:00Z');
const MINUTE_MS = 60_000;

function ask(): NextRequest {
  return askRequest({ question: 'hi' });
}

describe('ask 429 Retry-After', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  async function limited(result: Record<string, unknown>): Promise<Response> {
    limit.mockResolvedValue({ success: false, ...result });
    const { POST } = await import('@/app/api/ask/route');
    return POST(ask());
  }

  it('counts the seconds until the limiter window resets', async () => {
    const response = await limited({ reset: NOW + 38 * MINUTE_MS });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('2280');
  });

  it('rounds a partial second up so the client never retries early', async () => {
    const response = await limited({ reset: NOW + 1500 });
    expect(response.headers.get('Retry-After')).toBe('2');
  });

  it('never advertises a zero or negative wait', async () => {
    const response = await limited({ reset: NOW - MINUTE_MS });
    expect(response.headers.get('Retry-After')).toBe('1');
  });

  it.each([
    ['missing', {}],
    ['not a number', { reset: 'soon' }],
    ['not finite', { reset: Number.POSITIVE_INFINITY }],
  ])('sends no header when the limiter reset is %s', async (_name, result) => {
    const response = await limited(result);
    expect(response.status).toBe(429);
    expect(response.headers.has('Retry-After')).toBe(false);
  });
});
