import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export const LINKS_FEED_FIXTURE_ENV = 'E2E_LINKS_FEED_FIXTURE';
export const LINKS_FEED_FIXTURE_PATH = 'tests/e2e/fixtures/links-feed.json';

const FIXTURE_FEED: { latest: { title: string } } = JSON.parse(
  readFileSync(LINKS_FEED_FIXTURE_PATH, 'utf8'),
);

export const LINKS_FEED_FIXTURE_MISSING = `the build did not use ${LINKS_FEED_FIXTURE_ENV}=${LINKS_FEED_FIXTURE_PATH}, so /links/en rendered live YouTube data and its baseline cannot match; rebuild with it set`;

export async function expectLinksFeedFixture(page: Page): Promise<void> {
  await expect(
    page.getByText(FIXTURE_FEED.latest.title).first(),
    LINKS_FEED_FIXTURE_MISSING,
  ).toBeAttached();
}
