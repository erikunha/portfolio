import { expect, test } from '@playwright/test';

const DS_ROUTES = [
  { path: '/design-system', heading: 'DESIGN SYSTEM' },
  { path: '/design-system/tokens', heading: 'TOKENS' },
  { path: '/design-system/components', heading: 'COMPONENTS' },
  { path: '/design-system/enforcement', heading: 'ENFORCEMENT' },
  { path: '/design-system/changelog', heading: 'CHANGELOG' },
];

for (const { path, heading } of DS_ROUTES) {
  test(`${path} — renders heading and sidebar nav`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Design system' })).toBeVisible();
  });
}

test('Preview component renders live and source toggle', async ({ page }) => {
  await page.goto('/design-system/components');
  const preview = page.getByTestId('ds-preview').first();
  await expect(preview).toBeVisible();
  const summary = page.getByText('VIEW SOURCE').first();
  await expect(summary).toBeVisible();
});
