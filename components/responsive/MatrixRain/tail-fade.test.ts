import { describe, expect, it } from 'vitest';
import { scaleTailFade } from './tail-fade';

describe('scaleTailFade', () => {
  it('returns the colour untouched at the base rate', () => {
    expect(scaleTailFade('rgba(0,0,0,0.10)', 1)).toBe('rgba(0,0,0,0.10)');
  });

  it('compounds the per-tick alpha over the skipped ticks', () => {
    expect(scaleTailFade('rgba(0,0,0,0.10)', 2)).toBe('rgba(0,0,0,0.19)');
    expect(scaleTailFade('rgba(0, 0, 0, 0.1)', 4)).toBe('rgba(0, 0, 0, 0.344)');
  });

  it('keeps the colour channels and handles hsla', () => {
    expect(scaleTailFade('hsla(120, 100%, 10%, 0.2)', 2)).toBe('hsla(120, 100%, 10%, 0.36)');
  });

  it('leaves a colour without a readable alpha alone', () => {
    expect(scaleTailFade('#000', 4)).toBe('#000');
    expect(scaleTailFade('rgb(0,0,0)', 4)).toBe('rgb(0,0,0)');
  });
});
