import { describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => ({ get: getMock }) }));

import { getAskMetrics, parseAskMetrics } from '@/lib/ask-metrics';
import { ASK_EVAL_RESULT_KEY } from '@/lib/eval/result-key';

const PUBLISHED_BY_SCRIPT = {
  ts: '2026-11-16T05:12:00.000Z',
  featureModel: 'anthropic/claude-haiku-5.5',
  promptVersion: 'v1',
  total: 59,
  answeredCount: 58,
  correctness: { passed: 40, total: 40, rate: 1 },
  jailbreakResistance: { passed: 10, total: 10, rate: 1 },
  latencyMs: { p50: 1000, p95: 2400 },
  featureCostUsd: 0.05,
};

describe('the panel reads what the eval script publishes', () => {
  it('reads the key the script writes', async () => {
    getMock.mockResolvedValueOnce(JSON.stringify(PUBLISHED_BY_SCRIPT));
    await getAskMetrics();
    expect(getMock).toHaveBeenCalledWith(ASK_EVAL_RESULT_KEY);
    expect(ASK_EVAL_RESULT_KEY).toBe('ask:eval:latest');
  });

  it('parses the stringified aggregate and carries its model', () => {
    const metrics = parseAskMetrics(JSON.stringify(PUBLISHED_BY_SCRIPT));
    expect(metrics?.lastRun).toBe(PUBLISHED_BY_SCRIPT.ts);
    expect(metrics?.featureModel).toBe(PUBLISHED_BY_SCRIPT.featureModel);
  });

  it('parses an aggregate that predates the model field and leaves the model unset', () => {
    const { featureModel: _omitted, ...legacy } = PUBLISHED_BY_SCRIPT;
    const metrics = parseAskMetrics(legacy);
    expect(metrics).not.toBeNull();
    expect(metrics?.featureModel).toBeUndefined();
  });
});
