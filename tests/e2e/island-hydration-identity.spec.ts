import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';
import { drainRoutes } from './_helpers/routes';

const ISLAND_DELAY_MS = 2500;
const ISLAND_CHUNK_MARKERS = ['contact-count', 'shell-form'];
const CHUNK_URL_PATTERN = '**/_next/static/chunks/**/*.js';
const CURRENT_ITEM_SELECTOR = '#section-nav [aria-current]';
const IDENTITY_KEY = '__serverNode';

type Island = {
  name: string;
  sectionId: string;
  formSelector: string;
  inputSelector: string;
};

const ISLANDS: Island[] = [
  {
    name: 'contact form',
    sectionId: 'sec-contact',
    formSelector: '[data-testid="contact-form"]',
    inputSelector: 'input[name="email"]',
  },
  {
    name: 'interactive shell',
    sectionId: 'sec-shell',
    formSelector: '[data-testid="shell-form"]',
    inputSelector: '[aria-label="shell command"]',
  },
];

async function delayIslandChunks(page: Page): Promise<string[]> {
  const delayed: string[] = [];
  await page.route(CHUNK_URL_PATTERN, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (ISLAND_CHUNK_MARKERS.some((marker) => body.includes(marker))) {
      delayed.push(route.request().url());
      await new Promise((resolve) => setTimeout(resolve, ISLAND_DELAY_MS));
    }
    await route.fulfill({ response, body });
  });
  return delayed;
}

test.afterEach(({ page }) => drainRoutes(page));

for (const island of ISLANDS) {
  test(`the server-rendered ${island.name} input is the same node after hydration`, async ({
    page,
  }) => {
    const delayed = await delayIslandChunks(page);
    await page.goto('/', { waitUntil: 'commit' });
    const input = page.locator(island.inputSelector);
    await input.waitFor({ state: 'attached' });
    await input.evaluate((node, key) => {
      Object.assign(node, { [key]: true });
    }, IDENTITY_KEY);

    await page.locator(`#${island.sectionId}`).scrollIntoViewIfNeeded();
    await page.waitForFunction(
      ([selector, id]) => document.querySelector(selector)?.getAttribute('href')?.endsWith(id),
      [CURRENT_ITEM_SELECTOR, `#${island.sectionId}`] as const,
    );
    await waitForHydration(page, island.formSelector);

    expect(
      delayed.length,
      'no island chunk was delayed: the chunk markers no longer match the built islands, so this test would pass without exercising hydration order',
    ).toBeGreaterThan(0);
    expect(
      await page.locator(island.inputSelector).evaluate((node, key) => key in node, IDENTITY_KEY),
      `the ${island.name} input was replaced during hydration: a context value above the dehydrated Suspense boundary changed when its section became current, so React discarded the server DOM and client-rendered the island`,
    ).toBe(true);
  });
}
