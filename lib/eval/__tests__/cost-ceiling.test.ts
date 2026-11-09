import { describe, expect, it } from 'vitest';
import { assertWithinBudget, createSpendMeter, MAX_JOB_COST_USD } from '@/lib/eval/budget';

describe('lib/eval/budget assertWithinBudget', () => {
  it('pins MAX_JOB_COST_USD at 2.0', () => {
    expect(MAX_JOB_COST_USD).toBe(2.0);
  });

  it('allows a projection under the cap', () => {
    const r = assertWithinBudget({ projectedUsd: 0.9, doubled: false });
    expect(r.ok).toBe(true);
  });

  it('allows a projection exactly at the cap (boundary inclusive)', () => {
    const r = assertWithinBudget({ projectedUsd: MAX_JOB_COST_USD, doubled: false });
    expect(r.ok).toBe(true);
  });

  it('rejects a projection over the cap and names projection + cap in the reason', () => {
    const r = assertWithinBudget({ projectedUsd: 2.5, doubled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('2.5');
      expect(r.reason).toContain('2');
    }
  });

  it('A/B mode (doubled) raises the effective cap to 2 × MAX_JOB_COST_USD', () => {
    const single = assertWithinBudget({ projectedUsd: 3.5, doubled: false });
    expect(single.ok).toBe(false);
    const doubled = assertWithinBudget({ projectedUsd: 3.5, doubled: true });
    expect(doubled.ok).toBe(true);
  });

  it('A/B mode still rejects a projection over the doubled cap', () => {
    const r = assertWithinBudget({ projectedUsd: 4.5, doubled: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('4');
    }
  });
});

describe('lib/eval/budget createSpendMeter', () => {
  it('prices the mechanical tier at the feature rate and the judgment tier at the judge rate', () => {
    const meter = createSpendMeter(MAX_JOB_COST_USD);
    meter.addTarget('mechanical', { inputTokens: 1_000_000, outputTokens: 0 });
    expect(meter.spentUsd).toBeCloseTo(1, 10);
    meter.addTarget('judgment', { inputTokens: 1_000_000, outputTokens: 0 });
    expect(meter.spentUsd).toBeCloseTo(4, 10);
  });

  it('prices judge calls at the judge rate', () => {
    const meter = createSpendMeter(MAX_JOB_COST_USD);
    meter.addJudge({ inputTokens: 0, outputTokens: 1_000_000 });
    expect(meter.spentUsd).toBeCloseTo(15, 10);
  });

  it('is exceeded only once real spend passes the cap', () => {
    const meter = createSpendMeter(1);
    meter.addJudge({ inputTokens: 300_000, outputTokens: 0 });
    expect(meter.exceeded()).toBe(false);
    meter.addJudge({ inputTokens: 100_000, outputTokens: 0 });
    expect(meter.exceeded()).toBe(true);
  });
});
