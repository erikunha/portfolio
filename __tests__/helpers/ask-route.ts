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

export function clientIpModule(overrides: Record<string, unknown> = {}) {
  return {
    getClientIp: vi.fn(() => TEST_CLIENT_IP),
    ...overrides,
  };
}

export function rateLimitModule(overrides: Record<string, unknown> = {}) {
  return {
    getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
    ...overrides,
  };
}

type ReservationFixture = {
  reserved: number;
  budgetKey: string;
  dailyKey: string;
  ipHash: string;
  question: string;
};

type UsageFixture = {
  billedInputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export function budgetModule(overrides: Record<string, unknown> = {}) {
  const settleBudget = vi.fn(async (..._args: unknown[]) => undefined);
  const base = {
    reserveBudget: vi.fn(async (..._args: unknown[]) => ({
      allowed: true,
      reserved: TEST_RESERVED_TOKENS,
      pct: 0,
      budgetKey: TEST_BUDGET_KEY,
    })),
    settleBudget,
    ...overrides,
  };
  const settle = base.settleBudget as (...args: unknown[]) => Promise<unknown>;
  const actualBudget = vi.importActual<typeof import('@/lib/ask/budget')>('@/lib/ask/budget');
  const actual = () => actualBudget;
  const settleReservation = vi.fn(
    async (reservation: ReservationFixture, usage: UsageFixture | 'none') => {
      const { settleParams } = await actual();
      return settle(settleParams(reservation, usage));
    },
  );
  const abandonReservation = vi.fn(async (reservation: ReservationFixture) => {
    const { abandonSettleParams } = await actual();
    const params = abandonSettleParams(reservation);
    if (params !== null) await settle(params);
    const dedup = await import('@/lib/ask/dedup');
    await dedup.releaseIdenticalQuestion(reservation.ipHash, reservation.question);
  });
  return { settleReservation, abandonReservation, ...base };
}

export function dedupModule(overrides: Record<string, unknown> = {}) {
  return {
    checkIdenticalQuestion: vi.fn(async (..._args: unknown[]) => ({ allowed: true })),
    releaseIdenticalQuestion: vi.fn(async (..._args: unknown[]) => undefined),
    ...overrides,
  };
}

export async function streamModuleFromRoute() {
  const { POST } = await import('@/app/api/ask/route');
  return {
    startAsk: async (req: Request) => {
      const response = await POST(req);
      return response.ok
        ? { ok: true, requestId: response.headers.get('X-Request-Id'), readable: response.body }
        : { ok: false, response };
    },
  };
}
