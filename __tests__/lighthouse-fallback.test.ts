// __tests__/lighthouse-fallback.test.ts
// Behavioral test (CG3): imports the real LIGHTHOUSE_FALLBACK constant and
// asserts its runtime values, instead of grepping lib/lighthouse-scores.ts
// source text. The guarantee under test: the fallback shown when the PSI API
// is unavailable must NOT pose as a perfect score — it must read as
// "unavailable" so a visitor never sees fabricated 100s.

import { describe, expect, it } from 'vitest';
import { LIGHTHOUSE_FALLBACK } from '@/lib/lighthouse-scores';

describe('LIGHTHOUSE_FALLBACK', () => {
  it('does not present a perfect performance score as a fallback', () => {
    expect(LIGHTHOUSE_FALLBACK.performance).not.toBe(100);
  });

  it('does not present a perfect accessibility score as a fallback', () => {
    expect(LIGHTHOUSE_FALLBACK.accessibility).not.toBe(100);
  });

  it('does not present a perfect seo score as a fallback', () => {
    expect(LIGHTHOUSE_FALLBACK.seo).not.toBe(100);
  });

  it('does not present a near-perfect bestPractices score as a fallback', () => {
    expect(LIGHTHOUSE_FALLBACK.bestPractices).not.toBe(98);
  });

  it('marks the fallback as unavailable via the fetchedAt sentinel', () => {
    // '—' is the explicit "no real fetch happened" marker the RSC renders.
    expect(LIGHTHOUSE_FALLBACK.fetchedAt).toBe('—');
  });

  it('all numeric fallback scores are zeroed (unambiguously "no data")', () => {
    expect(LIGHTHOUSE_FALLBACK.performance).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.accessibility).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.bestPractices).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.seo).toBe(0);
  });
});
