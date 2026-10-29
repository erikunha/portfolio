import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Dock: mobile navigation', () => {
  test('shows the five controls', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole('link', { name: 'HOME' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'WORK' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'SHELL' })).toBeVisible();
    await expect(dock.getByRole('link', { name: /Hire me on LinkedIn/ })).toBeVisible();
    await expect(dock.getByRole('button', { name: /^MENU/ })).toBeVisible();
    await expect(dock.locator('a, button')).toHaveCount(5);
  });

  test('Work scrolls to Projects and becomes current', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await dock.getByRole('link', { name: 'WORK' }).click();
    await expect(page.locator('#sec-projects')).toBeInViewport();
    await expect(dock.getByRole('link', { name: 'WORK' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  test('Hire opens LinkedIn in a new tab', async ({ page }) => {
    await page.goto('/');
    const hire = page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('link', { name: /Hire me on LinkedIn/ });
    await expect(hire).toHaveAttribute('target', '_blank');
    await expect(hire).toHaveAttribute('href', /linkedin\.com\/in\/erikunha/);
  });

  test('Menu opens the drawer and Escape returns focus to it', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'primary' }).getByRole('button', {
      name: /^MENU/,
    });
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Section menu' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(menu).toBeFocused();
  });
});
