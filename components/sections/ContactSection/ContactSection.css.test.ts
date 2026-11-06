import { parse, type Root } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { SITE_LOCALE } from '@/content/site-locale';

const stylesheet = parse(readComponentsCss());
const TOUCH_TARGET = 'var(--spacing-target)';
const PHONE = /max-width: 767\.98px/;
const BELOW_CLOCKS_ROW = /max-width: 899\.98px/;
const TWO_COLUMNS = /min-width: 1024px/;
const CLOCKS_ONE_ROW = /min-width: 900px/;
const GOLDEN_RATIO = 1.618;
const GOLDEN_TOLERANCE = 0.001;
const FLEX_COLUMN = 'column';
const PHI_SPACING = /^var\(--phi-space-\d\)$/;

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

  it('sizes one shared label column to the longest label in any language', () => {
    const inLayer = (selector: string) =>
      rulesWithSelector(stylesheet, selector).find(
        (candidate) => candidate.parent?.type === 'atrule' && candidate.parent.name === 'layer',
      );
    const list = inLayer('.contact-facts');
    const row = inLayer('.contact-fact');

    expect(declValue(list, 'grid-template-columns')).toBe(
      'minmax(6ch, max-content) minmax(0, 1fr)',
    );
    expect(declValue(row, 'display')).toBe('grid');
    expect(declValue(row, 'grid-template-columns')).toBe('subgrid');
    expect(declValue(row, 'grid-column')).toBe('1 / -1');
  });

  it('keeps the two clocks on one row from 900px up', () => {
    const [rule] = rulesInMedia(stylesheet, CLOCKS_ONE_ROW, '.ctz-clocks');

    expect(declValue(rule, 'flex-wrap')).toBe('nowrap');
  });

  it('hides the loading label when the panel failed to load or scripting is off', () => {
    const [failed] = rulesWithSelector(stylesheet, '.ctz-failed .ctz-loading');
    const [scriptless] = rulesInMedia(stylesheet, /scripting:\s*none/, '.ctz-loading');

    expect(declValue(failed, 'display')).toBe('none');
    expect(declValue(scriptless, 'display')).toBe('none');
  });

  it('reserves a minimum height for the panel host at every width band, per locale', () => {
    const [host] = rulesWithSelector(stylesheet, '.ctz-host');
    const WIDTH_BANDS = 9;

    expect(declValue(host, 'min-height')).toBe('var(--ctz-host-min, 0)');
    for (const locale of Object.values(SITE_LOCALE)) {
      const tokens = rulesWithSelector(stylesheet, `.contact-timezone[data-locale="${locale}"]`);
      expect(tokens, `${locale} needs a token for each width band`).toHaveLength(WIDTH_BANDS);
      for (const token of tokens) {
        expect(declValue(token, '--ctz-host-min'), locale).toMatch(/^\d+(\.\d+)?rem$/);
      }
    }
  });
});
