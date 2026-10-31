// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const pipelineExec = vi.fn(async (): Promise<[number, number]> => {
  throw new Error('Failed to parse URL from /pipeline');
});
const decrbyMock = vi.fn(async (): Promise<number> => {
  throw new Error('Failed to parse URL from /pipeline');
});

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      decrby: decrbyMock,
      pipeline: () => ({ incrby: vi.fn(), expire: vi.fn(), exec: pipelineExec }),
    }),
  },
}));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: { slidingWindow: () => ({}) } }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const RESERVATION = 2200 + 512;
const RUN_REQUESTS = 3;

describe('budget store seam', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('keeps the Redis-backed store fail-closed when no store is installed', async () => {
    const { reserveBudget } = await import('@/lib/rate-limit');
    const result = await reserveBudget(512);
    expect(result).toMatchObject({ allowed: false, reserved: 0 });
    expect(pipelineExec).toHaveBeenCalledOnce();
  });

  it('allows exactly the harness run size without touching Redis, then rejects', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(RUN_REQUESTS));

    for (let i = 0; i < RUN_REQUESTS; i += 1) {
      const result = await reserveBudget(512);
      expect(result).toMatchObject({ allowed: true, reserved: RESERVATION });
    }
    const over = await reserveBudget(512);
    expect(over).toMatchObject({ allowed: false, reserved: 0 });
    expect(pipelineExec).not.toHaveBeenCalled();
    expect(decrbyMock).not.toHaveBeenCalled();
  });

  it('returns the rejected reservation to the harness store', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(1));
    await reserveBudget(512);
    const firstRejected = await reserveBudget(512);
    const secondRejected = await reserveBudget(512);
    expect(firstRejected.allowed).toBe(false);
    expect(secondRejected.pct).toBeCloseTo(firstRejected.pct, 10);
  });

  it('settleBudget frees harness capacity for later reservations', async () => {
    const { createEvalBudgetStore, reserveBudget, setBudgetStore, settleBudget } = await import(
      '@/lib/rate-limit'
    );
    setBudgetStore(createEvalBudgetStore(2));
    const first = await reserveBudget(512);
    const second = await reserveBudget(512);
    expect((await reserveBudget(512)).allowed).toBe(false);

    await settleBudget(first.reserved, 100, 50, first.budgetKey);
    await settleBudget(second.reserved, 100, 50, second.budgetKey);

    expect((await reserveBudget(512)).allowed).toBe(true);
    expect(decrbyMock).not.toHaveBeenCalled();
  });
});
