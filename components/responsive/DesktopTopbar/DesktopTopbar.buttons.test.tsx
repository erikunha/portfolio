import type { AtRule, Rule } from 'postcss';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesWithResolvedSelector,
} from '@/__tests__/helpers/css-rules';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('next/navigation', () => ({ usePathname: () => null }));

const SELECTOR_PART = /\.[\w-]+|\[[^\]]+\]|:(?!not\b)(?!:)[\w-]+/g;
const TOPBAR_ACTION = '.btn.topbar-action';
const SECONDARY_ACTION = `${TOPBAR_ACTION}[data-variant="secondary"]`;
const TOGGLE = `${TOPBAR_ACTION}.topbar-action-toggle`;
const OUTLINE = `${TOPBAR_ACTION}.topbar-action-outline`;
const SECONDARY_BASE = '.btn[data-variant="secondary"]';
const FAMILY_TYPE = 'var(--tracking-sm)';
const EXPECTED_VARIANTS: readonly (readonly [string, string])[] = [
  ['.topbar-action-toggle', 'secondary'],
  ['.topbar-action-outline', 'secondary'],
  ['.topbar-action-solid', 'primary'],
];
const OVERRIDES: readonly (readonly [string, readonly string[]])[] = [
  [TOPBAR_ACTION, ['.btn']],
  [SECONDARY_ACTION, ['.btn']],
  [TOGGLE, [SECONDARY_BASE]],
  [`${TOGGLE}:hover`, [SECONDARY_BASE]],
  [OUTLINE, [SECONDARY_BASE]],
];

let mounted: MountedClient | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const specificity = (selector: string): number => selector.match(SELECTOR_PART)?.length ?? 0;

const inLayer = (rules: Rule[]): Rule[] =>
  rules.filter(
    (rule) => rule.parent?.type === 'atrule' && (rule.parent as AtRule).name === 'layer',
  );

async function renderTopbar(): Promise<MountedClient> {
  const { DesktopTopbar } = await import('./DesktopTopbar.client');
  return mountClient(
    createElement(
      SectionNavigationProvider,
      { chrome: siteNavChrome(SITE_LOCALE.en), locale: SITE_LOCALE.en },
      createElement(DesktopTopbar, { brand: createElement('a', { href: '/' }, 'brand') }),
    ),
  );
}

describe('topbar actions', () => {
  it.each(EXPECTED_VARIANTS)(
    '%s renders on the shared base as the %s variant',
    async (selector, variant) => {
      mounted = await renderTopbar();
      const action = mounted.container.querySelector(selector);
      expect(action, selector).not.toBeNull();
      expect(action?.classList.contains('btn')).toBe(true);
      expect(action?.classList.contains('topbar-action')).toBe(true);
      expect(action?.getAttribute('data-variant')).toBe(variant);
    },
  );

  it.each(OVERRIDES)(
    '%s outranks the base rules it overrides, so stylesheet order never decides',
    async (family, bases) => {
      const root = await compiledSiteStylesheet();
      const familyRules = inLayer(rulesWithResolvedSelector(root, family));
      expect(familyRules.length, family).toBeGreaterThan(0);
      for (const base of bases) {
        expect(inLayer(rulesWithResolvedSelector(root, base)).length, base).toBeGreaterThan(0);
        expect(specificity(family), `${family} against ${base}`).toBeGreaterThan(specificity(base));
      }
    },
  );

  it('keeps the topbar leading, tracking and case instead of the base type', async () => {
    const root = await compiledSiteStylesheet();
    const rules = inLayer(rulesWithResolvedSelector(root, TOPBAR_ACTION));
    expect(rules.map((rule) => declValue(rule, 'letter-spacing'))).toContain(FAMILY_TYPE);
    expect(rules.map((rule) => declValue(rule, 'text-transform'))).toContain('none');
    expect(rules.map((rule) => declValue(rule, '--leading'))).toContain('inherit');
  });
});
