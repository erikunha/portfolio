import type { AtRule, Container, Document, Root, Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { compiledSiteStylesheet, declValue, rulesWithResolvedSelector } from './helpers/css-rules';

const FORCED_COLORS = /forced-colors/;
const PRIMARY = '.btn[data-variant="primary"]';
const FAMILIES = ['.contact-send', '.contact-channel-cta', '.ctz-propose'];
const STATE_BORDER_PROPERTIES = ['border-style', 'border-width', 'font-weight'] as const;

function forcedRules(root: Root, selector: string): Rule[] {
  return rulesWithResolvedSelector(root, selector).filter((rule) => {
    let node: Container | Document | undefined = rule.parent;
    while (node) {
      if (node.type === 'atrule' && FORCED_COLORS.test((node as AtRule).params)) return true;
      node = node.parent;
    }
    return false;
  });
}

describe('forced colors primary buttons', () => {
  it('draws the double state border once, on the primary variant', async () => {
    const root = await compiledSiteStylesheet();
    const [rule] = forcedRules(root, PRIMARY);
    expect(declValue(rule, 'border-style')).toBe('double');
    expect(declValue(rule, 'border-width')).toBe('var(--forced-state-width)');
    expect(declValue(rule, 'font-weight')).toBe('700');
  });

  it.each(FAMILIES)(
    '%s has no forced-colors rule that repeats the primary border',
    async (family) => {
      const root = await compiledSiteStylesheet();
      const repeated = forcedRules(root, family).filter((rule) =>
        STATE_BORDER_PROPERTIES.some((property) => declValue(rule, property) !== undefined),
      );
      expect(repeated).toEqual([]);
    },
  );
});
