import { expect, test } from '@playwright/test';
import { expectStableFor, heightOf } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';

const NOTICE = '.offline-notice';

test('going offline shows the no signal notice without moving the page', async ({
  page,
  context,
}) => {
  await gotoSettled(page, '/');
  await expect(page.locator(NOTICE)).toBeEmpty();
  await expectStableFor(() => heightOf(page, 'body'));
  const before = await heightOf(page, 'body');
  await context.setOffline(true);
  await expect(page.locator(NOTICE)).toContainText('○ NO SIGNAL');
  await expect(page.locator(NOTICE)).toContainText('you are offline');
  expect(
    await heightOf(page, 'body'),
    'the offline notice is position: fixed, so the body height must not change when it appears. A change means the page moved: either the notice entered the flow, or the baseline was read before the layout settled (self-hosted font still swapping, streamed sections still resolving) and the page changed under the test.',
  ).toBe(before);
  await context.setOffline(false);
  await expect(page.locator(NOTICE)).toBeEmpty();
});
