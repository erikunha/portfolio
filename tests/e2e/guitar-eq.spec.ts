import { expect, type Page, test } from '@playwright/test';
import { guitarRig } from '../../content/guitar-rig';
import { SITE_LOCALE } from '../../content/site-locale';
import { horizontalOverflow, VIEWPORTS as SHARED_VIEWPORTS } from './_helpers/geometry';

const STRIP = '[data-testid="eq-spectrum"]';
const BAR = `${STRIP} .eq-bar`;
const AXIS_TICK = `${STRIP} .eq-axis-tick`;
const LABEL = '#sec-guitar .guitar-chain-label';
const VIEWPORTS = [
  { width: 320, height: 700, visibleBars: 36 },
  { width: 390, height: 844, visibleBars: 36 },
  { width: 768, height: 900, visibleBars: 72 },
  { width: 1280, height: 720, visibleBars: 72 },
];
const SUBPIXEL_TOLERANCE = 1;
const NO_ANIMATION = 'none';

async function openStrip(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  const strip = page.locator(STRIP);
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toBeVisible();
  return strip;
}

for (const { width, height, visibleBars } of VIEWPORTS) {
  test.describe(`EQ strip at ${width}px`, () => {
    test('fits the viewport with every axis label inside the strip', async ({ page }) => {
      const strip = await openStrip(page, width, height);
      const stripBox = await strip.boundingBox();
      expect(stripBox).not.toBeNull();
      const ticks = await page.locator(AXIS_TICK).evaluateAll((nodes) =>
        nodes.map((node) => {
          const { left, right } = node.getBoundingClientRect();
          return { left, right };
        }),
      );
      expect(ticks.length).toBeGreaterThan(2);
      for (const tick of ticks) {
        expect(tick.left).toBeGreaterThanOrEqual((stripBox?.x ?? 0) - SUBPIXEL_TOLERANCE);
        expect(tick.right).toBeLessThanOrEqual(
          (stripBox?.x ?? 0) + (stripBox?.width ?? 0) + SUBPIXEL_TOLERANCE,
        );
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
    });

    test('keeps the gear label whole across lines', async ({ page }) => {
      await openStrip(page, width, height);
      const brokenWords = await page.locator(LABEL).evaluate((label) => {
        const broken: string[] = [];
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? '';
          for (const word of text.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, word.index ?? 0);
            range.setEnd(node, (word.index ?? 0) + word[0].length);
            const lines = new Set(
              Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
            );
            if (lines.size > 1) broken.push(word[0]);
          }
        }
        return broken;
      });
      expect(brokenWords).toEqual([]);
    });

    test('sits above the signal chain cards at the top of the module', async ({ page }) => {
      const strip = await openStrip(page, width, height);
      const chain = page.locator('#sec-guitar .guitar-chain');
      const stripBox = await strip.boundingBox();
      const chainBox = await chain.boundingBox();
      expect(stripBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(chainBox?.y ?? 0);
    });

    test('shows the bars the viewport has room for', async ({ page }) => {
      await openStrip(page, width, height);
      const shown = await page
        .locator(BAR)
        .evaluateAll(
          (bars) => bars.filter((bar) => getComputedStyle(bar).display !== 'none').length,
        );
      expect(shown).toBe(visibleBars);
    });
  });
}

test.describe('EQ strip motion', () => {
  const { DESKTOP } = SHARED_VIEWPORTS;

  async function firstBar(page: Page) {
    await openStrip(page, DESKTOP.width, DESKTOP.height);
    return page.locator(BAR).first();
  }

  test('bounces on the groove when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const bar = await firstBar(page);
    const name = await bar.evaluate((node) => getComputedStyle(node).animationName);
    expect(name).not.toBe(NO_ANIMATION);
  });

  test('holds one static frame under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const bar = await firstBar(page);
    await page.evaluate(() => document.body.removeAttribute('data-motion'));
    const style = await bar.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { name: computed.animationName, transform: computed.transform };
    });
    expect(style.name).toBe(NO_ANIMATION);
    expect(style.transform).toBe(NO_ANIMATION);
  });

  test('holds one static frame in print', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const bar = await firstBar(page);
    await page.emulateMedia({ media: 'print' });
    const name = await bar.evaluate((node) => getComputedStyle(node).animationName);
    expect(name).toBe(NO_ANIMATION);
  });

  test('holds one static frame when the MOTION switch is off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const bar = await firstBar(page);
    await page.evaluate(() => document.body.setAttribute('data-motion', 'reduce'));
    const name = await bar.evaluate((node) => getComputedStyle(node).animationName);
    expect(name).toBe(NO_ANIMATION);
  });
});

test('names the plot with the EQ bands for assistive technology', async ({ page }) => {
  await openStrip(page, 1280, 720);
  const plot = page.getByRole('img', { name: /Live spectrum of the lead guitar/ });
  await expect(plot).toHaveCount(1);
  await expect(plot).toHaveAttribute('aria-label', /140 Hz.*2\.8 kHz.*9 kHz/);
});

test('lays the strip out with grid and flex, never absolute positioning', async ({ page }) => {
  await openStrip(page, 1280, 720);
  const positioned = await page
    .locator(STRIP)
    .evaluate((strip) =>
      [strip, ...strip.querySelectorAll('*')]
        .filter((node) => !['static', 'relative'].includes(getComputedStyle(node).position))
        .map((node) => String(node.className)),
    );
  expect(positioned).toEqual([]);
});

test('puts each axis label on its frequency', async ({ page }) => {
  await openStrip(page, 1280, 720);
  const offsets = await page.locator(`${STRIP} .eq-axis-tick`).evaluateAll((ticks) => {
    const axis = ticks[0]?.parentElement?.getBoundingClientRect();
    return ticks.map((tick) => {
      const box = tick.getBoundingClientRect();
      return (box.left + box.width / 2 - (axis?.left ?? 0)) / (axis?.width ?? 1);
    });
  });
  const { axis, freqRange } = guitarRig[SITE_LOCALE.en].eqSpectrum;
  const inset = 0.05;
  const span = Math.log(freqRange.maxHz / freqRange.minHz);
  expect(offsets).toHaveLength(axis.length);
  axis.forEach((tick, index) => {
    const expected = inset + (1 - 2 * inset) * (Math.log(tick.freqHz / freqRange.minHz) / span);
    expect(offsets[index], `${tick.label} Hz tick sits at its log-frequency position`).toBeCloseTo(
      expected,
      2,
    );
  });
});

test.describe('EQ strip without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: SHARED_VIEWPORTS.DESKTOP });

  test('renders the strip and the signal chain from the server HTML', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator(STRIP);
    await expect(strip).toHaveCount(1);
    await expect(strip.locator('.eq-bar')).toHaveCount(72);
    await expect(page.locator(LABEL)).toHaveText(/LEAD · Gretsch G5655TG/);
    await expect(page.locator('#sec-guitar [data-testid^="signal-node-"]')).toHaveCount(3);
  });
});
