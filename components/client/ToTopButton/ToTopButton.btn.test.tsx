import { render, screen } from '@testing-library/react';
import type { AtRule, Container, Document, Root, Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { SectionNavigationProvider } from '../../responsive/SectionNavigation';
import { ToTopButton } from './ToTopButton';

const FAMILY = '.btn.to-top-btn';
const VARIANT_FAMILY = `${FAMILY}[data-variant="secondary"]`;
const OWNED_BY_BASE_AND_VARIANT = [
  'align-items',
  'border',
  'border-style',
  'border-width',
  'color',
  'cursor',
  'font-family',
  'font-size',
  'justify-content',
  'min-height',
  'min-width',
] as const;

const PRINT = /print/;

function screenRules(root: Root, selector: string): Rule[] {
  return rulesWithResolvedSelector(root, selector).filter((rule) => {
    let node: Container | Document | undefined = rule.parent;
    while (node) {
      if (node.type === 'atrule' && PRINT.test((node as AtRule).params)) return false;
      node = node.parent;
    }
    return true;
  });
}

function declaredProperties(rules: Rule[]): string[] {
  return rules.flatMap((rule) =>
    rule.nodes.flatMap((node) => (node.type === 'decl' ? [node.prop] : [])),
  );
}

describe('to-top button markup', () => {
  it('renders a secondary .btn that keeps the to-top-btn hook', () => {
    render(
      <SectionNavigationProvider chrome={siteNavChrome(SITE_LOCALE.en)} locale={SITE_LOCALE.en}>
        <ToTopButton />
      </SectionNavigationProvider>,
    );
    const button = screen.getByRole('button', { name: 'Back to top', hidden: true });
    expect(button.classList.contains('btn')).toBe(true);
    expect(button.classList.contains('to-top-btn')).toBe(true);
    expect(button.getAttribute('data-variant')).toBe('secondary');
  });
});

describe('to-top button stylesheet', () => {
  it('has no rule on the bare hook', async () => {
    const root = await compiledSiteStylesheet();
    expect(screenRules(root, '.to-top-btn')).toEqual([]);
    expect(screenRules(root, '.to-top-btn.to-top-show')).toEqual([]);
  });

  it('leaves paint, border, font, cursor and alignment to .btn', async () => {
    const root = await compiledSiteStylesheet();
    const rules = [FAMILY, VARIANT_FAMILY, `${FAMILY}.to-top-show`].flatMap((selector) =>
      rulesWithResolvedSelector(root, selector),
    );
    expect(rules.length).toBeGreaterThanOrEqual(4);
    const declared = declaredProperties(rules);
    for (const property of OWNED_BY_BASE_AND_VARIANT) expect(declared).not.toContain(property);
  });

  it('keeps the surface fill, the open bottom and end edges and no hover glow or tint', async () => {
    const root = await compiledSiteStylesheet();
    const [rest] = rulesWithResolvedSelector(root, VARIANT_FAMILY);
    expect(declValue(rest, 'background')).toBe('var(--color-surface)');
    expect(declValue(rest, 'border-bottom')).toBe('0');
    expect(declValue(rest, 'border-inline-end')).toBe('0');
    const [hover] = rulesWithResolvedSelector(root, `${VARIANT_FAMILY}:hover`);
    expect(declValue(hover, 'background')).toBe('var(--color-surface)');
    expect(declValue(hover, 'box-shadow')).toBe('none');
  });

  it('declares its fade below the base MOTION-off rule, so MOTION off still stops it', async () => {
    const root = await compiledSiteStylesheet();
    const withTransition = [FAMILY, VARIANT_FAMILY].flatMap((selector) =>
      rulesWithResolvedSelector(root, selector).filter(
        (rule) => declValue(rule, 'transition') !== undefined,
      ),
    );
    expect(withTransition.map((rule) => rule.selector)).toEqual([FAMILY]);
  });
});
