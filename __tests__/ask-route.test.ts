import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: vi.fn(async () => ({ allowed: true, reserved: 0, pct: 0, budgetKey: 'k' })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function ask(locale: string): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question: 'hi', locale }),
    headers: { 'Content-Type': 'application/json', 'x-site-locale': locale },
  });
}

describe('ask kill switch answer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ASK_ENABLED', 'off');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['en', 'temporarily unavailable'],
    ['pt', 'temporariamente indisponível'],
  ])('is the bare status text in %s, the shell adds the contact line', async (locale, text) => {
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(ask(locale));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: text });
  });
});
