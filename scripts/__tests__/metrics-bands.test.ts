import { describe, expect, it } from 'vitest';
import bandsConfig from '../../metrics/bands.json';
import type { BandsConfig, MetricConfig } from '../metrics/bands.mjs';
import {
  applyWesternElectricRules,
  bandAnnotations,
  evaluateHistory,
  evaluateSeries,
  mean,
  rollingScores,
  sampleStd,
  tierAtLeast,
  validateBandsConfig,
} from '../metrics/bands.mjs';

const TIERS = { log: 1, diagnose: 2, propose: 3 };
const CONFIG: MetricConfig = {
  direction: 'higher-is-worse',
  window: 6,
  minHistory: 6,
  minStd: 0.01,
  tiers: TIERS,
};
const FLAT_BASELINE = [9, 11, 9, 11, 9, 11];
const BASELINE_STD = sampleStd(FLAT_BASELINE);

describe('mean and sampleStd', () => {
  it('computes the arithmetic mean', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it('uses the n-1 divisor so a short window is not understated', () => {
    expect(sampleStd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it('is zero for one point instead of dividing by zero', () => {
    expect(sampleStd([5])).toBe(0);
  });
});

describe('rollingScores', () => {
  it('scores a point against the window that precedes it, never against itself', () => {
    const scores = rollingScores([...FLAT_BASELINE, 14], CONFIG);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.mean).toBe(10);
    expect(scores[0]?.badness).toBeCloseTo((14 - 10) / BASELINE_STD, 6);
  });

  it('flips the sign for a lower-is-worse metric so a drop reads as bad', () => {
    const scores = rollingScores([...FLAT_BASELINE, 6], { ...CONFIG, direction: 'lower-is-worse' });
    expect(scores[0]?.badness).toBeCloseTo(4 / BASELINE_STD, 6);
  });

  it('floors the deviation at minStd so a flat history cannot score a tiny move as infinite', () => {
    const scores = rollingScores([0, 0, 0, 0, 0, 0, 0.1], { ...CONFIG, minStd: 0.05 });
    expect(scores[0]?.badness).toBeCloseTo(2, 6);
  });

  it('returns no scores until minHistory points exist before the first scored point', () => {
    expect(rollingScores([1, 2, 3, 4, 5, 6], CONFIG)).toEqual([]);
  });

  it('leaves a bad spike out of the baseline, so a second spike is scored against normal weeks', () => {
    const scores = rollingScores([...FLAT_BASELINE, 14, 14], CONFIG);
    expect(scores).toHaveLength(2);
    expect(scores[1]?.mean).toBe(10);
    expect(scores[1]?.z).toBeCloseTo(scores[0]?.z ?? Number.NaN, 6);
  });

  it('keeps a mildly bad point in the baseline: only diagnose and worse is left out', () => {
    const mild = 10 + 1.5 * BASELINE_STD;
    const scores = rollingScores([...FLAT_BASELINE, mild, 10], CONFIG);
    expect(scores[1]?.mean).toBeCloseTo(mean([...FLAT_BASELINE.slice(1), mild]), 6);
  });

  it('keeps a good-side outlier in the baseline, since only breaches are excluded', () => {
    const scores = rollingScores([...FLAT_BASELINE, 4, 10], CONFIG);
    expect(scores[1]?.mean).toBeCloseTo(mean([...FLAT_BASELINE.slice(1), 4]), 6);
  });

  it('uses only the last `window` points as the baseline', () => {
    const longRun = [100, 100, 100, ...FLAT_BASELINE, 14];
    const scores = rollingScores(longRun, CONFIG);
    expect(scores.at(-1)?.mean).toBe(10);
  });
});

describe('applyWesternElectricRules', () => {
  it('rule 1: a point beyond the propose sigma proposes', () => {
    const fired = applyWesternElectricRules([0.2, -0.4, 3.2], TIERS);
    expect(fired.map((r) => r.tier)).toContain('propose');
  });

  it('a point beyond the diagnose sigma diagnoses and one beyond the log sigma logs', () => {
    expect(applyWesternElectricRules([0, 2.4], TIERS).map((r) => r.tier)).toEqual(['diagnose']);
    expect(applyWesternElectricRules([0, 1.4], TIERS).map((r) => r.tier)).toEqual(['log']);
    expect(applyWesternElectricRules([0, 0.9], TIERS)).toEqual([]);
  });

  it('rule 2: two of the last three beyond the diagnose sigma, the latest among them', () => {
    const fired = applyWesternElectricRules([0, 0.5, 2.5, 2.4], TIERS);
    expect(fired.map((r) => r.id)).toContain('two-of-three-beyond-diagnose');
  });

  it('rule 2 stays quiet once the latest point is back inside the band', () => {
    expect(applyWesternElectricRules([0, 2.5, 2.4, 0.7], TIERS)).toEqual([]);
    expect(applyWesternElectricRules([0, 2.5, 2.4, 1.9], TIERS).map((r) => r.id)).toEqual([
      'beyond-log',
    ]);
    expect(applyWesternElectricRules([0, 2.5, 2.4, -0.2], TIERS)).toEqual([]);
  });

  it('rule 3: four of the last five beyond the log sigma, the latest among them', () => {
    const fired = applyWesternElectricRules([0.6, 1.2, 1.3, 1.4, 1.1], TIERS);
    expect(fired.map((r) => r.id)).toContain('four-of-five-beyond-log');
  });

  it('rule 3 stays quiet once the latest point is back inside the band', () => {
    expect(applyWesternElectricRules([1.2, 1.3, 1.4, 1.1, 0.6], TIERS)).toEqual([]);
  });

  it('rule 4: eight in a row on the bad side diagnose even though each is small', () => {
    const fired = applyWesternElectricRules([0.3, 0.4, 0.1, 0.5, 0.2, 0.6, 0.3, 0.4], TIERS);
    expect(fired.map((r) => r.id)).toEqual(['eight-on-bad-side']);
    expect(fired[0]?.tier).toBe('diagnose');
  });

  it('rule 4 needs all eight: one point on the good side resets the run', () => {
    const fired = applyWesternElectricRules([0.3, 0.4, 0.1, -0.5, 0.2, 0.6, 0.3, 0.4], TIERS);
    expect(fired).toEqual([]);
  });

  it('good-side excursions never fire a rule', () => {
    expect(applyWesternElectricRules([-0.5, -2.5, -3.5, -2.2], TIERS)).toEqual([]);
  });
});

describe('evaluateSeries', () => {
  it('reports insufficient history instead of guessing a band', () => {
    const result = evaluateSeries([1, 2, 3], CONFIG);
    expect(result.status).toBe('insufficient-history');
    expect(result.tier).toBe('none');
  });

  it('reports no data when the latest week has no value', () => {
    const result = evaluateSeries([...FLAT_BASELINE, null], CONFIG);
    expect(result.status).toBe('no-data');
  });

  it('skips weeks with no value rather than counting them as zero', () => {
    const result = evaluateSeries([9, null, 11, 9, 11, 9, null, 11, 14], CONFIG);
    expect(result.status).toBe('evaluated');
    expect(result.mean).toBe(10);
  });

  it('classifies a small move as none, 1 sigma as log, 2 as diagnose, 3 as propose', () => {
    const tierFor = (latest: number) => evaluateSeries([...FLAT_BASELINE, latest], CONFIG).tier;
    expect(tierFor(10.4)).toBe('none');
    expect(tierFor(10 + 1.3 * BASELINE_STD)).toBe('log');
    expect(tierFor(10 + 2.3 * BASELINE_STD)).toBe('diagnose');
    expect(tierFor(10 + 3.3 * BASELINE_STD)).toBe('propose');
  });

  it('keeps flagging a second spike instead of absorbing the first into the baseline', () => {
    const result = evaluateSeries([...FLAT_BASELINE, 14, 14], CONFIG);
    expect(result.tier).toBe('propose');
    expect(result.mean).toBe(10);
  });

  it('flags eight bad weeks in a row at the tier that opens an issue', () => {
    const drift = [...FLAT_BASELINE, ...Array.from({ length: 8 }, () => 10.3)];
    const result = evaluateSeries(drift, { ...CONFIG, window: 20 });
    expect(result.rules.map((r) => r.id)).toContain('eight-on-bad-side');
    expect(tierAtLeast(result.tier, 'diagnose')).toBe(true);
  });

  it('does not alarm on a value that improves on the baseline', () => {
    expect(evaluateSeries([...FLAT_BASELINE, 2], CONFIG).tier).toBe('none');
  });

  it('alarms on a drop when lower is worse', () => {
    const result = evaluateSeries([...FLAT_BASELINE, 4], {
      ...CONFIG,
      direction: 'lower-is-worse',
    });
    expect(result.tier).toBe('propose');
  });

  it('returns the evidence an issue needs: value, mean, std, z, the rules and the recent series', () => {
    const result = evaluateSeries([...FLAT_BASELINE, 14], CONFIG);
    expect(result).toMatchObject({ value: 14, mean: 10 });
    expect(result.std).toBeCloseTo(BASELINE_STD, 6);
    expect(result.z).toBeCloseTo(4 / BASELINE_STD, 6);
    expect(result.rules.length).toBeGreaterThan(0);
    expect(result.recent).toEqual([...FLAT_BASELINE, 14]);
  });

  it('is deterministic: the same series gives the same verdict', () => {
    const series = [...FLAT_BASELINE, 12.5];
    expect(evaluateSeries(series, CONFIG)).toEqual(evaluateSeries(series, CONFIG));
  });
});

describe('tierAtLeast', () => {
  it('orders none < log < diagnose < propose', () => {
    expect(tierAtLeast('diagnose', 'diagnose')).toBe(true);
    expect(tierAtLeast('propose', 'diagnose')).toBe(true);
    expect(tierAtLeast('log', 'diagnose')).toBe(false);
    expect(tierAtLeast('none', 'log')).toBe(false);
  });
});

describe('validateBandsConfig', () => {
  it('accepts the committed metrics/bands.json', () => {
    expect(() => validateBandsConfig(bandsConfig)).not.toThrow();
  });

  it('rejects a metric without a positive minStd', () => {
    const bad = { ...bandsConfig, metrics: { m: { direction: 'higher-is-worse', minStd: 0 } } };
    expect(() => validateBandsConfig(bad)).toThrow(/minStd/);
  });

  it('rejects an unknown direction', () => {
    const bad = { ...bandsConfig, metrics: { m: { direction: 'sideways', minStd: 1 } } };
    expect(() => validateBandsConfig(bad)).toThrow(/direction/);
  });

  it('rejects tiers that do not widen from log to propose', () => {
    const bad = {
      ...bandsConfig,
      defaults: { ...bandsConfig.defaults, tiers: { log: 3, diagnose: 2, propose: 1 } },
    };
    expect(() => validateBandsConfig(bad)).toThrow(/tiers/);
  });

  it('rejects an issueFromTier that is not a tier', () => {
    expect(() => validateBandsConfig({ ...bandsConfig, issueFromTier: 'panic' })).toThrow(
      /issueFromTier/,
    );
  });
});

describe('evaluateHistory', () => {
  const weeks = [...FLAT_BASELINE, 14].map((value, index) => ({
    weekStart: `2026-01-${String(index + 1).padStart(2, '0')}`,
    metrics: { spike: value, steady: 10 },
  }));
  const config: BandsConfig = {
    version: 1,
    issueFromTier: 'diagnose',
    defaults: { window: 6, minHistory: 6, tiers: TIERS },
    metrics: {
      spike: { direction: 'higher-is-worse', minStd: 0.01 },
      steady: { direction: 'higher-is-worse', minStd: 0.01 },
    },
  };

  it('evaluates each configured metric on its own series', () => {
    const report = evaluateHistory(weeks, config);
    expect(report.weekStart).toBe('2026-01-07');
    expect(report.evaluations.spike?.tier).toBe('propose');
    expect(report.evaluations.steady?.tier).toBe('none');
  });

  it('lists as breaches only the metrics at or above issueFromTier', () => {
    expect(evaluateHistory(weeks, config).breaches).toEqual(['spike']);
    const loose = evaluateHistory(weeks, { ...config, issueFromTier: 'propose' });
    expect(loose.breaches).toEqual(['spike']);
    const mild = [
      ...weeks.slice(0, 6),
      { weekStart: '2026-01-07', metrics: { spike: 10.4, steady: 10 } },
    ];
    expect(evaluateHistory(mild, config).breaches).toEqual([]);
  });

  it('ignores a metric the history does not carry yet', () => {
    const report = evaluateHistory(weeks, {
      ...config,
      metrics: { ...config.metrics, brandNew: { direction: 'higher-is-worse', minStd: 1 } },
    });
    expect(report.evaluations.brandNew?.status).toBe('no-data');
  });
});

describe('bandAnnotations', () => {
  const report = (evaluations: Record<string, { status: string }>) =>
    ({ weekStart: '2026-11-02', evaluations, breaches: [] }) as unknown as Parameters<
      typeof bandAnnotations
    >[0];

  it('warns, naming the metric and week, when the latest week has no value', () => {
    const notes = bandAnnotations(report({ leadTimeHoursMedian: { status: 'no-data' } }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^::warning::/);
    expect(notes[0]).toContain('leadTimeHoursMedian');
    expect(notes[0]).toContain('2026-11-02');
  });

  it('only notes, without warning, a metric that is still building its first history', () => {
    const notes = bandAnnotations(
      report({ ciMainFailureRate: { status: 'insufficient-history' } }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^::notice::/);
  });

  it('says nothing about a metric that was evaluated', () => {
    expect(bandAnnotations(report({ ciMainFailureRate: { status: 'evaluated' } }))).toEqual([]);
  });
});
