import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';

const PHONES = [VIEWPORTS.PHONE_NARROW, VIEWPORTS.PHONE] as const;
const PATHS = ['/', '/pt'] as const;
const SCROLL_STEP_PX = 80;

test.describe('the back-to-top button never sits on footer text', () => {
  for (const viewport of PHONES) {
    for (const path of PATHS) {
      test(`${path} at ${viewport.width}px: scrolling through the footer keeps its text clear`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(path);

        const covered = await page.evaluate(
          async ({ step }) => {
            const button = document.querySelector('.to-top-btn') as HTMLElement;
            const footer = document.querySelector('.site-footer') as HTMLElement;
            const first = footer.getBoundingClientRect().top + window.scrollY - window.innerHeight;
            const last = document.documentElement.scrollHeight - window.innerHeight;
            const found: string[] = [];
            for (let y = Math.max(first, 0); y <= last + step; y += step) {
              window.scrollTo(0, Math.min(y, last));
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              );
              const zone = button.getBoundingClientRect();
              const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const text = node.textContent?.trim() ?? '';
                const parent = node.parentElement;
                if (!text || !parent?.checkVisibility({ checkVisibilityCSS: true })) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) {
                  const overlaps =
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.left < zone.right &&
                    rect.right > zone.left &&
                    rect.top < zone.bottom &&
                    rect.bottom > zone.top;
                  if (overlaps) found.push(`${Math.round(window.scrollY)}: ${text.slice(0, 30)}`);
                }
              }
            }
            return found;
          },
          { step: SCROLL_STEP_PX },
        );

        expect(covered, 'footer text under the floating button').toEqual([]);
      });
    }
  }
});
