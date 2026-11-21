import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { MenuTrigger } from './MenuTrigger.client';
import { SectionNavigationProvider } from './SectionNavigationProvider.client';

const TRIGGER = '.btn.menu-trigger';
const SECONDARY = '[data-variant="secondary"]';
const OWNED_BY_BASE_AND_VARIANT = [
  'align-items',
  'border',
  'border-style',
  'border-width',
  'box-sizing',
  'color',
  'cursor',
  'display',
  'font',
  'font-family',
  'font-size',
  'justify-content',
  'min-height',
  'min-width',
  'transition',
] as const;

function declaredProperties(rules: ReturnType<typeof rulesWithResolvedSelector>): string[] {
  return rules.flatMap((rule) =>
    rule.nodes.flatMap((node) => (node.type === 'decl' ? [node.prop] : [])),
  );
}

describe('menu trigger markup', () => {
  it('renders a secondary .btn that keeps the menu-trigger hook', () => {
    render(
      <SectionNavigationProvider chrome={siteNavChrome(SITE_LOCALE.en)} locale={SITE_LOCALE.en}>
        <MenuTrigger className="extra" />
      </SectionNavigationProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger.classList.contains('btn')).toBe(true);
    expect(trigger.classList.contains('menu-trigger')).toBe(true);
    expect(trigger.classList.contains('extra')).toBe(true);
    expect(trigger.getAttribute('data-variant')).toBe('secondary');
  });
});

describe('menu trigger stylesheet', () => {
  it('has no rule on the bare hook and keeps the shared drawer rule for the other two controls', async () => {
    const root = await compiledSiteStylesheet();
    expect(rulesWithResolvedSelector(root, '.menu-trigger')).toEqual([]);
    expect(rulesWithResolvedSelector(root, '.menu-trigger:hover')).toEqual([]);
    expect(rulesWithResolvedSelector(root, '.menu-motion').length).toBeGreaterThan(0);
    expect(rulesWithResolvedSelector(root, '.menu-close').length).toBeGreaterThan(0);
  });

  it('keeps the square box, the zero padding and no base-owned property', async () => {
    const root = await compiledSiteStylesheet();
    const rules = rulesWithResolvedSelector(root, TRIGGER);
    const declared = declaredProperties(rules);
    expect(declared.sort()).toEqual([
      '-webkit-tap-highlight-color',
      'flex',
      'height',
      'padding-inline',
      'width',
    ]);
    expect(declValue(rules[0], 'padding-inline')).toBe('0');
    for (const property of OWNED_BY_BASE_AND_VARIANT) expect(declared).not.toContain(property);
  });

  it('draws the hover and expanded tint, drops the base glow and wins over the variant hover', async () => {
    const root = await compiledSiteStylesheet();
    const [hover] = rulesWithResolvedSelector(root, `${TRIGGER}${SECONDARY}:hover`);
    expect(declValue(hover, 'background')).toBe('var(--color-signal-glow-06)');
    expect(declValue(hover, 'border-color')).toBe('var(--color-accent)');
    expect(declValue(hover, 'box-shadow')).toBe('none');
    const [expanded] = rulesWithResolvedSelector(
      root,
      `${TRIGGER}${SECONDARY}[aria-expanded="true"]`,
    );
    expect(declValue(expanded, 'background')).toBe('var(--color-signal-glow-06)');
    expect(declValue(expanded, 'box-shadow')).toBe('none');
    const [active] = rulesWithResolvedSelector(root, `${TRIGGER}${SECONDARY}:active`);
    expect(declValue(active, 'background')).toBe('var(--color-signal-quiet)');
  });
});
