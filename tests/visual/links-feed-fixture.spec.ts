import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const FIXTURE_PATH = 'tests/e2e/fixtures/links-feed.json';
const fixture: { latest: { title: string } } = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

test('the build used E2E_LINKS_FEED_FIXTURE', async ({ page }) => {
  await page.goto('/links/en');
  await expect(
    page.getByText(fixture.latest.title).first(),
    'the build did not use E2E_LINKS_FEED_FIXTURE; rebuild with it set',
  ).toBeAttached();
});
