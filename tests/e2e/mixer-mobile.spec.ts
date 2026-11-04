import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const SECTION_SELECTOR = '#sec-daw-mixer';
const DESKTOP_SELECTOR = '#sec-daw-mixer [data-testid="daw-mixer-desktop"]';
const MOBILE_SELECTOR = '#sec-daw-mixer [data-testid="daw-mixer-mobile"]';
const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE_PX = 1;
const MOBILE_PROJECTS = ['chromium-mobile', 'webkit-mobile'];
const CHANNEL_IDS = ['CH 01', 'CH 02', 'CH 03', 'CH 04', 'CH 05', 'MASTER'];

test('the DAW mixer is its own section directly below the guitar module', async ({ page }) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  const section = page.locator(SECTION_SELECTOR);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  await expect(section.locator('h2').first()).toContainText('./MIX --LIVE');
  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main section[id]')).map((el) => el.id),
  );
  const guitarIndex = order.indexOf('sec-guitar');
  expect(guitarIndex, 'the guitar module must render on the page').toBeGreaterThanOrEqual(0);
  expect(
    order[guitarIndex + 1],
    'the restored mixer section must render directly below the guitar module',
  ).toBe('sec-daw-mixer');
});

const OVERFLOW_WIDTHS = [320, 390, 768, 1280];

for (const width of OVERFLOW_WIDTHS) {
  test(`the restored mixer keeps the page inside the viewport at ${width}px`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await page.locator(SECTION_SELECTOR).scrollIntoViewIfNeeded();
    const result = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(
      result.scrollWidth,
      'the restored mixer must not push the page into horizontal scroll',
    ).toBeLessThanOrEqual(result.viewport + SUBPIXEL_TOLERANCE_PX);
  });
}

test('mobile UAs render the two-card mobile mixer with its own session header', async ({
  page,
}, testInfo) => {
  test.skip(
    !MOBILE_PROJECTS.includes(testInfo.project.name),
    'the mobile variant only ships to mobile user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(MOBILE_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toBeVisible();
  await expect(mixer.locator('[data-testid="session-header-mobile"]')).toContainText(
    'YELLOW_TAKE_03.ALS',
  );
  const cards = mixer.locator('[data-testid^="channel-mobile-"]');
  await expect(cards).toHaveCount(2);
  await expect(mixer.locator('[data-testid="channel-mobile-MASTER"]')).toHaveCount(0);
});

test('the cells of a mobile channel card share one left edge', async ({ page }, testInfo) => {
  test.skip(
    !MOBILE_PROJECTS.includes(testInfo.project.name),
    'the mobile variant only ships to mobile user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const card = page.locator('#sec-daw-mixer [data-testid="channel-mobile-CH 01"]');
  await card.scrollIntoViewIfNeeded();
  const lefts = await card.evaluate((node) =>
    Array.from(node.children)
      .filter((child) => child.getBoundingClientRect().height > 0)
      .map((child) => Math.round(child.getBoundingClientRect().left)),
  );
  expect(lefts.length).toBeGreaterThan(1);
  expect(new Set(lefts).size).toBe(1);
});

test('desktop UAs render the six-channel table with session and column headers', async ({
  page,
}, testInfo) => {
  test.skip(
    MOBILE_PROJECTS.includes(testInfo.project.name),
    'the desktop table only ships to desktop user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 1280, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(DESKTOP_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toBeVisible();
  await expect(mixer.locator('[data-testid="session-header"]')).toContainText('YELLOW_TAKE_03.ALS');
  for (const id of CHANNEL_IDS) {
    await expect(mixer.locator(`[data-testid="channel-${id}"]`)).toBeVisible();
  }
  const headerText = await mixer.locator('.daw-channel-row').first().textContent();
  for (const column of ['ID', 'TRACK', 'I/O', 'R/M/S', 'PLUGIN CHAIN', 'METER', 'FADER', 'dB']) {
    expect(headerText).toContain(column);
  }
});

test('no two cells of a desktop channel row overlap at 1280px', async ({ page }, testInfo) => {
  test.skip(
    MOBILE_PROJECTS.includes(testInfo.project.name),
    'the desktop table only ships to desktop user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 1280, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(DESKTOP_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

  const overlaps = await page.evaluate((selector) => {
    const found: string[] = [];
    for (const row of document.querySelectorAll(`${selector} .daw-channel-row`)) {
      const cells = Array.from(row.children).filter(
        (child) => child.getBoundingClientRect().width > 0,
      );
      for (const [index, first] of cells.entries()) {
        for (const second of cells.slice(index + 1)) {
          const a = first.getBoundingClientRect();
          const b = second.getBoundingClientRect();
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 1 && overlapY > 1) {
            found.push(`${row.getAttribute('data-testid')}: cell overlap`);
          }
        }
      }
    }
    return found;
  }, DESKTOP_SELECTOR);

  expect(overlaps, 'grid cells of a channel row must not share the same grid area').toEqual([]);
});
