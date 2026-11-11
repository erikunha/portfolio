import { expect, type Page, test } from '@playwright/test';
import {
  compareVisual,
  VISUAL_INK_BAND_FLOOR,
  VISUAL_MAX_SHIFT_PX,
  VISUAL_NOISE_FLOOR,
  VISUAL_SIZE_TOLERANCE_PX,
} from './_helpers/visual-compare';

/**
 * The visual gate has to tell two things apart: a render that moved because
 * the runner rounded a line box differently, and a render that changed because
 * the page changed. This holds the comparison to both.
 */

interface RenderOptions {
  /** How far the whole render is pushed up, in pixels. */
  shiftY: number;
  /** How far the content moved down, in pixels. */
  offsetY: number;
  /** Whether the headline carries the other wording. */
  changed: boolean;
  /** How much taller the render is, in pixels. */
  heightDelta: number;
}

/**
 * A synthetic render shaped like the sections the gate photographs: a headline
 * block over a column of body lines, cropped to the content the way an element
 * screenshot is.
 */
async function render(page: Page, options: RenderOptions): Promise<Buffer> {
  const dataUrl = await page.evaluate((opts) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 300 + opts.heightDelta;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('the page has no 2d canvas context');
    context.fillStyle = '#04140b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#00ff87';
    context.font = 'bold 28px monospace';
    const headline = opts.changed
      ? 'Erik Cunha is a Senior AI Engineer, Applied Intelligence'
      : 'Erik Cunha is a Senior Software Engineer, AI Engineer';
    context.fillText(headline, 16, 34 + opts.offsetY + opts.shiftY);
    context.fillText(
      'TypeScript, Python, React, Next.js, AWS, LLM Systems',
      16,
      68 + opts.offsetY + opts.shiftY,
    );
    context.font = '14px monospace';
    for (let row = 0; row < 8; row += 1) {
      context.fillText(
        'The site and the resume carry the same compound title for the same person',
        16,
        116 + opts.offsetY + opts.shiftY + row * 20,
      );
    }
    return canvas.toDataURL('image/png');
  }, options);

  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('the canvas produced no image data');
  return Buffer.from(base64, 'base64');
}

const BASELINE: RenderOptions = { shiftY: 0, offsetY: 0, changed: false, heightDelta: 0 };

test.describe('visual comparison', () => {
  test('the same render matches itself', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const comparison = await compareVisual(page, expected, expected);
    expect(comparison.ratio).toBe(0);
    expect(comparison.inkRatio).toBe(0);
    expect(comparison.sizeDelta).toEqual({ width: 0, height: 0 });
  });

  test('a render that moved by a pixel is not a change', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const moved = await render(page, { ...BASELINE, shiftY: -1 });
    const comparison = await compareVisual(page, moved, expected);
    expect(comparison.sizeDelta.height).toBeLessThanOrEqual(VISUAL_SIZE_TOLERANCE_PX);
    expect(comparison.ratio, 'the pixel that moved must not read as a change').toBeLessThanOrEqual(
      VISUAL_NOISE_FLOOR,
    );
    expect(
      comparison.inkBands[0]?.ratio ?? 0,
      'the strip that moved must not read as a change',
    ).toBeLessThanOrEqual(VISUAL_INK_BAND_FLOOR);
    expect(
      Math.abs(comparison.dy),
      'the comparison lines the moved render up instead of reading it as a change',
    ).toBe(1);
  });

  test('a wording that changed is a change', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const changed = await render(page, { ...BASELINE, changed: true });
    const comparison = await compareVisual(page, changed, expected);
    expect(
      comparison.inkBands[0]?.ratio ?? 0,
      'the wording that changed must read as a change',
    ).toBeGreaterThan(VISUAL_INK_BAND_FLOOR);
  });

  test('a layout that moved is a change', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const moved = await render(page, { ...BASELINE, offsetY: 40 });
    const comparison = await compareVisual(page, moved, expected);
    expect(comparison.sizeDelta.height).toBeLessThanOrEqual(VISUAL_SIZE_TOLERANCE_PX);
    expect(comparison.ratio, 'the layout that moved must read as a change').toBeGreaterThan(
      VISUAL_NOISE_FLOOR,
    );
  });

  test('a render that grew past the tolerance is reported', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const grown = await render(page, { ...BASELINE, heightDelta: 9 });
    const comparison = await compareVisual(page, grown, expected);
    expect(comparison.sizeDelta.height).toBeGreaterThan(VISUAL_SIZE_TOLERANCE_PX);
  });

  test('the shift it lines up is bounded', async ({ page }) => {
    const expected = await render(page, BASELINE);
    const comparison = await compareVisual(page, expected, expected);
    expect(Math.abs(comparison.dy)).toBeLessThanOrEqual(VISUAL_MAX_SHIFT_PX);
  });
});
