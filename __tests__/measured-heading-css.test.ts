import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';

describe('measured block headings', () => {
  const stylesheet = parse(readComponentsCss());

  it('draw the linked heading without an underline until it is hovered or focused', () => {
    // behavioral-test-allow: text decoration lives in the shipped stylesheet; jsdom has no layout engine
    const resting = rulesWithSelector(stylesheet, '.measured-heading a');
    expect(
      resting.map((rule) => declValue(rule, 'text-decoration')),
      'an underlined lime heading reads as a body link',
    ).toContain('none');
    for (const state of ['hover', 'focus-visible']) {
      const active = rulesWithSelector(stylesheet, `.measured-heading a:${state}`);
      expect(active.map((rule) => declValue(rule, 'text-decoration'))).toContain('underline');
    }
  });
});
