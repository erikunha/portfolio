import { describe, expect, it } from 'vitest';
import { aggregateCase } from '@/lib/eval/montecarlo';

describe('lib/eval/montecarlo aggregateCase', () => {
  it('computes pass@k, pass^k, mean, variance, stddev for a mixed run', () => {
    const s = aggregateCase('mixed', [true, true, true, false, true]);
    expect(s.id).toBe('mixed');
    expect(s.runs).toBe(5);
    expect(s.passes).toBe(4);
    expect(s.passAtK).toBe(1.0);
    expect(s.passHatK).toBe(0.0);
    expect(s.mean).toBeCloseTo(0.8, 10);
    expect(s.variance).toBeCloseTo(0.16, 10);
    expect(s.stddev).toBeCloseTo(Math.sqrt(0.16), 10);
  });

  it('an all-true case has variance 0 and passHatK 1', () => {
    const s = aggregateCase('all-true', [true, true, true]);
    expect(s.passes).toBe(3);
    expect(s.passAtK).toBe(1.0);
    expect(s.passHatK).toBe(1.0);
    expect(s.mean).toBe(1.0);
    expect(s.variance).toBe(0);
    expect(s.stddev).toBe(0);
  });

  it('an all-false case has passAtK 0 and variance 0', () => {
    const s = aggregateCase('all-false', [false, false]);
    expect(s.passes).toBe(0);
    expect(s.passAtK).toBe(0.0);
    expect(s.passHatK).toBe(0.0);
    expect(s.mean).toBe(0);
    expect(s.variance).toBe(0);
    expect(s.stddev).toBe(0);
  });

  it('handles an empty run-result array without dividing by zero', () => {
    const s = aggregateCase('empty', []);
    expect(s.runs).toBe(0);
    expect(s.passes).toBe(0);
    expect(s.passAtK).toBe(0);
    expect(s.passHatK).toBe(0);
    expect(s.mean).toBe(0);
    expect(s.variance).toBe(0);
    expect(s.stddev).toBe(0);
  });
});
