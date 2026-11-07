import { expect, test } from '@playwright/test';
import { heightOf } from './_helpers/geometry';

const NOTICE = '.offline-notice';

test('going offline shows the no signal notice without moving the page', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator(NOTICE)).toBeEmpty();
  const before = await heightOf(page, 'body');
  await context.setOffline(true);
  await expect(page.locator(NOTICE)).toContainText('○ NO SIGNAL');
  await expect(page.locator(NOTICE)).toContainText('you are offline');
  expect(await heightOf(page, 'body')).toBe(before);
  await context.setOffline(false);
  await expect(page.locator(NOTICE)).toBeEmpty();
});
