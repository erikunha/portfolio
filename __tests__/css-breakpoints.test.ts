import { describe, expect, it } from 'vitest';
import { readBaseCss, readComponentsCss } from './helpers/components-css';

// behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate media-query resolution
const css = `${readBaseCss()}\n${readComponentsCss()}`;
const mediaPreludes = Array.from(css.matchAll(/@media([^{]*)\{/g), (match) => match[1] ?? '');

function widths(feature: 'min' | 'max'): number[] {
  const pattern = new RegExp(`${feature}-width:\\s*(\\d+(?:\\.\\d+)?)px`, 'g');
  return mediaPreludes.flatMap((prelude) =>
    Array.from(prelude.matchAll(pattern), (match) => Number(match[1])),
  );
}

describe('media query breakpoints', () => {
  it('closes every max-width query just below the next min-width step, so no width matches both or neither', () => {
    const minWidths = new Set(widths('min'));
    const overlapping = widths('max').filter(
      (max) => Number.isInteger(max) && (minWidths.has(max) || minWidths.has(max + 1)),
    );
    expect(
      overlapping,
      'A max-width query must end at <step>-0.02px (for example 767.98px) when a min-width query ' +
        'starts at <step>px. 767px leaves fractional widths (zoom, device pixel ratio) matching ' +
        'neither rule set, and 768px makes exactly 768 match both.',
    ).toEqual([]);
  });
});
