import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { scrollThroughPage, translucentSurfaces } from './_helpers/surfaces';

const SECTION_IDS = [
  'bio',
  'sec-readme',
  'sec-shell',
  'sec-live-metrics',
  'sec-projects',
  'sec-git-log',
  'sec-hottest-takes',
  'sec-guitar',
  'sec-contact',
  'shutdown',
] as const;

const SURFACE_VIEWPORTS = [
  { name: 'desktop', size: VIEWPORTS.DESKTOP },
  { name: 'phone', size: VIEWPORTS.PHONE },
] as const;

async function loadEverySection(page: Page): Promise<void> {
  await page.goto('/');
  await scrollThroughPage(page);
}

test.describe('home section surfaces are opaque', () => {
  for (const { name, size } of SURFACE_VIEWPORTS) {
    test.describe(`${name} viewport`, () => {
      for (const sectionId of SECTION_IDS) {
        test(`${sectionId} panel and cards sit on an opaque backing`, async ({ page }) => {
          await page.setViewportSize(size);
          await loadEverySection(page);
          const offenders = await translucentSurfaces(page, `#${sectionId}`);
          expect(offenders, `${sectionId} exists`).not.toBeNull();
          expect(
            offenders,
            `Matrix Rain shows through ${sectionId}: every bordered or tinted surface needs an opaque background on itself or an ancestor inside the section`,
          ).toEqual([]);
        });
      }
    });
  }
});
