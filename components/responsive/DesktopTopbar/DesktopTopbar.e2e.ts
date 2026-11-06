import { expect, test } from '@playwright/test';
import { HIRE_ACCESSIBLE_NAME, HIRE_SHORT_LABEL } from '@/content/nav';
import { SITE_LOCALE } from '@/content/site-locale';

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('DesktopTopbar — navigation', () => {
  test('topbar nav is visible on desktop viewport', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site navigation' });
    await expect(nav).toBeVisible();
  });

  test('the topbar names every destination in the shared vocabulary', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site navigation' });

    for (const label of ['ABOUT', 'PROJECTS', 'CAREER', 'CONTACT', 'DESIGN_SYSTEM', 'VIEW_CV']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }

    const hire = nav.getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] });
    await expect(hire).toBeVisible();
    await expect(hire).toHaveText(HIRE_SHORT_LABEL[SITE_LOCALE.en]);
  });

  test('design system link navigates to /design-system', async ({ page }) => {
    await page.goto('/');
    const dsLink = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link', { name: 'DESIGN_SYSTEM' });
    await dsLink.click();
    await expect(page).toHaveURL('/design-system');
  });

  test('topbar nav links are keyboard-focusable', async ({ page }) => {
    await page.goto('/');
    const firstLink = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link')
      .first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });

  test('motion toggle button is present', async ({ page }) => {
    await page.goto('/');
    const motionBtn = page.getByRole('button', { name: /motion/i });
    await expect(motionBtn).toBeVisible();
  });

  test('the topbar has no search trigger', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^(SEARCH|BUSCAR)/ })).toHaveCount(0);
    await expect(page.locator('.topbar-search')).toHaveCount(0);
  });

  test('the hire CTA points at LinkedIn in a new tab', async ({ page }) => {
    await page.goto('/');
    const hire = page
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] });

    await expect(hire).toHaveAttribute('href', /linkedin\.com\/in\/erikunha/);
    await expect(hire).toHaveAttribute('target', '_blank');
  });

  test('the language switch sits right after HIRE and links to the Portuguese home', async ({
    page,
  }) => {
    await page.goto('/');
    const topbar = page.locator('.desktop-topbar');
    const hire = topbar
      .getByRole('navigation', { name: 'Site navigation' })
      .getByRole('link', { name: HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en] });
    const langSwitch = topbar.getByRole('navigation', { name: 'Language' });

    await expect(langSwitch.getByRole('link', { name: /^EN/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(langSwitch.getByRole('link', { name: /^PT/ })).toHaveAttribute('href', '/pt');

    const hireBox = await hire.boundingBox();
    const switchBox = await langSwitch.boundingBox();
    expect(switchBox?.x ?? 0).toBeGreaterThanOrEqual(hireBox?.x ?? Number.POSITIVE_INFINITY);
  });
});
