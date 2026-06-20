import { describe, expect, it } from 'vitest';
import { sign } from '@/lib/__mutation-fixture__';

describe('sign (strengthened — asserts all three branches)', () => {
  it('returns 1 for positive input', () => {
    expect(sign(5)).toBe(1);
  });

  it('returns -1 for negative input', () => {
    expect(sign(-5)).toBe(-1);
  });

  it('returns 0 for zero', () => {
    expect(sign(0)).toBe(0);
  });
});
