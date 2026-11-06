import { expect, type Page, test } from '@playwright/test';

const runningAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => (animation as CSSAnimation).animationName)
      .filter(Boolean),
  );

const reach = async (page: Page, selector: string) => {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeVisible();
};

test.describe('decorative animations run while motion is on', () => {
  test.use({ viewport: { width: 1280, height: 720 }, timezoneId: 'Europe/Berlin' });

  test('the guitar signal chart, the contact map route and the CRT beam animate with motion on', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('button[data-motion="on"]').first()).toBeVisible();
    await expect
      .poll(() => runningAnimations(page), {
        message: 'the CRT scan beam stopped: check body[data-motion] and the crt.css rules',
      })
      .toContain('crt-scan-beam');

    await reach(page, '[data-testid="eq-spectrum"]');
    await expect
      .poll(() => runningAnimations(page), {
        message: 'the guitar signal chain bars stopped bouncing with motion on',
      })
      .toContain('eq-bounce');
    await expect.poll(() => runningAnimations(page)).toContain('guitar-scan-beam');

    await page.locator('#contact-timezone-title').scrollIntoViewIfNeeded();
    await reach(page, '.ctz-route');
    await expect
      .poll(() => runningAnimations(page), {
        message: 'the contact map route stopped marching with motion on',
      })
      .toContain('ctz-march');
  });

  test('turning motion off stops the same animations', async ({ page }) => {
    await page.goto('/');
    await reach(page, '[data-testid="eq-spectrum"]');
    await expect.poll(() => runningAnimations(page)).toContain('eq-bounce');
    await page.locator('button[data-motion="on"]').first().click();
    await expect(page.locator('button[data-motion="off"]').first()).toBeVisible();
    await expect.poll(() => runningAnimations(page)).not.toContain('eq-bounce');
    await expect.poll(() => runningAnimations(page)).not.toContain('crt-scan-beam');
  });
});
