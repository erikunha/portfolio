import { parse, type Root } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';

const stylesheet = parse(readComponentsCss());
const TOUCH_TARGET = 'var(--spacing-target)';
const PHONE = /max-width: 767\.98px/;
const BELOW_CLOCKS_ROW = /max-width: 899\.98px/;
const TWO_COLUMNS = /min-width: 1024px/;
const CLOCKS_ONE_ROW = /min-width: 900px/;
const GOLDEN_RATIO = 1.618;
const GOLDEN_TOLERANCE = 0.001;
const FLEX_COLUMN = 'column';
const PHI_SPACING = /^var\(--space-phi-\d\)$/;

function containerRules(root: Root, params: RegExp, selector: string) {
  const found: Array<ReturnType<typeof rulesWithSelector>[number]> = [];
  root.walkAtRules('container', (atRule) => {
    if (!params.test(atRule.params)) return;
    atRule.each((node) => {
      if (node.type === 'rule' && node.selector.split(',').some((s) => s.trim() === selector)) {
        found.push(node);
      }
    });
  });
  return found;
}

describe('contact layout stylesheet', () => {
  it('splits the row at the golden ratio, form column first, from 1024px', () => {
    const [rule] = rulesInMedia(stylesheet, TWO_COLUMNS, '.contact-layout');

    const tracks = declValue(rule, 'grid-template-columns') ?? '';
    const [form = 0, panel = 0, ...rest] = [...tracks.matchAll(/(\d+(?:\.\d+)?)fr/g)].map((match) =>
      Number(match[1]),
    );

    expect(rest).toHaveLength(0);
    expect(Math.abs(form / panel - GOLDEN_RATIO)).toBeLessThan(GOLDEN_TOLERANCE);
  });

  it('spaces the contact blocks on the phi scale, never with a raw length', () => {
    for (const selector of ['.contact-layout', '.contact-main', '.contact-reach']) {
      const [rule] = rulesWithSelector(stylesheet, selector);
      expect(declValue(rule, 'gap'), `${selector} gap`).toMatch(PHI_SPACING);
    }
  });

  it('makes the channel links and the copy button touch targets on phones', () => {
    for (const selector of ['.contact-channels-body a', '.contact-copy-btn']) {
      const rules = rulesInMedia(stylesheet, PHONE, selector);
      expect(rules, `${selector} needs one phone rule`).toHaveLength(1);
      expect(declValue(rules[0], 'min-height')).toBe(TOUCH_TARGET);
    }
  });

  it('stacks every channel row, fact row, slot and confirmation into a column on phones', () => {
    for (const selector of ['.contact-channel-row', '.contact-channels-body dd', '.ctz-slot']) {
      const rules = rulesInMedia(stylesheet, PHONE, selector);
      expect(rules, `${selector} needs one phone rule`).toHaveLength(1);
      expect(declValue(rules[0], 'flex-direction'), `${selector} direction`).toBe(FLEX_COLUMN);
    }
    const [confirmation] = rulesInMedia(stylesheet, PHONE, '.ctz-proposed-row');
    expect(declValue(confirmation, 'flex-direction')).toBe(FLEX_COLUMN);
    const [facts] = rulesInMedia(stylesheet, PHONE, '.contact-fact');
    expect(declValue(facts, 'grid-template-columns')).toBe('minmax(0, 1fr)');
  });

  it('writes every phone override after its base rule, so the cascade lets it win', () => {
    for (const selector of [
      '.contact-channel-row',
      '.contact-channels-body dd',
      '.ctz-slot',
      '.ctz-proposed-row',
      '.contact-fact',
    ]) {
      const base = rulesWithSelector(stylesheet, selector).find(
        (candidate) => candidate.parent?.type === 'atrule' && candidate.parent.name === 'layer',
      );
      const [phone] = rulesInMedia(stylesheet, PHONE, selector);
      expect(
        phone?.source?.start?.offset,
        `${selector} phone rule is written after its base rule`,
      ).toBeGreaterThan(base?.source?.start?.offset ?? Number.POSITIVE_INFINITY);
    }
  });

  it('stacks the clocks and the map labels into a column below the side by side widths', () => {
    const [clocks] = rulesInMedia(stylesheet, BELOW_CLOCKS_ROW, '.ctz-clocks');
    expect(declValue(clocks, 'flex-direction')).toBe(FLEX_COLUMN);
    expect(declValue(clocks, 'align-items')).toBe('center');

    const [labels] = containerRules(stylesheet, /max-width: 24rem/, '.ctz-labels');
    expect(declValue(labels, 'flex-direction')).toBe(FLEX_COLUMN);
  });

  it('lays each fact out as a label column and a value column so labels never wrap away', () => {
    const rule = rulesWithSelector(stylesheet, '.contact-fact').find(
      (candidate) => candidate.parent?.type === 'atrule' && candidate.parent.name === 'layer',
    );

    expect(declValue(rule, 'display')).toBe('grid');
    expect(declValue(rule, 'grid-template-columns')).toBe('6ch minmax(0, 1fr)');
  });

  it('keeps the two clocks on one row from 900px up', () => {
    const [rule] = rulesInMedia(stylesheet, CLOCKS_ONE_ROW, '.ctz-clocks');

    expect(declValue(rule, 'flex-wrap')).toBe('nowrap');
  });
});
