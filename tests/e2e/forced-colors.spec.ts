import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { FOCUS_RING_TARGETS, focusByKeyboard } from './_helpers/focus-ring-targets';
import {
  type ControlProbe,
  DECORATIVE_SELECTORS,
  DECORATIVE_STYLE_PROPERTIES,
  DEFAULT_STYLE_PROPERTIES,
  DESKTOP_CONTROLS,
  FOCUS_OUTLINE_CONTROLS,
  FORCED_ROUTES,
  hasBoundary,
  MOBILE_CONTROLS,
  readStyles,
  STATE_PROPERTIES,
} from './_helpers/forced-colors';
import {
  DEFAULT_CONTROL_STYLES,
  DEFAULT_DECORATIVE_STYLES,
} from './_helpers/forced-colors-default-styles';
import { gotoHydrated, MENU_TRIGGER } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';

const FORCED_QUERY = '(forced-colors: active)';
const NO_OUTLINE_STYLE = 'none';
const NARROW_VIEWPORT = { width: 390, height: 844 };
const EXPECTED_OVERLAYS = 6;
const UNMEASURABLE_UNDER_FORCED_COLORS = 'color-contrast';

async function openForced(page: Page, route: string): Promise<void> {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await gotoHydrated(page, route, MENU_TRIGGER);
}

async function stateSignature(target: Locator): Promise<string> {
  return JSON.stringify(await readStyles(target, STATE_PROPERTIES));
}

async function visibleControls(page: Page, probe: ControlProbe): Promise<Locator[]> {
  const matches = page.locator(`${probe.selector}`);
  const found: Locator[] = [];
  for (let index = 0; index < (await matches.count()); index++) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible()) found.push(candidate);
  }
  return found;
}

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  for (const route of FORCED_ROUTES) {
    test.describe(route, () => {
      test('the forced-colors query matches', async ({ page }) => {
        await openForced(page, route);
        expect(await page.evaluate((query) => matchMedia(query).matches, FORCED_QUERY)).toBe(true);
      });

      test('the decorative layer is not painted', async ({ page }) => {
        await openForced(page, route);
        const hidden = await page.evaluate((selectors) => {
          const nodes = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
          return {
            count: nodes.length,
            painted: nodes
              .filter((node) => {
                const style = getComputedStyle(node);
                return style.display !== 'none' && style.visibility !== 'hidden';
              })
              .map((node) => `${node.tagName.toLowerCase()}.${node.className}`),
          };
        }, DECORATIVE_SELECTORS);
        expect(hidden.count).toBeGreaterThan(0);
        expect(
          hidden.painted,
          'forced colors repaints decorative layers over system colors: the CRT overlays and the aria-hidden canvases must not render',
        ).toEqual([]);
      });

      test('axe finds no violations', async ({ page }) => {
        await openForced(page, route);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .disableRules([UNMEASURABLE_UNDER_FORCED_COLORS])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    });
  }

  test('the home page carries every CRT overlay layer, all hidden', async ({ page }) => {
    await openForced(page, '/');
    const overlays = page.locator('[data-testid^="crt-"]');
    await expect(overlays).toHaveCount(EXPECTED_OVERLAYS);
    for (let index = 0; index < EXPECTED_OVERLAYS; index++) {
      await expect(overlays.nth(index)).toHaveCSS('display', 'none');
    }
  });

  for (const { name, route, selector } of FOCUS_RING_TARGETS) {
    test(`keyboard focus on the ${name} shows an outline`, async ({ page }) => {
      await openForced(page, route);
      const target = page.locator(`${selector}:visible`).first();
      await expect(target).toBeVisible();
      await focusByKeyboard(page, target);
      const ring = await readStyles(target, ['outline-style', 'outline-width']);
      expect(ring['outline-style']).not.toBe(NO_OUTLINE_STYLE);
      expect(Number.parseFloat(ring['outline-width'] ?? '0')).toBeGreaterThan(0);
    });
  }

  for (const probe of DESKTOP_CONTROLS) {
    test(`the ${probe.name} has a drawn boundary`, async ({ page }) => {
      await openForced(page, probe.route);
      const controls = await visibleControls(page, probe);
      expect(controls.length, `${probe.selector} must exist on ${probe.route}`).toBeGreaterThan(0);
      for (const control of controls) {
        expect(
          await hasBoundary(control),
          `${probe.selector}: background, shadow and gradient are repainted or dropped under forced colors, so the control needs a real border or outline`,
        ).toBe(true);
      }
    });
  }

  for (const probe of FOCUS_OUTLINE_CONTROLS) {
    test(`keyboard focus on the ${probe.name} shows an outline`, async ({ page }) => {
      await openForced(page, probe.route);
      const target = page.locator(`${probe.selector}:visible`).first();
      await focusByKeyboard(page, target);
      const ring = await readStyles(target, ['outline-style', 'outline-width']);
      expect(ring['outline-style']).not.toBe(NO_OUTLINE_STYLE);
      expect(Number.parseFloat(ring['outline-width'] ?? '0')).toBeGreaterThan(0);
    });
  }

  test('filled and empty vu segments differ', async ({ page }) => {
    await openForced(page, '/');
    const filled = page.locator('#sec-guitar .vuSegFilled:visible').first();
    const empty = page.locator('#sec-guitar .vuSegEmpty:visible').first();
    await expect(filled).toBeVisible();
    await expect(empty).toBeVisible();
    const paint = ['background-color', 'outline-style', 'outline-width'];
    expect(await readStyles(filled, paint)).not.toEqual(await readStyles(empty, paint));
  });

  test('an expanded menu trigger differs from a collapsed one', async ({ page }) => {
    await openForced(page, '/');
    const trigger = page.locator(`${MENU_TRIGGER}:visible`).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await page.mouse.move(0, 0);
    const collapsed = await stateSignature(trigger);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    const expanded = await stateSignature(trigger);
    expect(expanded).not.toBe(collapsed);
  });

  test('the current design-system nav item differs from the others', async ({ page }) => {
    await openForced(page, '/design-system');
    const current = page.locator('.ds-nav-item[aria-current]:visible').first();
    const other = page.locator('.ds-nav-item:not([aria-current]):visible').first();
    await expect(current).toBeVisible();
    expect(await stateSignature(current)).not.toBe(await stateSignature(other));
  });

  test('hovering a links pill changes its signature', async ({ page }) => {
    await openForced(page, '/links');
    const pill = page.locator('.links-pill:visible').first();
    await page.mouse.move(0, 0);
    const resting = await stateSignature(pill);
    await pill.hover();
    expect(await stateSignature(pill)).not.toBe(resting);
  });

  test.describe('at phone width', () => {
    test.use({ viewport: NARROW_VIEWPORT });

    for (const probe of MOBILE_CONTROLS) {
      test(`the ${probe.name} has a drawn boundary`, async ({ page }) => {
        await openForced(page, probe.route);
        const controls = await visibleControls(page, probe);
        expect(controls.length, `${probe.selector} must exist on ${probe.route}`).toBeGreaterThan(
          0,
        );
        for (const control of controls) {
          expect(await hasBoundary(control)).toBe(true);
        }
      });
    }

    test('the current dock entry differs from the others', async ({ page }) => {
      await openForced(page, '/');
      await page.locator('#sec-shell').scrollIntoViewIfNeeded();
      const current = page.locator('.dock > [aria-current], .dock > [data-current]').first();
      const other = page.locator('.dock > a:not([aria-current]):not([data-current])').first();
      await expect(current).toBeVisible();
      await expect
        .poll(async () => (await stateSignature(current)) !== (await stateSignature(other)))
        .toBe(true);
    });

    test('the drawer items have a drawn boundary and the current one differs', async ({ page }) => {
      await openForced(page, '/');
      await page.locator(`${MENU_TRIGGER}:visible`).first().click();
      const items = page.locator('.section-menu .nav-item:visible');
      await expect(items.first()).toBeVisible();
      for (let index = 0; index < (await items.count()); index++) {
        expect(await hasBoundary(items.nth(index))).toBe(true);
      }
      const current = page.locator('.section-menu .nav-item[aria-current]:visible').first();
      const other = page.locator('.section-menu .nav-item:not([aria-current]):visible').first();
      await expect(current).toBeVisible();
      expect(await stateSignature(current)).not.toBe(await stateSignature(other));
    });
  });
});

test.describe('without forced colors', () => {
  test.use({ forcedColors: 'none' });

  test('the forced-colors query does not match', async ({ page }) => {
    await openForced(page, '/');
    expect(await page.evaluate((query) => matchMedia(query).matches, FORCED_QUERY)).toBe(false);
  });

  test('the decorative layer still paints', async ({ page }) => {
    await openForced(page, '/');
    const overlays = page.locator('[data-testid^="crt-"]');
    await expect(overlays).toHaveCount(EXPECTED_OVERLAYS);
    for (let index = 0; index < EXPECTED_OVERLAYS; index++) {
      await expect(overlays.nth(index)).not.toHaveCSS('display', 'none');
    }
  });

  for (const probe of DESKTOP_CONTROLS) {
    test(`the ${probe.name} keeps its default styles`, async ({ page }) => {
      await openForced(page, probe.route);
      const target = page.locator(`${probe.selector}:visible`).first();
      await expect(target).toBeVisible();
      const expected = DEFAULT_CONTROL_STYLES[`${probe.route} ${probe.selector}`];
      expect(expected, `no recorded default styles for ${probe.selector}`).toBeDefined();
      expect(await readStyles(target, DEFAULT_STYLE_PROPERTIES)).toEqual(expected);
    });
  }

  test('the decorative layer keeps its default display', async ({ page }) => {
    await openForced(page, '/');
    for (const selector of DECORATIVE_SELECTORS) {
      const target = page.locator(selector).first();
      const expected = DEFAULT_DECORATIVE_STYLES[selector];
      expect(await readStyles(target, DECORATIVE_STYLE_PROPERTIES)).toEqual(expected);
    }
  });
});
