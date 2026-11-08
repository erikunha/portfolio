import { expect, test } from '@playwright/test';
import { aboutContent } from '@/content/about';
import { SITE_LOCALE } from '@/content/site-locale';

const DESKTOP = { width: 1280, height: 900 };

test.describe('About', () => {
  test('the code panel header carries the repo link on one row and no copy control', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const panel = page.locator('.ab-code');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();

    await expect(
      panel.getByRole('button', { name: /copy/i }),
      'the decorative code excerpt carries no copy control',
    ).toHaveCount(0);

    const link = panel.getByRole('link', {
      name: `${aboutContent[SITE_LOCALE.en].code.repoLabel} ${aboutContent[SITE_LOCALE.en].code.repoNewTabNote}`,
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toContainText(aboutContent[SITE_LOCALE.en].code.repoLabel);
    await expect(link, 'the name comes from the content').not.toHaveAttribute('aria-label');

    const header = await panel.locator('.panel-head').evaluate((element) => {
      const children = [...element.children];
      const title = element.querySelector('.panel-title')?.getBoundingClientRect();
      const link = element.querySelector('a')?.getBoundingClientRect();
      return {
        children: children.length,
        linkLeft: link?.left ?? 0,
        titleRight: title?.right ?? 0,
      };
    });
    expect(header.children, 'the header holds the marker, the title and one control').toBe(3);
    expect(
      header.linkLeft,
      'the header must stay on one row, the control no longer competes with the title',
    ).toBeGreaterThanOrEqual(header.titleRight - 1);
  });

  test('the repo link points at the GitHub profile', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const link = page.locator('.ab-code').getByRole('link', {
      name: `${aboutContent[SITE_LOCALE.en].code.repoLabel} ${aboutContent[SITE_LOCALE.en].code.repoNewTabNote}`,
      exact: true,
    });
    await expect(link).toHaveAttribute('href', aboutContent[SITE_LOCALE.en].code.repoHref);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });
});
