import { describe, expect, it } from 'vitest';
import { ASCII_BAR, asciiBar } from './ascii-bar';

describe('asciiBar', () => {
  it('fills the share of cells the fraction covers', () => {
    expect(asciiBar(0.5, 10)).toBe('#####.....');
  });

  it('clamps fractions outside 0 to 1, so a late or early tick never breaks the width', () => {
    expect(asciiBar(-1, 4)).toBe('....');
    expect(asciiBar(2, 4)).toBe('####');
  });

  it('keeps the default width so tiles do not move as it fills', () => {
    expect(asciiBar(0.42)).toHaveLength(ASCII_BAR.cells);
  });
});
