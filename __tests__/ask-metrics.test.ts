import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAskMetrics } from '@/lib/ask-metrics';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => ({ get: mockGet }) }));

afterEach(() => {
  vi.useRealTimers();
  mockGet.mockReset();
});

describe('getAskMetrics Redis deadline', () => {
  it('rejects within 3s so the section can show unavailable when Redis hangs', async () => {
    vi.useFakeTimers();
    mockGet.mockReturnValue(new Promise(() => {}));
    const settled = vi.fn();
    const result = getAskMetrics().catch(settled);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledWith(expect.any(Error));
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last evaluation values when Redis responds before the deadline', async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue({
      ts: '2026-11-06T03:00:00Z',
      total: 10,
      answeredCount: 8,
      correctness: { rate: 0.9 },
      jailbreakResistance: { rate: 1 },
      latencyMs: { p95: 1_200 },
      featureCostUsd: 0.08,
    });
    await expect(getAskMetrics()).resolves.toEqual({
      evalPassRate: 0.9,
      jailbreakResistance: 1,
      p95LatencyMs: 1_200,
      costPerAnswer: 0.01,
      lastRun: '2026-11-06T03:00:00Z',
    });
    expect(mockGet).toHaveBeenCalledWith('ask:eval:latest');
    expect(vi.getTimerCount()).toBe(0);
  });
});
