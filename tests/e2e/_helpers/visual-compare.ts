import type { Page } from '@playwright/test';

/**
 * The visual gate compares a render made now against a PNG captured in an
 * earlier CI run, on a different runner instance. The page lays text out on
 * fractional line boxes (the design system runs 1.55 and 1.5 line heights), so
 * two runners can round the same box to different device pixels: the measured
 * difference on this repository is one pixel of height and one pixel of
 * vertical shift, which moves every glyph and lands at 2% to 7% of the pixels.
 *
 * Playwright's own comparison refuses any image whose size differs by a single
 * pixel, and no pixel tolerance covers that. So the gate compares the two
 * images itself, on two signals:
 *
 * - the pixels, band by band, which catches a layout that moved or a colour
 *   that changed;
 * - the ink, band by band, which catches a wording that changed even when the
 *   layout stayed exactly where it was.
 *
 * The second signal is what keeps the gate honest about content: the headline
 * of the hero changed from "Senior AI Engineer" to "Senior Software Engineer,
 * AI Engineer" and that change moves 1.4% of the pixels, which the pixel
 * signal alone would let through.
 */

/** How far the two renders may differ in size, in pixels. */
export const VISUAL_SIZE_TOLERANCE_PX = 2;

/** How far the render may be shifted before the comparison lines it up. */
export const VISUAL_MAX_SHIFT_PX = 2;

/**
 * The share of pixels that may differ once the render is lined up band by band.
 * Measured on this repository: the same content rendered on two runner
 * instances lands between 0.23% and 0.89%, while a real change lands at 19%
 * (the hero headline, its stat tile and the reflow that follows).
 */
export const VISUAL_NOISE_FLOOR = 0.02;

/**
 * The share of one strip that may carry different ink before the strip reads as
 * changed wording. Measured on this repository: the same content rendered on
 * two runner instances lands at 2.68% in its worst strip (a monospace log
 * block), a headline that changed wording lands at 8.07% in one strip, and a
 * layout that moved lands at 44%.
 */
export const VISUAL_INK_BAND_FLOOR = 0.045;

/** The height of the band the comparison lines up on its own. */
const BAND_HEIGHT_PX = 32;

/** How far a single pixel may drift in one channel before it counts as different. */
const CHANNEL_TOLERANCE = 16;

/** The share of the brightest value a pixel needs to count as ink. */
const INK_THRESHOLD = 0.35;

export interface VisualBand {
  /** Where the strip starts, in pixels from the top. */
  top: number;
  /** The share of the strip that differs. */
  ratio: number;
}

export interface VisualComparison {
  /** The share of pixels that differ, after lining the two renders up. */
  ratio: number;
  /** The shift, in pixels, that lined most of the bands up. */
  dx: number;
  dy: number;
  /** How many bands each shift lined up. */
  shifts: Record<string, number>;
  /** The share of the whole render whose ink differs. */
  inkRatio: number;
  /** The strips whose ink differs, from the loudest down. */
  inkBands: VisualBand[];
  /** How much the two renders differ in size, in pixels. */
  sizeDelta: { width: number; height: number };
  /** The share of pixels compared. */
  compared: number;
}

export async function compareVisual(
  page: Page,
  actual: Buffer,
  expected: Buffer,
): Promise<VisualComparison> {
  const result = await page.evaluate(
    async ({
      actual: actualUrl,
      expected: expectedUrl,
      maxShift,
      bandHeight: bandHeightPx,
      channelTolerance,
      inkThreshold,
    }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('a screenshot could not be decoded'));
          image.src = src;
        });

      const [actualImage, expectedImage] = await Promise.all([load(actualUrl), load(expectedUrl)]);

      const pixels = (image: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('the page has no 2d canvas context');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };

      const actualData = pixels(actualImage);
      const expectedData = pixels(expectedImage);
      const channel = (data: Uint8ClampedArray, index: number) => data[index] ?? 0;

      const width = Math.min(actualImage.width, expectedImage.width);
      const height = Math.min(actualImage.height, expectedImage.height);

      /**
       * Ink is what carries the wording: every pixel brighter than a share of
       * the brightest pixel of its own render. The share is taken from the
       * render itself so the signal works on a dark page and on a light one.
       */
      const inkMask = (image: HTMLImageElement, data: Uint8ClampedArray) => {
        let brightest = 0;
        for (let index = 0; index < data.length; index += 4) {
          const luminance =
            channel(data, index) * 0.3 +
            channel(data, index + 1) * 0.59 +
            channel(data, index + 2) * 0.11;
          if (luminance > brightest) brightest = luminance;
        }
        const threshold = brightest * inkThreshold;
        const mask = new Uint8Array(width * height);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = (y * image.width + x) * 4;
            const luminance =
              channel(data, index) * 0.3 +
              channel(data, index + 1) * 0.59 +
              channel(data, index + 2) * 0.11;
            mask[y * width + x] = luminance > threshold ? 1 : 0;
          }
        }
        return mask;
      };

      const actualInk = inkMask(actualImage, actualData);
      const expectedInk = inkMask(expectedImage, expectedData);

      /**
       * Whether the ink reaches a pixel or the row above and below it. A
       * glyph that moved by a pixel vertically still has ink in the row next
       * door, so a pixel only counts as changed when the other render has no
       * ink in that column at all. The tolerance is vertical on purpose: the
       * runners disagree on how tall a line box is, not on where a letter
       * sits sideways.
       */
      const inkNear = (mask: Uint8Array, y: number, x: number) => {
        for (let oy = -1; oy <= 1; oy += 1) {
          const ny = y + oy;
          if (ny < 0 || ny >= height) continue;
          if (mask[ny * width + x] === 1) return true;
        }
        return false;
      };

      const bandDiff = (bandTop: number, bandHeight: number, dy: number) => {
        const bandWidth = width;
        const bandHeightPx = Math.min(
          bandHeight,
          actualImage.height - bandTop,
          expectedImage.height - bandTop - dy,
        );
        if (bandWidth <= 0 || bandHeightPx <= 0) {
          return { different: 0, inkDifferent: 0, compared: 0 };
        }
        let different = 0;
        let inkDifferent = 0;
        for (let y = 0; y < bandHeightPx; y += 1) {
          const actualRow = (bandTop + y) * actualImage.width * 4;
          const expectedRow = (bandTop + y + dy) * expectedImage.width * 4;
          const inkRow = (bandTop + y) * width;
          const expectedInkRow = (bandTop + y + dy) * width;
          for (let x = 0; x < bandWidth; x += 1) {
            const actualIndex = actualRow + x * 4;
            const expectedIndex = expectedRow + x * 4;
            const red = Math.abs(
              channel(actualData, actualIndex) - channel(expectedData, expectedIndex),
            );
            const green = Math.abs(
              channel(actualData, actualIndex + 1) - channel(expectedData, expectedIndex + 1),
            );
            const blue = Math.abs(
              channel(actualData, actualIndex + 2) - channel(expectedData, expectedIndex + 2),
            );
            if (red > channelTolerance || green > channelTolerance || blue > channelTolerance) {
              different += 1;
            }
            const actualInkPixel = actualInk[inkRow + x] === 1;
            const expectedInkPixel = expectedInk[expectedInkRow + x] === 1;
            if (actualInkPixel !== expectedInkPixel) {
              const other = actualInkPixel ? expectedInk : actualInk;
              const otherY = actualInkPixel ? bandTop + y + dy : bandTop + y;
              if (!inkNear(other, otherY, x)) inkDifferent += 1;
            }
          }
        }
        return {
          different,
          inkDifferent,
          compared: bandWidth * bandHeightPx,
        };
      };

      // The render and the baseline are lined up band by band: a run that
      // rounds a line box one pixel differently shifts everything below it, and
      // a band that moves on its own says so. What is left after the bands
      // line up is what actually changed.
      let different = 0;
      let inkDifferent = 0;
      let compared = 0;
      const shifts: Record<string, number> = {};
      const inkBands: Array<{ top: number; ratio: number }> = [];

      for (let bandTop = 0; bandTop < height; bandTop += bandHeightPx) {
        const bandHeight = Math.min(bandHeightPx, height - bandTop);
        // Each signal lines the band up on its own: the pixels care about the
        // colours lining up, the ink cares about the glyphs lining up.
        let bestPixels = { different: Number.POSITIVE_INFINITY, compared: 0, dy: 0 };
        let bestInk = { inkDifferent: Number.POSITIVE_INFINITY, compared: 0, dy: 0 };
        for (let dy = -maxShift; dy <= maxShift; dy += 1) {
          const band = bandDiff(bandTop, bandHeight, dy);
          if (band.different < bestPixels.different) {
            bestPixels = { different: band.different, compared: band.compared, dy };
          }
          if (band.inkDifferent < bestInk.inkDifferent) {
            bestInk = { inkDifferent: band.inkDifferent, compared: band.compared, dy };
          }
        }
        different += bestPixels.different;
        inkDifferent += bestInk.inkDifferent;
        compared += width * bandHeight;
        const key = String(bestPixels.dy);
        shifts[key] = (shifts[key] ?? 0) + 1;
        if (bestInk.compared > 0) {
          inkBands.push({ top: bandTop, ratio: bestInk.inkDifferent / bestInk.compared });
        }
      }

      // The shift that lined up the most bands is the shift the render moved by.
      let dy = 0;
      let mostBands = -1;
      for (const [key, count] of Object.entries(shifts)) {
        if (count > mostBands) {
          mostBands = count;
          dy = Number(key);
        }
      }

      return {
        ratio: compared > 0 ? different / compared : 1,
        dx: 0,
        dy,
        shifts,
        inkRatio: compared > 0 ? inkDifferent / compared : 1,
        inkBands: [...inkBands].sort((a, b) => b.ratio - a.ratio),
        sizeDelta: {
          width: Math.abs(actualImage.width - expectedImage.width),
          height: Math.abs(actualImage.height - expectedImage.height),
        },
        compared,
      };
    },
    {
      actual: `data:image/png;base64,${actual.toString('base64')}`,
      expected: `data:image/png;base64,${expected.toString('base64')}`,
      maxShift: VISUAL_MAX_SHIFT_PX,
      bandHeight: BAND_HEIGHT_PX,
      channelTolerance: CHANNEL_TOLERANCE,
      inkThreshold: INK_THRESHOLD,
    },
  );

  return result;
}
