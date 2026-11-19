import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const PAGE_SKIP_LINK = 'a.skip-to-content';
const PAGES = ['/', '/pt'] as const;

for (const path of PAGES) {
  test(`${path} has exactly one page skip link`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto(path);
    await page.waitForSelector('main#main-content', { state: 'attached' });
    await expect(page.locator(PAGE_SKIP_LINK)).toHaveCount(1);
  });
}
