import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue } from '@/__tests__/helpers/css-rules';

const stylesheet = parse(readComponentsCss());
const NARROW_CONTAINER = /^\(max-width:\s*22rem\)$/;
const START = 'start';

function narrowRule(selector: string) {
  let found: ReturnType<typeof parse>['nodes'][number] | undefined;
  stylesheet.walkAtRules('container', (atRule) => {
    if (!NARROW_CONTAINER.test(atRule.params.trim())) return;
    atRule.walkRules((rule) => {
      if (rule.selector.split(',').some((part) => part.trim() === selector)) found = rule;
    });
  });
  return found as import('postcss').Rule | undefined;
}

describe('links rows in a narrow column', () => {
  it('lay the row out as a grid with the host under the label', () => {
    expect(declValue(narrowRule('.links-line'), 'display')).toBe('grid');
    expect(declValue(narrowRule('.links-line-host'), 'grid-row')).toBe('2');
    expect(declValue(narrowRule('.links-line-host'), 'grid-column')).toBe('2');
  });

  it('left-align the host instead of right-aligning a wrapped URL', () => {
    expect(declValue(narrowRule('.links-line-host'), 'text-align')).toBe(START);
  });
});
