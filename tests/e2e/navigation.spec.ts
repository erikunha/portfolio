import { expect, test } from '@playwright/test';

const SECTION_COUNT = 9;

test.describe('navigation: drawer at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer is closed, opens from Menu and lists the nine destinations', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('complementary', { name: 'Section menu' })).toBeHidden();
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole('navigation', { name: 'Page sections' }).getByRole('link'),
    ).toHaveCount(SECTION_COUNT);
    await expect(drawer.getByRole('button', { name: '[ X ] CLOSE' })).toBeFocused();
  });

  test('choosing a destination closes the drawer and lands on the section', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#sec-contact')).toBeInViewport();
  });

  test('the scrim closes the drawer', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    await page.mouse.click(385, 400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the position progressbar is named and follows the scroll', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('progressbar', { name: 'Page position' });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});

test.describe('navigation: rail at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the collapsed rail is 56px wide and the dock is hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'primary' })).toBeHidden();
    const rail = page.getByRole('complementary', { name: 'Section menu' });
    await expect(rail).toBeVisible();
    const box = await rail.boundingBox();
    const visibleWidth = (box?.x ?? 0) + (box?.width ?? 0);
    expect(visibleWidth).toBe(56);
  });

  test('the toggle expands the rail and Escape collapses it', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open section menu' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('a rail link scrolls to its section and marks it current', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open section menu' }).click();
    const link = page
      .getByRole('navigation', { name: 'Page sections' })
      .getByRole('link', { name: 'Projects' });
    await link.click();
    await expect(page.locator('#sec-projects')).toBeInViewport();
    await expect(link).toHaveAttribute('aria-current', 'location');
  });

  test('the position label reads NN/9 and the main content clears the rail', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('01/9')).toBeVisible();
    const mainLeft = await page
      .locator('#main-content')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(mainLeft).toBeGreaterThanOrEqual(56);
  });
});

test.describe('navigation: expanded rail at 1600px', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('the rail is 232px wide without a toggle', async ({ page }) => {
    await page.goto('/');
    const rail = page.getByRole('complementary', { name: 'Section menu' });
    const box = await rail.boundingBox();
    expect(box?.width).toBe(232);
    expect(box?.x).toBe(0);
    await expect(page.getByRole('button', { name: 'Open section menu' })).toBeHidden();
  });
});
