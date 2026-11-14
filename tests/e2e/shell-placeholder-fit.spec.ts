import { expect, type Locator, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { freezeMotion } from './_helpers/motion';
import { openShell } from './_helpers/shell';

const WIDTHS = [320, 375, 768, 1280] as const;
const VIEWPORT_HEIGHT = 844;
const TABLET_WIDTH = 768;
const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const PLACEHOLDER = '[data-testid="shell-placeholder"]';
const PLACEHOLDER_TEXT = `${PLACEHOLDER} > span:first-child`;
const LOOP_STEP_MS = 250;
const LOOP_DURATION_MS = 24_000;
const FIRST_TICK_MS = 1000;

type Clip = { clipped: boolean; text: string };

function readClip(text: Locator): Promise<Clip> {
  return text.evaluate((node) => {
    const box = node.parentElement?.getBoundingClientRect();
    const own = node.getBoundingClientRect();
    return {
      clipped: node.scrollWidth > node.clientWidth || (box ? own.right > box.right + 0.5 : false),
      text: node.textContent ?? '',
    };
  });
}

async function sampleLoop(page: Page): Promise<Clip[]> {
  const text = page.locator(PLACEHOLDER_TEXT);
  const samples: Clip[] = [];
  for (let elapsed = 0; elapsed < LOOP_DURATION_MS; elapsed += LOOP_STEP_MS) {
    await page.clock.runFor(LOOP_STEP_MS);
    samples.push(await readClip(text));
  }
  return samples;
}

for (const width of WIDTHS) {
  for (const locale of Object.values(SITE_LOCALE)) {
    test.describe(`the shell placeholder at ${width}px (${locale})`, () => {
      const touch = width < TABLET_WIDTH;
      test.use({
        viewport: { width, height: VIEWPORT_HEIGHT },
        isMobile: touch,
        hasTouch: touch,
      });

      test('the resting placeholder is shown whole', async ({ page }) => {
        await freezeMotion(page);
        await openShell(page, PATHS[locale]);
        const text = page.locator(PLACEHOLDER_TEXT);
        await expect(text).toBeVisible();
        const clip = await readClip(text);
        expect(clip.clipped, `"${clip.text}" is cut by the input edge`).toBe(false);
      });

      test('every phrase the typing loop shows fits the input', async ({ page }) => {
        await page.clock.install();
        await openShell(page, PATHS[locale]);
        await page.clock.pauseAt(Date.now() + FIRST_TICK_MS);
        const samples = await sampleLoop(page);
        const cut = [...new Set(samples.filter((sample) => sample.clipped).map((s) => s.text))];
        expect(cut, 'phrases wider than the input').toEqual([]);
        expect(new Set(samples.map((sample) => sample.text)).size).toBeGreaterThan(1);
      });
    });
  }
}
