import { WIDTH } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';
import { expect, test } from './_helpers/test';

const PAGES = ['/', '/pt'] as const;
const WIDTHS = [
  WIDTH.PHONE_NARROW,
  WIDTH.PHONE_ANDROID,
  WIDTH.PHONE_COMPACT,
  WIDTH.PHONE,
  WIDTH.PHONE_WIDE,
  WIDTH.TABLET,
  WIDTH.LAPTOP,
  WIDTH.DESKTOP,
] as const;
const VIEWPORT_HEIGHT = 900;
const LABEL = '[data-testid="hero-stats-item"] .stat-tile-label';
const WORD = /[^\s\-‐-―]+-?/g;

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px keeps every hero stat label word whole`, {
      tag: '@cross-browser',
    }, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, path);
      const split = await page.evaluate(
        ([selector, source]) => {
          const wordPattern = new RegExp(String(source), 'g');
          const broken: string[] = [];
          let measured = 0;
          for (const label of document.querySelectorAll(String(selector))) {
            if (label.getClientRects().length === 0) continue;
            if (label.scrollWidth > label.clientWidth)
              broken.push(`${label.textContent}: overflows`);
            const text = label.firstChild;
            if (!text || text.nodeType !== Node.TEXT_NODE) continue;
            for (const match of (text.textContent ?? '').matchAll(wordPattern)) {
              const range = document.createRange();
              range.setStart(text, match.index ?? 0);
              range.setEnd(text, (match.index ?? 0) + match[0].length);
              const lines = new Set([...range.getClientRects()].map((box) => Math.round(box.top)));
              measured += 1;
              if (lines.size > 1) broken.push(`${label.textContent}: ${match[0]}`);
            }
          }
          return { broken, measured };
        },
        [LABEL, WORD.source],
      );
      expect(split.measured, 'the hero stat labels were not measured').toBeGreaterThan(0);
      expect(split.broken, 'a hero stat label word runs over two lines').toEqual([]);
    });
  }
}
