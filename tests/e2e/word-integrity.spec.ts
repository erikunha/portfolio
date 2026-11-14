import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';
import { renderEverything, splitWords, WORD_VIEWPORTS } from './_helpers/words';

const ROUTES = [
  '/',
  '/pt',
  '/cv',
  '/pt/cv',
  '/summary',
  '/pt/summary',
  '/links',
  '/links/en',
] as const;
const FORM_SELECTOR = '[data-testid="contact-form"]';
const BAD_GATEWAY = 502;
const ENVIRONMENTS = [
  { name: 'phone', touch: { isMobile: true, hasTouch: true } },
  { name: 'narrow desktop window', touch: { isMobile: false, hasTouch: false } },
] as const;

async function failContactSend(page: Page): Promise<void> {
  await installMockBackend(page, { contact: 'server-error', log: 'accept' });
  await page.route('**/api/contact', (route) =>
    route.fulfill({
      status: BAD_GATEWAY,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: { code: 'storage_unavailable' } }),
    }),
  );
  await gotoSettled(page, '/');
  await waitForHydration(page, FORM_SELECTOR);
  await page.locator('input[name="name"]').fill('Ada Lovelace');
  await page.locator('input[name="email"]').fill('ada@example.com');
  await page.locator('textarea[name="message"]').fill('A message long enough to be accepted.');
  await page
    .getByTestId('contact-form')
    .getByRole('button', { name: contactCopy[SITE_LOCALE.en].form.submit, exact: true })
    .click();
  await expect(page.locator('.contact-alert')).toBeVisible();
}

for (const environment of ENVIRONMENTS) {
  test.describe(`no word breaks across two lines on a ${environment.name}`, () => {
    test.use(environment.touch);

    for (const route of ROUTES) {
      for (const viewport of WORD_VIEWPORTS) {
        test(`${route} at ${viewport.width}px`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await freezeMotion(page);
          await gotoSettled(page, route);
          await renderEverything(page);
          expect(
            await splitWords(page),
            'a word runs onto a second line only after an underscore, slash, dot or at sign',
          ).toEqual([]);
        });
      }
    }

    for (const viewport of WORD_VIEWPORTS) {
      test(`the contact error state at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await freezeMotion(page);
        await failContactSend(page);
        expect(
          await splitWords(page, '.contact-main'),
          'the failed-send alert keeps the address whole or breaks it at a sensible point',
        ).toEqual([]);
      });
    }
  });
}
