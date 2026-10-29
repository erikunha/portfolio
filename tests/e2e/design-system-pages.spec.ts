import { expect, test } from '@playwright/test';
import { PREVIEW_SOURCE_ARIA_LABEL_FALLBACK } from '@/app/design-system/_components/preview.constants';

const DS_ROUTES = [
  { path: '/design-system', heading: 'DESIGN SYSTEM' },
  { path: '/design-system/tokens', heading: 'TOKENS' },
  { path: '/design-system/components', heading: 'COMPONENTS' },
  { path: '/design-system/enforcement', heading: 'ENFORCEMENT' },
  { path: '/design-system/changelog', heading: 'CHANGELOG' },
];

const REFERENCE_ROUTES = [
  { path: '/design-system/foundations/colors', heading: 'COLORS' },
  { path: '/design-system/foundations/typography', heading: 'TYPOGRAPHY' },
  { path: '/design-system/foundations/spacing-borders', heading: 'SPACING-BORDERS' },
  { path: '/design-system/primitives/badge', heading: 'BADGE' },
  { path: '/design-system/primitives/button', heading: 'BUTTON' },
  { path: '/design-system/primitives/cmd-line', heading: 'CMD-LINE' },
  { path: '/design-system/primitives/copybutton', heading: 'COPYBUTTON' },
  { path: '/design-system/primitives/field', heading: 'FIELD' },
  { path: '/design-system/primitives/kbd-key', heading: 'KBD-KEY' },
  { path: '/design-system/primitives/stat-tile', heading: 'STAT-TILE' },
  { path: '/design-system/primitives/terminal-panel', heading: 'TERMINAL-PANEL' },
  { path: '/design-system/primitives/window-chrome', heading: 'WINDOW-CHROME' },
];

const ALL_ROUTES = [...DS_ROUTES, ...REFERENCE_ROUTES];

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
