// lib/eval/__tests__/ab.test.ts
// Unit test for the A/B success-rate delta (lib/eval/ab.ts, C-c.1). abDelta()
// folds two arms of per-case Monte-Carlo stats (control + treatment) into a
// single success-rate delta (treatment - control), a pooled spread, and a
// `degraded` flag that fires only when the treatment is meaningfully WORSE than
// control beyond a noise threshold. This is the math the --ab runner reports.

import { describe, expect, it } from 'vitest';
import { abDelta } from '@/lib/eval/ab';
import type { CaseStats } from '@/lib/eval/montecarlo';

// Build a CaseStats whose `mean` (and the population variance derived from it)
// drive the A/B delta. runs/passes/passAtK/passHatK are not read by abDelta but
// kept consistent so the fixtures read as real Monte-Carlo output.
function stat(id: string, mean: number): CaseStats {
  const variance = mean * (1 - mean);
  return {
    id,
    runs: 5,
    passes: Math.round(mean * 5),
    passAtK: mean > 0 ? 1 : 0,
    passHatK: mean === 1 ? 1 : 0,
    mean,
    variance,
    stddev: Math.sqrt(variance),
  };
}

describe('lib/eval/ab abDelta', () => {
  it('identical control and treatment → zero delta, not degraded', () => {
    const control = [stat('a', 0.8), stat('b', 0.6)];
    const treatment = [stat('a', 0.8), stat('b', 0.6)];
    const r = abDelta(control, treatment);
    expect(r.controlMean).toBeCloseTo(0.7, 10);
    expect(r.treatmentMean).toBeCloseTo(0.7, 10);
    expect(r.deltaMean).toBeCloseTo(0, 10);
    expect(r.degraded).toBe(false);
  });

  it('a treatment 0.3 below control → negative delta of the right magnitude, degraded', () => {
    const control = [stat('a', 1.0), stat('b', 1.0)];
    const treatment = [stat('a', 0.7), stat('b', 0.7)];
    const r = abDelta(control, treatment);
    expect(r.controlMean).toBeCloseTo(1.0, 10);
    expect(r.treatmentMean).toBeCloseTo(0.7, 10);
    expect(r.deltaMean).toBeCloseTo(-0.3, 10);
    expect(r.deltaMean).toBeLessThan(0);
    expect(r.degraded).toBe(true);
  });

  it('reports a pooled stddev (non-negative, zero when both arms are deterministic)', () => {
    // Both arms all-pass / all-fail → population variance 0 on every case → pooled stddev 0.
    const deterministic = abDelta([stat('a', 1.0)], [stat('a', 1.0)]);
    expect(deterministic.deltaStddev).toBe(0);

    // A flaky arm (mean 0.5 → max variance) yields a positive pooled spread.
    const flaky = abDelta([stat('a', 0.5)], [stat('a', 0.5)]);
    expect(flaky.deltaStddev).toBeGreaterThan(0);
  });

  it('a treatment ABOVE control is an improvement, never degraded', () => {
    const control = [stat('a', 0.5)];
    const treatment = [stat('a', 0.9)];
    const r = abDelta(control, treatment);
    expect(r.deltaMean).toBeGreaterThan(0);
    expect(r.degraded).toBe(false);
  });

  it('a tiny drop within the noise threshold is not flagged degraded', () => {
    // A 0.01 drop is below the noise threshold → measured, but not called degraded.
    const control = [stat('a', 0.8)];
    const treatment = [stat('a', 0.79)];
    const r = abDelta(control, treatment);
    expect(r.deltaMean).toBeLessThan(0);
    expect(r.degraded).toBe(false);
  });

  it('empty arms → all-zero result, not degraded (no signal)', () => {
    const r = abDelta([], []);
    expect(r.controlMean).toBe(0);
    expect(r.treatmentMean).toBe(0);
    expect(r.deltaMean).toBe(0);
    expect(r.deltaStddev).toBe(0);
    expect(r.degraded).toBe(false);
  });
});
