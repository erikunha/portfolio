import { expect, test } from '@playwright/test';
import { lastLineOrphansIn } from './_helpers/line-words';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const KEEP_TAIL_MAX_CHARS = 8;
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 800 },
  { width: 768, height: 1024 },
] as const;

const SURFACES = [
  { route: '/cv', selector: '.reading-role' },
  { route: '/pt/cv', selector: '.reading-role' },
  { route: '/summary', selector: '.reading-role' },
  { route: '/pt/summary', selector: '.reading-role' },
  { route: '/links', selector: '.links-identity-tagline .tagline-sizer, .tagline-live' },
  { route: '/links/en', selector: '.links-identity-tagline .tagline-sizer, .tagline-live' },
  { route: '/', selector: '.ab-prose p' },
  { route: '/pt', selector: '.ab-prose p' },
] as const;

for (const { route, selector } of SURFACES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} ${selector} at ${viewport.width}px never ends on a lone short word`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await freezeMotion(page);
      await gotoSettled(page, route);
      expect(
        await lastLineOrphansIn(page, selector, KEEP_TAIL_MAX_CHARS),
        `the last two words of an identity or role line stay together up to ${KEEP_TAIL_MAX_CHARS} characters`,
      ).toEqual([]);
    });
  }
}
