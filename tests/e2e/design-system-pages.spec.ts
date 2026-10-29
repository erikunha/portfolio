import { expect, test } from '@playwright/test';
import { DS_NAV_GROUPS } from '@/app/design-system/_components/ds-nav';
import { PREVIEW_SOURCE_ARIA_LABEL_FALLBACK } from '@/app/design-system/_components/preview.constants';

const OVERVIEW_PATH = '/design-system';
const OVERVIEW_HEADING = 'DESIGN SYSTEM';
const REFERENCE_GROUP_EXCLUDED_ID = 'pages';

const toRoute = (link: { href: string; label: string }) => ({
  path: link.href,
  heading: link.href === OVERVIEW_PATH ? OVERVIEW_HEADING : link.label,
});

const ALL_ROUTES = DS_NAV_GROUPS.flatMap((group) => group.links.map(toRoute));

const REFERENCE_ROUTES = DS_NAV_GROUPS.filter(
  (group) => group.id !== REFERENCE_GROUP_EXCLUDED_ID,
).flatMap((group) => group.links.map(toRoute));

for (const { path, heading } of ALL_ROUTES) {
  test(`${path} — renders heading and sidebar nav`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Design system', exact: true }),
    ).toBeVisible();
  });
}

for (const { path } of REFERENCE_ROUTES) {
  test(`${path} — marks itself current and offers on-this-page links`, async ({ page }) => {
    await page.goto(path);
    const sidebar = page.getByRole('navigation', { name: 'Design system', exact: true });
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute('href', path);
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc).toBeVisible();
    expect(await toc.getByRole('link').count()).toBeGreaterThan(0);
  });
}

test('sidebar links every design-system page', async ({ page }) => {
  await page.goto('/design-system');
  const sidebar = page.getByRole('navigation', { name: 'Design system', exact: true });
  const hrefs = await sidebar
    .getByRole('link')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  for (const { path } of ALL_ROUTES) {
    expect(hrefs).toContain(path);
  }
});

test('Preview renders the live component and its source without interaction', async ({ page }) => {
  await page.goto('/design-system/components');
  const preview = page.getByTestId('ds-preview').first();
  await expect(preview).toBeVisible();

  const source = preview.locator('pre').first();
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('tabindex', '0');

  expect(await page.locator('details').count()).toBe(0);

  const labels = await page
    .locator('pre[role="group"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(labels.length).toBeGreaterThan(0);
  expect(new Set(labels).size).toBe(labels.length);
  expect(labels).not.toContain(PREVIEW_SOURCE_ARIA_LABEL_FALLBACK);
  expect(labels.every((label) => typeof label === 'string' && label.length > 0)).toBe(true);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`on-this-page items carry no list markers at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/design-system');
    const items = page.getByRole('navigation', { name: 'On this page', exact: true }).locator('li');
    await expect(items.first()).toBeVisible();
    for (const style of await items.evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).listStyleType),
    )) {
      expect(style, 'TOC bullets collide with the next item when the list wraps to a row').toBe(
        'none',
      );
    }
  });
}

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function leftEdges(locator: import('@playwright/test').Locator) {
  return locator.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
  );
}

test('mobile sidebar items stack in one column', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/design-system/primitives/button');
  const items = page.locator('.ds-sidebar a.ds-nav-item');
  await expect(items.first()).toBeVisible();
  expect(
    new Set(await leftEdges(items)).size,
    'sidebar items wrap into rows instead of one column',
  ).toBe(1);
});

test('desktop sidebar is visible and vertical', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/design-system/primitives/button');
  const items = page.locator('.ds-sidebar a.ds-nav-item');
  await expect(items.first()).toBeVisible();
  expect(new Set(await leftEdges(items)).size).toBe(1);
  const tops = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().top),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(tops.length);
});

test('mobile on-this-page items stack in one column', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/design-system');
  const items = page.getByRole('navigation', { name: 'On this page', exact: true }).locator('a');
  await expect(items.first()).toBeVisible();
  expect(new Set(await leftEdges(items)).size).toBe(1);
});

test('mobile overview stat tiles sit at most two per row', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/design-system');
  const tops = await page
    .locator('.ds-stat-row > *')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
  expect(tops).toHaveLength(4);
  const perRow = Math.max(...[...new Set(tops)].map((top) => tops.filter((t) => t === top).length));
  expect(perRow).toBeLessThanOrEqual(2);
});

test('mobile shows the page before the sidebar; desktop keeps the sidebar on the left', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Design system', exact: true });
  const main = page.locator('main.ds-main');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-system/primitives/button');
  const [mainTop, navTop] = await Promise.all([
    main.evaluate((el) => el.getBoundingClientRect().top),
    nav.evaluate((el) => el.getBoundingClientRect().top),
  ]);
  expect(mainTop, 'on mobile the content must not sit below a full screen of nav').toBeLessThan(
    navTop,
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  const [mainLeft, navLeft] = await Promise.all([
    main.evaluate((el) => el.getBoundingClientRect().left),
    nav.evaluate((el) => el.getBoundingClientRect().left),
  ]);
  expect(navLeft).toBeLessThan(mainLeft);
});

const PROPS_TABLE_PATH = '/design-system/primitives/button';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const PROPS_COLUMNS = 4;

test('props table becomes labelled rows below 768 without sideways scroll', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto(PROPS_TABLE_PATH);
  const table = page.locator('main table').first();
  await expect(table).toBeVisible();
  const overflow = await table.evaluate((node) => {
    const parent = node.parentElement as HTMLElement;
    return {
      table: node.scrollWidth - node.clientWidth,
      parent: parent.scrollWidth - parent.clientWidth,
    };
  });
  expect(overflow.table).toBeLessThanOrEqual(0);
  expect(overflow.parent).toBeLessThanOrEqual(0);
  await expect(table.locator('thead')).toBeHidden();
  const bodyCells = table.locator('tbody td');
  const cellCount = await bodyCells.count();
  await expect(table.getByRole('cell')).toHaveCount(cellCount);
  const labels = ['Prop', 'Type', 'Default', 'Required'];
  const firstRow = table.locator('tbody tr').first().getByRole('cell');
  for (const [index, label] of labels.entries()) {
    await expect(firstRow.nth(index)).toContainText(label);
    await expect(firstRow.nth(index).locator('span').first()).toBeVisible();
  }
});

test('props table keeps its columns at 1280', async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(PROPS_TABLE_PATH);
  const table = page.locator('main table').first();
  await expect(table.locator('thead')).toBeVisible();
  const row = table.locator('tbody tr').first();
  const boxes = await row
    .locator('td')
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().top));
  expect(boxes).toHaveLength(PROPS_COLUMNS);
  expect(new Set(boxes.map(Math.round)).size).toBe(1);
});

const TABLET_VIEWPORT = { width: 768, height: 1024 };
const WIDE_TABLE_ROUTES = DS_NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href));

for (const path of WIDE_TABLE_ROUTES) {
  test(`${path} — nothing overflows the page horizontally at 768`, async ({ page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.goto(path);
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main') as HTMLElement;
      return {
        body: document.body.scrollWidth - window.innerWidth,
        main: main.scrollWidth - main.clientWidth,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.main).toBeLessThanOrEqual(0);
  });
}

test('every scrollable table region is keyboard focusable and named', async ({ page }) => {
  await page.setViewportSize(TABLET_VIEWPORT);
  await page.goto('/design-system/components');
  const regions = page.getByRole('region').filter({ has: page.locator('table') });
  expect(await regions.count()).toBeGreaterThan(0);
  for (const region of await regions.all()) {
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveAttribute('aria-label', /\S/);
  }
});
