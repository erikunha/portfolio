import { expect, test } from '@playwright/test';
import { gotoHydrated } from './_helpers/hydration';

const SITE_HEADER_CONTROL = '.menu-trigger';
const H1_LEVEL = 1;

const PAGES = [
  { path: '/', snapshot: 'home.aria.yml' },
  { path: '/cv', snapshot: 'cv.aria.yml' },
  { path: '/links', snapshot: 'links.aria.yml' },
  { path: '/design-system', snapshot: 'design-system.aria.yml' },
] as const;

for (const { path, snapshot } of PAGES) {
  test.describe(`aria structure ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoHydrated(page, path, SITE_HEADER_CONTROL);
    });

    test('landmarks and heading outline match the snapshot', async ({ page }) => {
      await expect(page.locator('body')).toMatchAriaSnapshot({ name: snapshot });
    });

    test('exactly one h1 holds the page title', async ({ page }) => {
      await expect(
        page.getByRole('heading', { level: H1_LEVEL }),
        'a second h1, or none, breaks the page outline assistive technology navigates by',
      ).toHaveCount(1);
    });
  });
}
