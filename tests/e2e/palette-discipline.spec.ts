import { expect, type Page, test } from '@playwright/test';
import { NAVIGATION } from '../../content/navigation';
import { SITE_LOCALE } from '../../content/site-locale';
import { MENU_TRIGGER, MOTION_TOPBAR_TOGGLE } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const { copy } = NAVIGATION[SITE_LOCALE.en];

const SIGNAL_RGB = 'rgb(0, 255, 65)';
const BODY_RGB = 'rgb(230, 255, 230)';
const SECONDARY_RGB = 'rgb(161, 179, 161)';
const TRANSPARENT_RGB = 'rgba(0, 0, 0, 0)';
const UNDERLINE = 'underline';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const OFF_PALETTE_HUES = [
  'rgb(236, 251, 255)',
  'rgb(208, 245, 255)',
  'rgb(168, 236, 255)',
  'rgb(141, 232, 255)',
  'rgb(127, 228, 255)',
  'rgb(69, 205, 240)',
  'rgb(34, 168, 204)',
  'rgb(255, 248, 230)',
  'rgb(255, 238, 191)',
  'rgb(255, 226, 147)',
  'rgb(255, 216, 107)',
  'rgb(255, 202, 71)',
  'rgb(254, 188, 46)',
  'rgb(217, 154, 31)',
];
const WINDOW_CHROME_DOT = '[data-dot]';
const SCANNED_ROUTES = ['/', '/links', '/summary', '/cv', '/design-system/tokens'];

const computed = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`active language is not the HIRE fill at ${viewport.width}`, () => {
    test.use({ viewport });

    test('the current locale is outlined and underlined, the solid fill stays on HIRE', async ({
      page,
    }) => {
      await gotoSettled(page, '/');
      if (viewport.width < DESKTOP.width) {
        await page.locator(`${MENU_TRIGGER}:visible`).first().click();
      }
      const current = page.locator('[data-lang-switch] [aria-current]:visible').first();
      await expect(current).toBeVisible();
      expect(
        await current.evaluate((el) => getComputedStyle(el).backgroundColor),
        'the active locale must not carry the solid CTA fill',
      ).toBe(TRANSPARENT_RGB);
      expect(await current.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain(
        UNDERLINE,
      );
      expect(await current.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(SIGNAL_RGB);
      if (viewport.width >= DESKTOP.width) {
        expect(
          await computed(page, '.topbar-action-solid', 'background-color'),
          'HIRE keeps the only solid signal fill in the header',
        ).toBe(SIGNAL_RGB);
      }
    });
  });
}

test.describe('MOTION toggle', () => {
  test.use({ viewport: DESKTOP });

  test('prints ON or OFF beside its label and flips on click', async ({ page }) => {
    await gotoSettled(page, '/');
    const toggle = page.locator(MOTION_TOPBAR_TOGGLE).first();
    await expect(toggle).toContainText(copy.motionOn);
    await expect(async () => {
      await toggle.click();
      await expect(toggle).toContainText(copy.motionOff);
    }).toPass();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('small text keeps to body and secondary colors', () => {
  test.use({ viewport: DESKTOP });

  test('career descriptions are body text, dates and hashes are secondary, decorations are not cyan', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    expect(await computed(page, '.career-body', 'color'), '.career-body is a sentence').toBe(
      BODY_RGB,
    );
    for (const selector of ['.career-hash', '.career-period', '.career-location']) {
      expect(await computed(page, selector, 'color'), `${selector} is metadata`).toBe(
        SECONDARY_RGB,
      );
    }
    expect(await computed(page, '.career-decoration', 'color')).toBe(SECONDARY_RGB);
  });

  test('the footer LISTEN state is not amber', async ({ page }) => {
    await gotoSettled(page, '/');
    expect(await computed(page, '.footer-listening', 'color')).toBe(BODY_RGB);
  });

  test('the About group column and code tokens stay in the green and grey ramps', async ({
    page,
  }) => {
    await gotoSettled(page, '/');
    expect(await computed(page, '.ab-group', 'color')).toBe(SECONDARY_RGB);
    const colors = await page
      .locator('.ab-code pre span')
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => getComputedStyle(node).color))]);
    for (const color of colors) {
      expect(OFF_PALETTE_HUES, `code token colour ${color} is outside the palette`).not.toContain(
        color,
      );
    }
  });

  test('an offline contact status uses body tones, not amber', async ({ page }) => {
    await gotoSettled(page, '/');
    const color = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'ctz-status';
      probe.dataset.online = 'false';
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    expect(OFF_PALETTE_HUES).not.toContain(color);
  });

  test('design-system inline code is body text in a signal border', async ({ page }) => {
    await gotoSettled(page, '/design-system/tokens');
    const chip = '.ds-prose :not(pre):not(td):not(th) > code';
    await expect(page.locator(chip).first()).toBeVisible();
    expect(await computed(page, chip, 'color')).toBe(BODY_RGB);
  });

  test('summary stack chips read as body text', async ({ page }) => {
    await gotoSettled(page, '/summary');
    for (const selector of ['.reading-chips li', '.reading-chips--ai li']) {
      expect(await computed(page, selector, 'color'), `${selector} is a 12px label`).toBe(BODY_RGB);
    }
  });
});

test.describe('no cyan or amber text, border or fill on public routes', () => {
  test.use({ viewport: DESKTOP });

  for (const route of SCANNED_ROUTES) {
    test(`${route} uses the signal, body and secondary ramps only`, async ({ page }) => {
      await gotoSettled(page, route);
      const offenders = await page.evaluate(
        ([hues, exempt]) => {
          const found: string[] = [];
          for (const node of document.body.querySelectorAll('*')) {
            if (node.matches(exempt)) continue;
            const style = getComputedStyle(node);
            const used = [
              style.color,
              style.backgroundColor,
              style.borderTopColor,
              style.borderLeftColor,
            ];
            if (used.some((value) => hues.includes(value))) {
              found.push(`${node.tagName.toLowerCase()}.${String(node.className).slice(0, 40)}`);
            }
          }
          return found.slice(0, 10);
        },
        [OFF_PALETTE_HUES, WINDOW_CHROME_DOT] as const,
      );
      expect(offenders, `${route} renders cyan or amber`).toEqual([]);
    });
  }
});
