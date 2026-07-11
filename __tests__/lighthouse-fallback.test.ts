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
    expect(LIGHTHOUSE_FALLBACK.fetchedAt).toBe('—');
  });

  it('all numeric fallback scores are zeroed (unambiguously "no data")', () => {
    expect(LIGHTHOUSE_FALLBACK.performance).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.accessibility).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.bestPractices).toBe(0);
    expect(LIGHTHOUSE_FALLBACK.seo).toBe(0);
  });
});
