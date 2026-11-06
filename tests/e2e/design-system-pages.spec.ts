import { expect, test } from '@playwright/test';
import { DS_NAV_GROUPS, DS_NAV_ID } from '@/app/design-system/_components/ds-nav';
import { PREVIEW_SOURCE_ARIA_LABEL_FALLBACK } from '@/app/design-system/_components/preview.constants';

const SIDEBAR_MIN_WIDTH = 1024;
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
  test(`${path}: renders heading and the page tree`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
    const sidebar = page.locator(`#${DS_NAV_ID}`);
    await expect(sidebar).toBeAttached();
    const wide = (page.viewportSize()?.width ?? 0) >= SIDEBAR_MIN_WIDTH;
    if (wide) await expect(sidebar).toBeVisible();
    else await expect(sidebar).toBeHidden();
  });
}

for (const { path } of REFERENCE_ROUTES) {
  test(`${path}: marks itself current and offers on-this-page links`, async ({ page }) => {
    await page.goto(path);
    const sidebar = page.locator(`#${DS_NAV_ID}`);
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute('href', path);
    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc).toBeVisible();
    expect(await toc.getByRole('link').count()).toBeGreaterThan(0);
  });
}

test('sidebar links every design-system page', async ({ page }) => {
  await page.goto('/design-system');
  const sidebar = page.locator(`#${DS_NAV_ID}`);
  const hrefs = await sidebar
    .locator('a')
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

test('desktop keeps the sidebar on the left of the page', async ({ page }) => {
  const nav = page.locator(`#${DS_NAV_ID}`);
  const main = page.locator('main.ds-main');

  await page.setViewportSize(DESKTOP);
  await page.goto('/design-system/primitives/button');
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
  test(`${path}: nothing overflows the page horizontally at 768`, async ({ page }) => {
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

test('every labelled table region is keyboard focusable and uniquely named per page', async ({
  page,
}) => {
  let pagesWithTables = 0;
  for (const { path } of ALL_ROUTES) {
    await page.goto(path);
    const tables = page.locator('table[data-labelled-table]');
    const tableCount = await tables.count();
    await expect(
      page.locator('table'),
      `${path}: every table must be a labelled table`,
    ).toHaveCount(tableCount);
    if (tableCount === 0) continue;
    pagesWithTables += 1;
    const regions = page.locator('section:has(table[data-labelled-table])');
    const count = await regions.count();
    await expect(regions, `${path}: every table must have its own section`).toHaveCount(tableCount);
    const described = await regions.evaluateAll((nodes) =>
      nodes.map((node) => ({
        label: node.getAttribute('aria-label'),
        tabindex: node.getAttribute('tabindex'),
      })),
    );
    for (const region of described) {
      expect(region.tabindex, `${path}: table region must be keyboard-focusable`).toBe('0');
      expect(region.label, `${path}: table region must have a non-empty aria-label`).toMatch(/\S/);
    }
    expect(
      new Set(described.map((region) => region.label)).size,
      `${path}: table regions must have unique aria-labels`,
    ).toBe(count);
  }
  expect(pagesWithTables, 'the reference pages carry labelled tables').toBeGreaterThan(0);
});

test('the design system paints the matrix rain behind its content', async ({ page }) => {
  await page.goto(OVERVIEW_PATH);
  await expect(page.locator('canvas'), 'the design system carries the global rain').toHaveCount(1);
  const probe = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.pointerEvents = 'auto';
    const heading = document.querySelector('h1');
    if (!heading) return null;
    const box = heading.getBoundingClientRect();
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { insideHeading: heading.contains(top), tag: top?.tagName ?? '' };
  });
  expect(probe, 'the design system owns a heading').not.toBeNull();
  expect(
    probe?.insideHeading,
    'the rain paints over the heading, the design system root must stack above it',
  ).toBe(true);
  expect(probe?.tag).not.toBe('CANVAS');
});

for (const { path } of ALL_ROUTES) {
  test(`${path}: every id is unique, so each in-page jump link has one target`, async ({
    page,
  }) => {
    await page.goto(path);
    const duplicates = await page.evaluate(() => {
      const seen = new Map<string, number>();
      for (const node of document.querySelectorAll('[id]')) {
        seen.set(node.id, (seen.get(node.id) ?? 0) + 1);
      }
      return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
    });
    expect(duplicates).toEqual([]);
  });
}

for (const { path } of ALL_ROUTES) {
  test(`${path}: hydrates without a React error`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(errors, 'a server and client HTML mismatch makes React re-render the page').toEqual([]);
  });
}

test('the stat grid breakpoint the docs state is the one the layout uses', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/design-system/components');
  const claim = await page
    .getByText(/four columns from \d+px/)
    .first()
    .textContent();
  const stated = Number(/four columns from (\d+)px/.exec(claim ?? '')?.[1]);
  expect(Number.isFinite(stated), 'the docs state a breakpoint').toBe(true);
  const columns = () =>
    page
      .locator('.ds-stat-row')
      .first()
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  await page.setViewportSize({ width: stated, height: 800 });
  expect(await columns(), `four columns at ${stated}px`).toBe(4);
  await page.setViewportSize({ width: stated - 1, height: 800 });
  expect(await columns(), `two columns at ${stated - 1}px`).toBe(2);
});
