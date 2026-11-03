import { expect, test } from '@playwright/test';
import { DS_PAGER } from '@/app/design-system/_components/ds-nav';

const MIN_TARGET_PX = 24;
const WIDTHS = [320, 390, 768, 1024, 1280];
const MOBILE_HEIGHT = 812;
const DESKTOP_HEIGHT = 720;

for (const width of WIDTHS) {
  test(`design-system shell reflows without sideways scroll at ${width}`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: width < 768 ? MOBILE_HEIGHT : DESKTOP_HEIGHT,
    });
    for (const { href } of DS_PAGER) {
      await page.goto(href);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${href} scrolls sideways at ${width}`).toBeLessThanOrEqual(0);
      const small = await page
        .locator(
          '.desktop-topbar a:visible, .desktop-topbar button:visible, .mobile-title-bar button:visible, nav.pager a:visible',
        )
        .evaluateAll(
          (nodes, min) =>
            nodes
              .map((node) => node.getBoundingClientRect())
              .filter((box) => box.width < min || box.height < min).length,
          MIN_TARGET_PX,
        );
      expect(small, `${href} has targets under ${MIN_TARGET_PX}px at ${width}`).toBe(0);
    }
  });
}

test('pager links carry previous and next accessible names', async ({ page }) => {
  await page.goto('/design-system/tokens');
  const pager = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pager.getByRole('link', { name: 'Previous: Overview' })).toHaveAttribute(
    'href',
    '/design-system',
  );
  await expect(pager.getByRole('link', { name: 'Next: Components' })).toHaveAttribute(
    'href',
    '/design-system/components',
  );
});

test.describe('design system without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: MOBILE_HEIGHT } });

  test('a phone still reaches every design-system page from the page itself', async ({ page }) => {
    await page.goto('/design-system');
    const nav = page.getByRole('navigation', { name: 'Design system pages without scripting' });
    await expect(nav).toBeVisible();
    for (const { href } of DS_PAGER) {
      await expect(nav.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });
});
