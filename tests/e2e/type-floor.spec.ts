import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/', '/links', '/design-system'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
];
const ROOT_FONT_PX = 16;
const REM = 'rem';

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`no visible text is set below the --text-min floor on ${route} at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, route);
      const { floor, offenders } = await page.evaluate(
        ([rootPx, rem]) => {
          const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-min')
            .trim();
          const floorPx = raw.endsWith(rem)
            ? Number.parseFloat(raw) * (rootPx as number)
            : Number.parseFloat(raw);
          const found: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const box = el.getBoundingClientRect();
            if (box.width <= 1 || box.height <= 1) continue;
            const ownText = [...el.childNodes].some(
              (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
            );
            if (!ownText) continue;
            const size = Number.parseFloat(style.fontSize);
            if (size < floorPx) {
              found.push(
                `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${size}px`,
              );
            }
          }
          return { floor: floorPx, offenders: found };
        },
        [ROOT_FONT_PX, REM] as const,
      );
      expect(floor, '--text-min must resolve to a pixel size').toBeGreaterThan(0);
      expect(
        offenders,
        `text smaller than --text-min (${floor}px) is off the type scale; use a --text-* token`,
      ).toEqual([]);
    });
  }
}
