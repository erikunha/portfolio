import { describe, expect, it } from 'vitest';
import { sign } from '@/lib/__mutation-fixture__';

describe('sign (weak — does NOT assert the branch values)', () => {
  it('returns a number for some input', () => {
    // Weak on purpose: only exercises one branch and never asserts the
    // actual returned value, so Stryker mutations of the conditionals and
    // the returned literals SURVIVE because nothing pins the behavior.
    expect(typeof sign(5)).toBe('number');
  });
});
