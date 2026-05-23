import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy class strings', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });
  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
  it('returns empty string for all-falsy input', () => {
    expect(cx(false, null, undefined)).toBe('');
  });
  it('handles single value', () => {
    expect(cx('only')).toBe('only');
  });
});
