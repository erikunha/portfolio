import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';

const stylesheet = parse(readComponentsCss());
const TOUCH_TARGET = 'var(--spacing-target)';
const PHONE = /max-width: 767\.98px/;
const TWO_COLUMNS = /min-width: 1024px/;
const CLOCKS_ONE_ROW = /min-width: 900px/;

describe('contact layout stylesheet', () => {
  it('splits the row into a form column slightly wider than the panel column at 1024', () => {
    const [rule] = rulesInMedia(stylesheet, TWO_COLUMNS, '.contact-layout');

    const tracks = declValue(rule, 'grid-template-columns') ?? '';
    const [form = 0, panel = 0, ...rest] = [...tracks.matchAll(/(\d+)fr/g)].map((match) =>
      Number(match[1]),
    );

    expect(rest).toHaveLength(0);
    expect(form, 'the form and channels column is the wider one').toBeGreaterThan(panel);
    expect(form / panel, 'but only slightly: about 815 to 750').toBeLessThan(1.25);
  });

  it('makes the channel links and the copy button touch targets on phones', () => {
    for (const selector of ['.contact-channels-body a', '.contact-copy-btn']) {
      const rules = rulesInMedia(stylesheet, PHONE, selector);
      expect(rules, `${selector} needs one phone rule`).toHaveLength(1);
      expect(declValue(rules[0], 'min-height')).toBe(TOUCH_TARGET);
    }
  });

  it('lays each fact out as a label column and a value column so labels never wrap away', () => {
    const [rule] = rulesWithSelector(stylesheet, '.ctz-fact');

    expect(declValue(rule, 'display')).toBe('grid');
    expect(declValue(rule, 'grid-template-columns')).toBe('6ch minmax(0, 1fr)');
  });

  it('keeps the two clocks on one row from 900px up', () => {
    const [rule] = rulesInMedia(stylesheet, CLOCKS_ONE_ROW, '.ctz-clocks');

    expect(declValue(rule, 'flex-wrap')).toBe('nowrap');
  });
});
