import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('home with JavaScript off', () => {
  test('shows the notice and keeps the static content readable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/This site works best with JavaScript/)).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('the site navigation still moves to its section', async ({ page }) => {
    await page.goto('/');
    // The noscript bar link is the one contact route at every breakpoint; the dock HIRE leaves the site.
    await page.locator('.nojs-bar a[href="/#sec-contact"]').click();
    await expect(page).toHaveURL(/#sec-contact$/);
    await expect(page.locator('#sec-contact')).toBeAttached();
  });

  test('the notice clears the fixed desktop chrome instead of covering it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = await page.locator('.desktop-topbar').boundingBox();
    const bar = await page.locator('.nojs-bar').boundingBox();
    if (topbar === null || bar === null) {
      throw new Error('nojs-bar or desktop-topbar did not render a box');
    }
    expect(bar.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
    await expect(
      page.locator('.desktop-topbar').getByRole('link', { name: 'erikunha.dev, home' }),
    ).toBeInViewport();
    await expect(
      page.locator('.desktop-topbar').getByRole('link', { name: 'VIEW_CV' }),
    ).toBeInViewport();
  });

  test('the notice sits flush with the topbar on the horizontal axis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = await page.locator('.desktop-topbar').boundingBox();
    const bar = await page.locator('.nojs-bar').boundingBox();
    expect(topbar).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(
      bar?.x,
      'the noscript notice must share the left edge of the fixed topbar, the collapsed rail that offset it is gone',
    ).toBe(topbar?.x);
  });

  test('no section rail is pinned open at wide desktop without JS', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    await expect(
      page.locator('.section-menu'),
      'the menu opens only from the menu button',
    ).toBeHidden();
  });

  test('the contact section keeps its channels, facts and static map in order', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const section = page.locator('#sec-contact');

    await expect(section.locator('.contact-channels a[href^="mailto:"]')).toBeAttached();
    await expect(section.locator('.contact-fact')).toHaveCount(6);
    await expect(section.getByTestId('contact-timezone-static')).toBeAttached();
    await expect(section.getByTestId('ctz-clock-erik')).toHaveCount(0);
    const inOrder = await section.evaluate((element) => {
      const follows = (first: string, second: string) =>
        Boolean(
          (element.querySelector(first) as Element).compareDocumentPosition(
            element.querySelector(second) as Element,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      return (
        follows('.contact-main > :first-child', '.contact-channels') &&
        follows('.contact-channels', '.contact-facts') &&
        follows('.contact-facts', '.contact-timezone')
      );
    });
    expect(inOrder, 'form, channels, facts, panel').toBe(true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
  });

  test('the server-rendered menu trigger is the icon alone, named Open menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const trigger = page.locator('.desktop-topbar .menu-trigger');
    await expect(trigger).toHaveAccessibleName('Open menu');
    await expect(trigger).toHaveText('');
    await expect(page.locator('.desktop-topbar')).not.toContainText('INDEX');
  });
});
