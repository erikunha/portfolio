import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { FOCUS_RING_TARGETS, focusByKeyboard } from './_helpers/focus-ring-targets';
import {
  BOLD_WEIGHT,
  type ControlProbe,
  DECORATIVE_SELECTORS,
  DECORATIVE_STYLE_PROPERTIES,
  DEFAULT_STYLE_PROPERTIES,
  DESKTOP_CONTROLS,
  FOCUS_OUTLINE_CONTROLS,
  FORCED_ROUTES,
  findSvgPaintLeaks,
  findVanishedIndicators,
  HAIRLINE_PX,
  hasBoundary,
  MOBILE_CONTROLS,
  px,
  readStyles,
  resolveSystemColors,
  STATE_BORDER_FLOOR_PX,
  STATE_PROPERTIES,
  SYSTEM_COLORS,
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
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const FIXED_NOW = new Date('2026-11-02T15:00:00Z');
const VISITOR_TIMEZONE = 'Europe/Berlin';
const UNDERLINE = 'underline';
const DOUBLE_BORDER = 'double';
const FOCUS_RING_OFFSET_PX = 2;
const COLOR_SCHEMES = ['dark', 'light'] as const;
const SVG_ROUTES = FORCED_ROUTES.filter((route) => !route.startsWith('/links'));
const CONTACT_CELLS = '.ctz-cells';
const WINDOW_DOT_COUNT = 3;
const INDICATOR_SELECTORS =
  '.meter-fill, .meter-dim, .meter-alert, .status-dot, .badge-dot, .ctz-pin, .faderThumb, .vuSegFilled';
const SCROLL_MARGIN_PX = 100;
const ISLAND_READY_TIMEOUT_MS = 20_000;
const HAIRLINE_CELL = 'span.ctz-cell';

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

  test('hovering a links line changes its signature', async ({ page }) => {
    await openForced(page, '/links');
    const line = page.locator('.links-line:visible').first();
    await page.mouse.move(0, 0);
    const resting = await stateSignature(line);
    await line.hover();
    expect(await stateSignature(line)).not.toBe(resting);
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

test.describe('forced colors state, hierarchy and focus', () => {
  test.use({ forcedColors: 'active' });

  async function openContactTimezone(page: Page): Promise<void> {
    await page.clock.setFixedTime(FIXED_NOW);
    await openForced(page, '/');
    await page.evaluate((margin) => {
      const panel = document.querySelector('.contact-timezone');
      window.scrollTo(0, (panel?.getBoundingClientRect().top ?? 0) + window.scrollY - margin);
    }, SCROLL_MARGIN_PX);
    await expect(page.locator(`${CONTACT_CELLS} .ctz-cell`).first()).toBeVisible({
      timeout: ISLAND_READY_TIMEOUT_MS,
    });
  }

  test.describe('at phone width', () => {
    test.use({ viewport: NARROW_VIEWPORT });

    test('the current language differs from the other languages', async ({ page }) => {
      await openForced(page, '/');
      await page.locator(`${MENU_TRIGGER}:visible`).first().click();
      const current = page.locator('[data-lang-switch] [aria-current]:visible').first();
      const other = page.locator('[data-lang-switch] a:not([aria-current]):visible').first();
      await expect(current).toBeVisible();
      const colors = await resolveSystemColors(page);
      const style = await readStyles(current, [
        'border-top-color',
        'text-decoration-line',
        'border-top-style',
      ]);
      expect(await px(current, 'border-top-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
      expect(style['border-top-color']).toBe(colors.Highlight);
      expect(style['text-decoration-line']).toContain(UNDERLINE);
      expect(await px(other, 'border-top-width')).toBeLessThan(STATE_BORDER_FLOOR_PX);
      expect(await stateSignature(current)).not.toBe(await stateSignature(other));
    });

    test('the status bar meters do not collapse into the canvas', async ({ page }) => {
      await openForced(page, '/');
      const colors = await resolveSystemColors(page);
      const selector = '.status-bar .meter-fill, .status-bar .meter-dim';
      expect(await page.locator(selector).count()).toBeGreaterThan(0);
      expect(await findVanishedIndicators(page, selector, colors.Canvas)).toEqual([]);
    });

    test('the current drawer item is not the same as a focused one', async ({ page }) => {
      await openForced(page, '/');
      await page.locator(`${MENU_TRIGGER}:visible`).first().click();
      const current = page.locator('.section-menu .nav-item[aria-current]:visible').first();
      const other = page.locator('.section-menu .nav-item:not([aria-current]):visible').first();
      await expect(current).toBeVisible();
      expect((await readStyles(current, ['border-top-style']))['border-top-style']).toBe(
        DOUBLE_BORDER,
      );
      expect(
        (await readStyles(current, ['text-decoration-line']))['text-decoration-line'],
      ).toContain(UNDERLINE);
      await focusByKeyboard(page, other);
      const focusedOther = await readStyles(other, ['outline-style', 'border-top-style']);
      expect(focusedOther['border-top-style']).not.toBe(DOUBLE_BORDER);
    });
  });

  test('the current design-system nav item is marked by more than its colour', async ({ page }) => {
    await openForced(page, '/design-system');
    const current = page.locator('.ds-nav-item[aria-current]:visible').first();
    await expect(current).toBeVisible();
    const style = await readStyles(current, ['border-top-style', 'text-decoration-line']);
    expect(style['border-top-style']).toBe(DOUBLE_BORDER);
    expect(style['text-decoration-line']).toContain(UNDERLINE);
  });

  test.describe('contact timezone overlap grid', () => {
    test.use({ timezoneId: VISITOR_TIMEZONE, locale: 'en-US' });

    test('cells outside the overlap draw a hairline on the canvas', async ({ page }) => {
      await openContactTimezone(page);
      const colors = await resolveSystemColors(page);
      const off = page
        .locator(`${CONTACT_CELLS} .ctz-cell[data-on="false"]:not([data-now])`)
        .first();
      const style = await readStyles(off, ['background-color', 'outline-color', 'outline-style']);
      expect(style['background-color']).toBe(colors.Canvas);
      expect(style['outline-color']).toBe(colors.GrayText);
      expect(style['outline-style']).not.toBe(NO_OUTLINE_STYLE);
      expect(await px(off, 'outline-width')).toBe(HAIRLINE_PX);
    });

    test('cells inside the overlap are filled with the highlight', async ({ page }) => {
      await openContactTimezone(page);
      const colors = await resolveSystemColors(page);
      const on = page.locator('.ctz-row:not([data-row="both"]) .ctz-cell[data-on="true"]').first();
      await expect(on).toBeVisible();
      expect((await readStyles(on, ['background-color']))['background-color']).toBe(
        colors.Highlight,
      );
    });

    test('the shared row marks its overlap cells with a thick outline', async ({ page }) => {
      await openContactTimezone(page);
      const colors = await resolveSystemColors(page);
      const both = page.locator('.ctz-row[data-row="both"] .ctz-cell[data-on="true"]').first();
      await expect(both).toBeVisible();
      const style = await readStyles(both, ['outline-color', 'background-color']);
      expect(style['outline-color']).toBe(colors.ButtonText);
      expect(style['background-color']).toBe(colors.Highlight);
      expect(await px(both, 'outline-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
    });
  });

  test.describe('primary and secondary actions', () => {
    test.use({ viewport: DESKTOP_VIEWPORT, timezoneId: VISITOR_TIMEZONE, locale: 'en-US' });

    const PRIMARY_ACTIONS = [
      '.topbar-action-solid',
      '.hero-actions .btn[data-variant="primary"]',
      '.contact-send',
      '.contact-channel-cta',
      '.ctz-propose',
    ] as const;
    const SECONDARY_ACTIONS = [
      '.topbar-action-outline',
      '.hero-actions .btn[data-variant="secondary"]',
    ] as const;

    for (const selector of PRIMARY_ACTIONS) {
      test(`${selector} has a thick border and bold text`, async ({ page }) => {
        await openContactTimezone(page);
        const target = page.locator(`${selector}:visible`).first();
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeVisible();
        expect(await px(target, 'border-top-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
        expect(
          Number((await readStyles(target, ['font-weight']))['font-weight']),
        ).toBeGreaterThanOrEqual(BOLD_WEIGHT);
      });
    }

    for (const selector of SECONDARY_ACTIONS) {
      test(`${selector} keeps a thin border`, async ({ page }) => {
        await openForced(page, '/');
        const target = page.locator(`${selector}:visible`).first();
        await expect(target).toBeVisible();
        expect(await px(target, 'border-top-width')).toBeLessThan(STATE_BORDER_FLOOR_PX);
      });
    }

    test('the hero primary action is told apart from the secondary one', async ({ page }) => {
      await openForced(page, '/');
      const primary = page.locator('.hero-actions .btn[data-variant="primary"]').first();
      const secondary = page
        .locator('.hero-actions .btn[data-variant="secondary"]:visible')
        .first();
      expect(await stateSignature(primary)).not.toBe(await stateSignature(secondary));
    });
  });

  test.describe('pressed toggles', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    async function expectPressedMark(pressed: Locator, resting: Locator, page: Page) {
      const colors = await resolveSystemColors(page);
      const style = await readStyles(pressed, ['border-top-color', 'text-decoration-line']);
      expect(await px(pressed, 'border-top-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
      expect(style['border-top-color']).toBe(colors.Highlight);
      expect(style['text-decoration-line']).toContain(UNDERLINE);
      expect(await stateSignature(pressed)).not.toBe(await stateSignature(resting));
    }

    test('a pressed mixer button differs from an unpressed one', async ({ page }) => {
      await openForced(page, '/');
      const pressed = page.locator('.rms-buttons [aria-pressed="true"]').first();
      const resting = page.locator('.rms-buttons [aria-pressed="false"]').first();
      await pressed.scrollIntoViewIfNeeded();
      await expect(pressed).toBeVisible();
      await expectPressedMark(pressed, resting, page);
    });

    test('the pressed motion toggle differs from the unpressed one', async ({ page }) => {
      await openForced(page, '/');
      const toggle = page.locator('.topbar-action-toggle:visible').first();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.mouse.move(0, 0);
      const pressedSignature = await stateSignature(toggle);
      const colors = await resolveSystemColors(page);
      expect(await px(toggle, 'border-top-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
      expect((await readStyles(toggle, ['border-top-color']))['border-top-color']).toBe(
        colors.Highlight,
      );
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await page.mouse.move(0, 0);
      await page.keyboard.press('Tab');
      expect(await stateSignature(toggle)).not.toBe(pressedSignature);
      expect(await px(toggle, 'border-top-width')).toBeLessThan(STATE_BORDER_FLOOR_PX);
    });
  });

  test.describe('keyboard focus ring', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    const RING_TARGETS = [
      { route: '/', selector: '.menu-trigger' },
      { route: '/', selector: '.hero-actions .btn' },
      { route: '/', selector: '.contact-send' },
      { route: '/', selector: '.rms-buttons button' },
      { route: '/', selector: '#sec-guitar .fader-track' },
      { route: '/design-system', selector: '.ds-nav-item' },
    ] as const;

    for (const { route, selector } of RING_TARGETS) {
      test(`${selector} on ${route} shows the shared highlight ring`, async ({ page }) => {
        await openForced(page, route);
        const target = page.locator(`${selector}:visible`).first();
        await focusByKeyboard(page, target);
        const colors = await resolveSystemColors(page);
        const ring = await readStyles(target, ['outline-style', 'outline-color']);
        expect(ring['outline-style']).not.toBe(NO_OUTLINE_STYLE);
        expect(ring['outline-color']).toBe(colors.Highlight);
        expect(await px(target, 'outline-width')).toBeGreaterThanOrEqual(STATE_BORDER_FLOOR_PX);
        expect(await px(target, 'outline-offset')).toBe(FOCUS_RING_OFFSET_PX);
      });
    }
  });

  test.describe('structure that is not disabled', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test('the fader track, guitar bars and empty vu segments are not drawn in the disabled colour', async ({
      page,
    }) => {
      await openForced(page, '/');
      const colors = await resolveSystemColors(page);
      const track = await page.evaluate(() => {
        const node = document.querySelector('#sec-guitar .fader-track');
        return node ? getComputedStyle(node, '::before').backgroundColor : '';
      });
      const bar = page.locator('#sec-guitar .guitar-bar:not([data-filled="true"])').first();
      const empty = page.locator('#sec-guitar .vuSegEmpty:visible').first();
      await bar.scrollIntoViewIfNeeded();
      expect(track).not.toBe(colors.GrayText);
      expect((await readStyles(bar, ['background-color']))['background-color']).not.toBe(
        colors.GrayText,
      );
      const emptyStyle = await readStyles(empty, ['outline-color', 'outline-style']);
      expect(emptyStyle['outline-color']).toBe(colors.ButtonText);
      expect(emptyStyle['outline-style']).toBe('dotted');
    });

    test('the window chrome dots keep a drawn boundary and distinct fills', async ({ page }) => {
      await openForced(page, '/');
      const dots = page.locator('.window-chrome [data-dot]');
      expect(await dots.count()).toBeGreaterThanOrEqual(WINDOW_DOT_COUNT);
      for (let index = 0; index < (await dots.count()); index++) {
        expect(await hasBoundary(dots.nth(index))).toBe(true);
      }
      const fills = await page.evaluate(() =>
        [...document.querySelectorAll('.window-chrome')]
          .slice(0, 1)
          .flatMap((chrome) => [...chrome.querySelectorAll('[data-dot]')])
          .map((dot) => getComputedStyle(dot).backgroundColor),
      );
      expect(new Set(fills).size).toBe(WINDOW_DOT_COUNT);
    });

    test('the highlighted country stays marked without its inverted fill', async ({ page }) => {
      await openForced(page, '/');
      const country = page.locator('.hero-context .hero-location').first();
      await expect(country).toBeVisible();
      expect(
        (await readStyles(country, ['text-decoration-line']))['text-decoration-line'],
      ).toContain(UNDERLINE);
    });

    for (const route of ['/', '/design-system'] as const) {
      test(`filled indicators on ${route} do not collapse into the canvas`, async ({ page }) => {
        await openForced(page, route);
        const colors = await resolveSystemColors(page);
        const vanished = await findVanishedIndicators(page, INDICATOR_SELECTORS, colors.Canvas);
        expect(await page.locator(INDICATOR_SELECTORS).count()).toBeGreaterThan(0);
        expect(
          vanished,
          'a background-only indicator is repainted as the canvas: give it a system colour or an outline',
        ).toEqual([]);
      });
    }

    test('GrayText marks only disabled and placeholder states', async ({ page }) => {
      await openForced(page, '/');
      const colors = await resolveSystemColors(page);
      const strays = await page.evaluate((grayText) => {
        const isDisabled = (node: Element): boolean =>
          node.closest('[aria-disabled="true"], :disabled, [disabled]') !== null;
        const found: string[] = [];
        for (const node of document.querySelectorAll('body *')) {
          for (const pseudo of [null, '::before', '::after']) {
            const style = getComputedStyle(node, pseudo);
            const painted = [
              style.backgroundColor,
              style.outlineStyle !== 'none' ? style.outlineColor : '',
              Number.parseFloat(style.borderTopWidth) > 0 ? style.borderTopColor : '',
            ];
            if (painted.includes(grayText) && !isDisabled(node)) {
              found.push(
                `${node.tagName.toLowerCase()}.${node.getAttribute('class') ?? ''}${pseudo ?? ''}`,
              );
            }
          }
        }
        return [...new Set(found)];
      }, colors.GrayText);
      expect(
        strays.filter((entry) => !entry.startsWith(HAIRLINE_CELL)),
        'GrayText on a non-disabled element reads as disabled',
      ).toEqual([]);
    });
  });

  for (const scheme of COLOR_SCHEMES) {
    test.describe(`${scheme} palette`, () => {
      test.use({ colorScheme: scheme });

      for (const route of SVG_ROUTES) {
        test(`svg paint on ${route} stays inside the system palette`, async ({ page }) => {
          await openForced(page, route);
          const colors = await resolveSystemColors(page);
          const palette = SYSTEM_COLORS.map((keyword) => colors[keyword]);
          const leaks = await findSvgPaintLeaks(page, palette);
          expect(
            leaks,
            'an svg shape painted with a theme colour ignores the forced palette: use CanvasText, Canvas, Highlight or currentColor',
          ).toEqual([]);
        });
      }
    });
  }
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
