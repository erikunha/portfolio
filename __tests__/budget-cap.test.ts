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
vi.mock('@upstash/ratelimit', () => {
  function Ratelimit() {
    return {};
  }
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

// Quiet the logger.
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('budget reservation pattern', () => {
  beforeEach(() => {
    counter.value = 0;
    vi.clearAllMocks();
  });

  // Reservation = RESERVED_INPUT_TOKENS (2200) + maxOutputTokens.
  // PR 4 of audit roadmap padded SYSTEM above the 1024-token Haiku
  // ephemeral cache minimum (~1500 tokens cache-cold). The original
  // RESERVED_INPUT_TOKENS=1000 was sized for the pre-PR-4 SYSTEM and
  // undercounts. Copilot flagged this on PR #29; the fix raises the
  // reservation to 2200 so actual ≤ reserved holds AND settleBudget
  // refunds a positive delta. See lib/rate-limit.ts file comment.
  const INPUT_RESERVATION = 2200;

  it('reserves RESERVED_INPUT_TOKENS + maxOutputTokens upfront and allows within cap', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(true);
    expect(result.reserved).toBe(INPUT_RESERVATION + 512);
    expect(counter.value).toBe(INPUT_RESERVATION + 512);
  });

  it('rejects and refunds the reservation when it would cross the 3M cap', async () => {
    // Place the counter 1k away from the cap so any reservation > 1k crosses.
    counter.value = 2_999_000;
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result.allowed).toBe(false);
    expect(result.reserved).toBe(0);
    // The counter must be restored — fail-closed on the user side, but the
    // counter accounting must not stay artificially inflated.
    expect(decrbyMock).toHaveBeenCalledWith(
      expect.stringMatching(/ask:tokens:/),
      INPUT_RESERVATION + 512,
    );
  });

  it('settleBudget refunds (reserved - actual) when actual is less than reserved', async () => {
    const { reserveBudget, settleBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    const reserved = result.reserved;
    decrbyMock.mockClear();
    await settleBudget(reserved, /*actualIn*/ 120, /*actualOut*/ 80);
    expect(decrbyMock).toHaveBeenCalledWith(expect.stringMatching(/ask:tokens:/), reserved - 200);
  });

  it('settleBudget is a no-op when actual >= reserved (defensive)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    // Pass actuals that intentionally exceed an arbitrary reservation. The
    // defensive branch (no negative refund) is what we're asserting.
    await settleBudget(INPUT_RESERVATION + 512, /*in*/ 2500, /*out*/ 600);
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('settleBudget skips when reserved <= 0 (Redis-failure path)', async () => {
    const { settleBudget } = await import('@/lib/rate-limit');
    decrbyMock.mockClear();
    await settleBudget(0, 100, 200);
    expect(decrbyMock).not.toHaveBeenCalled();
  });
});
