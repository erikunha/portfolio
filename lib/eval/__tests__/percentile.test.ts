import { describe, expect, it } from 'vitest';
import { percentile } from '@/lib/eval/percentile';

describe('lib/eval/percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  it('returns the single element for a one-element array', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it('returns the exact observed sample at the nearest rank (not interpolated)', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile(sorted, 90)).toBe(90);
  });
});
