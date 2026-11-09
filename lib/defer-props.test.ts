import { describe, expect, it } from 'vitest';
import { deferProps } from './defer-props';

describe('deferProps', () => {
  it('adds the deferred class and the content-visibility marker when deferred', () => {
    expect(deferProps(true, 'career-section')).toEqual({
      className: 'career-section module-deferred',
      'data-cv-defer': 'true',
    });
  });

  it('keeps only the base class and no marker when not deferred', () => {
    expect(deferProps(false, 'career-section')).toEqual({ className: 'career-section' });
    expect(deferProps(undefined, 'career-section')).toEqual({ className: 'career-section' });
  });

  it('works without a base class', () => {
    expect(deferProps(true)).toEqual({ className: 'module-deferred', 'data-cv-defer': 'true' });
    expect(deferProps(false)).toEqual({ className: undefined });
  });
});
