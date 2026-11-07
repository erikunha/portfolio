import { expect, type Page } from '@playwright/test';

const STREAM_SETTLE_TIMEOUT_MS = 20_000;
export const PENDING_STREAMED = [
  'template[id^="B:"]',
  '[hidden][id^="S:"]',
  '#sec-live-metrics [aria-busy="true"]',
  '#sec-live-perf [aria-busy="true"]',
  '[data-col$="-loading"]',
].join(', ');

export async function gotoSettled(
  page: Page,
  path: string,
  options?: Parameters<Page['goto']>[1],
): Promise<ReturnType<Page['goto']>> {
  const response = await page.goto(path, options);
  await expect(
    page.locator(PENDING_STREAMED),
    'the streamed boundaries must swap in before the page is measured: until then the DOM holds a fallback that React removes mid-read',
  ).toHaveCount(0, { timeout: STREAM_SETTLE_TIMEOUT_MS });
  return response;
}
