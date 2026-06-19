// lib/eval/__tests__/percentile.test.ts
// Unit test for the nearest-rank percentile helper (lib/eval/percentile.ts),
// extracted verbatim from scripts/ask-eval.ts. Asserts the DOCUMENTED
// nearest-rank (NOT interpolated) behavior: the result is always an actual
// observed sample.

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
    // 10 sorted samples 10..100. Nearest-rank index = ceil((p/100)*n) - 1.
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    // p50: ceil(0.5*10)-1 = 4 → sorted[4] = 50
    expect(percentile(sorted, 50)).toBe(50);
    // p95: ceil(0.95*10)-1 = 9 → sorted[9] = 100
    expect(percentile(sorted, 95)).toBe(100);
    // p90: ceil(0.9*10)-1 = 8 → sorted[8] = 90 (a real sample, never 85)
    expect(percentile(sorted, 90)).toBe(90);
  });
});
