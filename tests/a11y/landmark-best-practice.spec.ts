import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { VIEWPORTS } from '../e2e/_helpers/geometry';
import { revealDeferredContent } from '../e2e/_helpers/snapshot';

const LANDMARK_RULES = ['landmark-complementary-is-top-level', 'region'];
const ROUTES = ['/', '/pt', '/design-system'];
const CHECKED_VIEWPORTS = { desktop: VIEWPORTS.DESKTOP, phone: VIEWPORTS.PHONE };

test.describe('every element sits in a top-level landmark (axe best practice)', () => {
  for (const [viewportName, viewport] of Object.entries(CHECKED_VIEWPORTS)) {
    for (const route of ROUTES) {
      test(`${route} at ${viewportName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(route);
        await revealDeferredContent(page);
        const results = await new AxeBuilder({ page }).withRules(LANDMARK_RULES).analyze();
        expect(
          results.violations.map((violation) => ({
            id: violation.id,
            targets: violation.nodes.map((node) => node.target.join(' ')),
          })),
        ).toEqual([]);
      });
    }
  }
});
