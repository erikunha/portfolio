import { describe, expect, it } from 'vitest';
import { longestCopy } from '../longest-copy';

describe('longestCopy', () => {
  it('returns the longest string and the first of equals', () => {
    expect(longestCopy(['a', 'abc', 'xyz', 'ab'])).toBe('abc');
  });

  it('returns an empty string for no copy', () => {
    expect(longestCopy([])).toBe('');
  });
});
