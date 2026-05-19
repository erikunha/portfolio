// __tests__/budget-cap.test.ts
// Behavioral tests for the reservation-pattern monthly token budget cap.
//
// Reservation pattern (PR 2 of audit roadmap, replaces the prior
// check-then-increment pattern that could undercount on client disconnect):
//   1. reserveBudget(maxOutputTokens) INCRBYs the counter by
//      RESERVED_INPUT_TOKENS + maxOutputTokens BEFORE the Anthropic call.
//   2. If the reservation crosses 100%, refund and reject.
//   3. After the stream ends (success OR error), settleBudget(reserved, in, out)
//      DECRBYs by (reserved - actual) to refund unused tokens.
//
// These are behavioral assertions against the rate-limit module — they exercise
// the actual Redis pipeline contract, not source layout. See
// docs/audit/2026-05-19-principal-audit.md Standard 5.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory Redis stub. Holds a single counter so we can verify reserve/settle
// arithmetic deterministically.
const counter: { value: number } = { value: 0 };
const decrbyMock = vi.fn(async (_key: string, n: number): Promise<number> => {
  counter.value -= n;
  return counter.value;
});

const pipelineExec = vi.fn(async (): Promise<[number, number]> => [counter.value, 1]);

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(async () => counter.value),
      decrby: decrbyMock,
      pipeline: () => ({
        incrby: (_k: string, n: number) => {
          counter.value += n;
        },
        expire: vi.fn(),
        exec: pipelineExec,
      }),
    }),
  },
}));

// Skip the Upstash ratelimit wrapper — not exercised here.
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
  },
}));

// Quiet the logger.
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('budget reservation pattern', () => {
  beforeEach(() => {
    counter.value = 0;
    vi.clearAllMocks();
  });

  it('reserves RESERVED_INPUT_TOKENS + maxOutputTokens upfront and allows within cap', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(true);
    expect(result.reserved).toBe(1000 + 512);
    expect(counter.value).toBe(1512);
  });

  it('rejects and refunds the reservation when it would cross the 400k cap', async () => {
    counter.value = 399_000; // 1k away from cap; +1512 reservation crosses it
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(0);
    // The counter must be restored — fail-closed on the user side, but the
    // counter accounting must not stay artificially inflated.
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:/), 1512);
  });

  it('settleBudget refunds (reserved - actual) when actual is less than reserved', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    await reserveBudget(512); // counter = 1512
    decrbyMock.mockClear();
    await settleBudget(1512, /*actualIn*/ 120, /*actualOut*/ 80);
    // refund = 1512 - 200 = 1312
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:/), 1312);
  });

  it('settleBudget is a no-op when actual >= reserved (defensive)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(1512, /*in*/ 1000, /*out*/ 600); // 1600 > 1512
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('settleBudget skips when reserved <= 0 (Redis-failure path)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(0, 100, 200);
    expect(decrbyMock).not.toHaveBeenCalled();
  });
});
