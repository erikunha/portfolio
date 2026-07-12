import { expect, test } from '@playwright/test';
import { PREVIEW_SOURCE_ARIA_LABEL_FALLBACK } from '@/app/design-system/_components/preview.constants';

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
});
