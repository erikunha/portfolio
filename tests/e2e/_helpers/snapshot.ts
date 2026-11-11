import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { volatileMasks } from './mask-volatile';
import {
  compareVisual,
  VISUAL_INK_BAND_FLOOR,
  VISUAL_NOISE_FLOOR,
  VISUAL_SIZE_TOLERANCE_PX,
} from './visual-compare';

const SNAPSHOT_TIMEOUT_MS = 30_000;
const HIDE_DECORATIVE_CANVAS = fileURLToPath(
  new URL('./hide-decorative-canvas.css', import.meta.url),
);

export async function revealDeferredContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-cv-defer]')) {
      (el as HTMLElement).style.setProperty('content-visibility', 'visible');
    }
    for (const el of document.querySelectorAll('nextjs-portal')) el.remove();
  });
}

/**
 * Where the baseline of a screenshot lives: the snapshot directory of the test
 * file, named after the screenshot, the project and the platform, the same way
 * Playwright names it.
 */
function baselinePath(name: string): string {
  const info = test.info();
  const stem = name.replace(/\.png$/, '');
  return join(info.snapshotDir, `${stem}-${info.project.name}-${process.platform}.png`);
}

async function captureOptions(page: Page) {
  await page.addStyleTag({ path: HIDE_DECORATIVE_CANVAS });
  return {
    mask: volatileMasks(page),
    animations: 'disabled' as const,
    scale: 'css' as const,
    timeout: SNAPSHOT_TIMEOUT_MS,
  };
}

/**
 * The gate compares a render made now against the baseline captured in an
 * earlier run, possibly on another runner instance. The page lays text out on
 * fractional line boxes, so two runners can round the same box to different
 * device pixels: one pixel of height and one pixel of shift, which moves every
 * glyph. Playwright refuses any image whose size differs by a single pixel and
 * no pixel tolerance covers that, so the comparison lines the two up, allows a
 * small difference in size, and fails on what is left.
 *
 * Two signals decide the outcome: the pixels, which catch a layout that moved,
 * and the ink of each strip, which catch a wording that changed even when the
 * layout stayed where it was.
 */
async function compare(
  page: Page,
  capture: () => Promise<Buffer>,
  name: string,
  options?: { maxDiffRatio?: number },
): Promise<void> {
  const path = baselinePath(name);
  const actual = await capture();
  const update = test.info().config.updateSnapshots;

  if (update === 'all' || update === 'changed' || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
    return;
  }

  const expected = readFileSync(path);
  const comparison = await compareVisual(page, actual, expected);
  const limit = options?.maxDiffRatio ?? VISUAL_NOISE_FLOOR;
  const { width, height } = comparison.sizeDelta;
  const ratio = comparison.ratio;
  const loudestInkBand = comparison.inkBands[0];

  if (
    width > VISUAL_SIZE_TOLERANCE_PX ||
    height > VISUAL_SIZE_TOLERANCE_PX ||
    ratio > limit ||
    (loudestInkBand !== undefined && loudestInkBand.ratio > VISUAL_INK_BAND_FLOOR)
  ) {
    const output = test.info().outputPath('visual');
    const stem = name.replace(/\.png$/, '');
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${stem}-actual.png`), actual);
    writeFileSync(join(output, `${stem}-expected.png`), expected);
  }

  expect(
    width,
    `the render is ${width}px wider than the baseline, so the layout moved`,
  ).toBeLessThanOrEqual(VISUAL_SIZE_TOLERANCE_PX);
  expect(
    height,
    `the render is ${height}px taller than the baseline, so the layout moved`,
  ).toBeLessThanOrEqual(VISUAL_SIZE_TOLERANCE_PX);
  expect(
    ratio,
    `${(ratio * 100).toFixed(2)}% of the pixels differ after lining the render up with the baseline`,
  ).toBeLessThanOrEqual(limit);
  expect(
    loudestInkBand?.ratio ?? 0,
    loudestInkBand === undefined
      ? 'the render carries no ink to compare'
      : `${(loudestInkBand.ratio * 100).toFixed(2)}% of the strip at y=${loudestInkBand.top} carries different ink, so the wording there changed`,
  ).toBeLessThanOrEqual(VISUAL_INK_BAND_FLOOR);
}

export async function snapshot(page: Page, name: string): Promise<void> {
  await revealDeferredContent(page);
  const options = await captureOptions(page);
  await compare(page, () => page.screenshot(options), name);
}

export async function snapshotLocator(
  page: Page,
  locator: Locator,
  name: string,
  options?: { maxDiffRatio?: number },
): Promise<void> {
  await revealDeferredContent(page);
  const captureOptionsForLocator = await captureOptions(page);
  await compare(page, () => locator.screenshot(captureOptionsForLocator), name, options);
}
