import { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const ASK_URL = 'http://localhost/api/ask';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const TEST_CLIENT_IP = '127.0.0.1';
const TEST_IP_HASH = 'hashed-ip-test';
const TEST_RESERVED_TOKENS = 1512;
const TEST_BUDGET_KEY = 'ask:tokens:test';

type AnyMock = (...args: never[]) => unknown;
type LogLevel = 'info' | 'error' | 'warn' | 'debug';
type AskRequestOptions = { headers?: Record<string, string>; url?: string };

export function askRequest(body: unknown, options: AskRequestOptions = {}): NextRequest {
  return new NextRequest(options.url ?? ASK_URL, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { ...JSON_HEADERS, ...options.headers },
  });
}

export async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

export function logModule(overrides: Partial<Record<LogLevel, AnyMock>> = {}) {
  const log: Record<LogLevel, AnyMock> = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    ...overrides,
  };
  return { log };
}

export function askLogModule(persistAskInteraction: AnyMock = vi.fn(async () => undefined)) {
  return { persistAskInteraction };
}

export function ipHashModule(hashIp: AnyMock = vi.fn(async () => TEST_IP_HASH)) {
  return { hashIp };
}

export function rateLimitModule(overrides: Record<string, unknown> = {}) {
  return {
    getClientIp: vi.fn(() => TEST_CLIENT_IP),
    getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
    reserveBudget: vi.fn(async (..._args: unknown[]) => ({
      allowed: true,
      reserved: TEST_RESERVED_TOKENS,
      pct: 0,
      budgetKey: TEST_BUDGET_KEY,
    })),
    settleBudget: vi.fn(async (..._args: unknown[]) => undefined),
    checkIdenticalQuestion: vi.fn(async (..._args: unknown[]) => ({ allowed: true })),
    ...overrides,
  };
}
