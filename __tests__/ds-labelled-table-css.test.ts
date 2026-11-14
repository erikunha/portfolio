import { parse, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue } from '@/__tests__/helpers/css-rules';

const stylesheet = parse(readComponentsCss());
const CELL = '.ds-prose table[data-labelled-table] td';
const PHONE = /max-width:\s*767\.98px/;
const BELOW_NARROW = /max-width:\s*359\.98px/;

function cellRule(media: RegExp): Rule | undefined {
  let found: Rule | undefined;
  stylesheet.walkAtRules('media', (atRule) => {
    if (!media.test(atRule.params)) return;
    atRule.walkRules((rule) => {
      if (rule.selector.trim() === CELL) found = rule;
    });
  });
  return found;
}

describe('the labelled table on a phone', () => {
  it('lets the label column grow to its longest word instead of breaking it', () => {
    expect(declValue(cellRule(PHONE), 'grid-template-columns')).toMatch(/^minmax\(min-content,/);
  });

  it('stacks the value under the label below 360px, where a golden split leaves too little width', () => {
    expect(declValue(cellRule(BELOW_NARROW), 'grid-template-columns')).toBe('minmax(0, 1fr)');
  });
});
