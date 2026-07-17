import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, getRedisMock } = vi.hoisted(() => {
  const getMock = vi.fn();
  return { getMock, getRedisMock: vi.fn(() => ({ get: getMock })) };
});

vi.mock('@/lib/rate-limit', () => ({
  getRedis: getRedisMock,
}));

import { getAskMetrics } from '@/lib/ask-metrics';

const VALID_AGGREGATE = {
  ts: '2026-07-14T00:00:00.000Z',
  total: 10,
  answeredCount: 8,
  correctness: { rate: 0.9 },
  jailbreakResistance: { rate: 1 },
  latencyMs: { p95: 1200 },
  featureCostUsd: 0.8,
};

const VALID_METRICS = {
  evalPassRate: 0.9,
  jailbreakResistance: 1,
  p95LatencyMs: 1200,
  costPerAnswer: 0.1,
  lastRun: '2026-07-14T00:00:00.000Z',
};

beforeEach(() => {
  getMock.mockReset();
  getRedisMock.mockClear();
});

describe('getAskMetrics — absent or malformed Redis payload', () => {
  it('returns null when Redis has no value', async () => {
    getMock.mockResolvedValueOnce(null);
    await expect(getAskMetrics()).resolves.toBeNull();
  });

  it('returns null when getRedis().get rejects', async () => {
    getMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(getAskMetrics()).resolves.toBeNull();
  });

  it('returns null when the payload is not an object', async () => {
    getMock.mockResolvedValueOnce(42);
    await expect(getAskMetrics()).resolves.toBeNull();
  });

  it('returns null when the string payload is not valid JSON', async () => {
    getMock.mockResolvedValueOnce('not json');
    await expect(getAskMetrics()).resolves.toBeNull();
  });
});

describe('getAskMetrics — required-field guards', () => {
  const MISSING_FIELD_CASES: Array<[string, (a: typeof VALID_AGGREGATE) => unknown]> = [
    ['ts', (a) => ({ ...a, ts: undefined })],
    ['total', (a) => ({ ...a, total: undefined })],
    ['answeredCount', (a) => ({ ...a, answeredCount: undefined })],
    ['correctness', (a) => ({ ...a, correctness: undefined })],
    ['correctness.rate', (a) => ({ ...a, correctness: {} })],
    ['jailbreakResistance', (a) => ({ ...a, jailbreakResistance: undefined })],
    ['jailbreakResistance.rate', (a) => ({ ...a, jailbreakResistance: {} })],
    ['latencyMs', (a) => ({ ...a, latencyMs: undefined })],
    ['latencyMs.p95', (a) => ({ ...a, latencyMs: {} })],
    ['featureCostUsd', (a) => ({ ...a, featureCostUsd: undefined })],
  ];

  it.each(MISSING_FIELD_CASES)('returns null when %s is missing', async (_field, mutate) => {
    getMock.mockResolvedValueOnce(mutate(VALID_AGGREGATE));
    await expect(getAskMetrics()).resolves.toBeNull();
  });
});

describe('getAskMetrics — valid payload shapes', () => {
  it('parses an already-parsed object payload', async () => {
    getMock.mockResolvedValueOnce(VALID_AGGREGATE);
    await expect(getAskMetrics()).resolves.toEqual(VALID_METRICS);
  });

  it('parses a JSON string payload identically', async () => {
    getMock.mockResolvedValueOnce(JSON.stringify(VALID_AGGREGATE));
    await expect(getAskMetrics()).resolves.toEqual(VALID_METRICS);
  });
});

describe('getAskMetrics — costPerAnswer divisor', () => {
  it('divides featureCostUsd by answeredCount when answeredCount > 0', async () => {
    getMock.mockResolvedValueOnce({ ...VALID_AGGREGATE, answeredCount: 4, featureCostUsd: 2 });
    const result = await getAskMetrics();
    expect(result?.costPerAnswer).toBe(0.5);
  });

  it('returns featureCostUsd undivided when answeredCount is 0', async () => {
    getMock.mockResolvedValueOnce({ ...VALID_AGGREGATE, answeredCount: 0, featureCostUsd: 2 });
    const result = await getAskMetrics();
    expect(result?.costPerAnswer).toBe(2);
  });
});
