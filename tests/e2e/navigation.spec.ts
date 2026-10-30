import { expect, test } from '@playwright/test';

const SECTION_COUNT = 9;
const SCRIM_CLICK_X = 350;
const SCRIM_CLICK_Y = 400;

test.describe('navigation: drawer at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer is closed, opens from Menu and lists the nine destinations', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#section-drawer')).toBeHidden();
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole('navigation', { name: 'Page sections' }).getByRole('link'),
    ).toHaveCount(SECTION_COUNT);
    await expect(
      drawer.getByRole('link', { name: 'Home' }),
      'the drawer opens focused on the current section, not on the close button',
    ).toBeFocused();
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
    await page.mouse.click(SCRIM_CLICK_X, SCRIM_CLICK_Y);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the hidden position line is out of the accessibility tree', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('progressbar', { name: 'Page position' })).toHaveCount(0);
  });
});

test.describe('navigation: INDEX trigger at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the position progressbar is named and follows the scroll', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('progressbar', { name: 'Page position' });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  test('the INDEX trigger carries the NN/9 position and no rail reserves width', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.desktop-topbar .index-trigger')).toContainText('01/9');
    const mainLeft = await page
      .locator('#main-content')
      .evaluate((el) => el.getBoundingClientRect().left);
    const topbarLeft = await page
      .locator('.desktop-topbar > div')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(
      mainLeft,
      'the section rail is gone: the main content must not be offset by its width',
    ).toBe(topbarLeft);
  });
});

test.describe('navigation: wide desktop at 1600px', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('the drawer stays closed and the main content is not offset by a rail', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#section-drawer')).toBeHidden();
    const mainLeft = await page
      .locator('#main-content')
      .evaluate((el) => el.getBoundingClientRect().left);
    const topbarLeft = await page
      .locator('.desktop-topbar > div')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(mainLeft).toBe(topbarLeft);
  });
});
