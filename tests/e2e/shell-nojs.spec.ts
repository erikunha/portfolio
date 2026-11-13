import { expect, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { horizontalOverflow } from './_helpers/geometry';
import { shellCopy } from './_helpers/shell';

const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const NOTE = '[data-testid="shell-nojs"]';
const NARROW = { width: 320, height: 640 } as const;

test.describe('the interactive shell with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of Object.values(SITE_LOCALE)) {
    test(`${locale}: the section says the shell needs JavaScript and links the email`, async ({
      page,
    }) => {
      const { ui } = shellCopy(locale);
      await page.goto(PATHS[locale]);
      const note = page.locator('#sec-shell').locator(NOTE);

      await expect(note).toBeVisible();
      await expect(note).toContainText(ui.noscript);
      await expect(note.getByRole('link', { name: ui.email })).toHaveAttribute(
        'href',
        ui.emailHref,
      );
      await expect(page.getByTestId('shell-loading')).toBeHidden();
    });
  }

  test('the note fits a 320px screen without scrolling sideways', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/');
    await expect(page.locator(NOTE)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('the interactive shell with JavaScript on', () => {
  test('shows no JavaScript note', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sec-shell')).toBeAttached();
    await expect(page.locator(NOTE)).toHaveCount(0);
  });
});
