import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { VIEWPORTS } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend, type MockState } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';

const HOME_PATHS: Record<SiteLocale, string> = { en: '/', pt: '/pt' };
const FORM_SELECTOR = '[data-testid="contact-form"]';
const CONTACT_ENDPOINT = '**/api/contact';
const RATE_LIMITED_STATUS = 429;
const RETRY_AFTER_SECONDS = '600';
const VISITOR = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'A message long enough to be accepted by the form.',
} as const;

async function openForm(page: Page, locale: SiteLocale) {
  await page.setViewportSize(VIEWPORTS.PHONE);
  await freezeMotion(page);
  await page.goto(HOME_PATHS[locale]);
  const form = page.getByTestId('contact-form');
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
  await waitForHydration(page, FORM_SELECTOR);
  return form;
}

async function fillVisitor(page: Page): Promise<void> {
  await page.locator('input[name="name"]').fill(VISITOR.name);
  await page.locator('input[name="email"]').fill(VISITOR.email);
  await page.locator('textarea[name="message"]').fill(VISITOR.message);
}

async function expectFieldsKept(page: Page): Promise<void> {
  await expect(page.locator('input[name="name"]')).toHaveValue(VISITOR.name);
  await expect(page.locator('input[name="email"]')).toHaveValue(VISITOR.email);
  await expect(page.locator('textarea[name="message"]')).toHaveValue(VISITOR.message);
}

function countPosts(page: Page): { readonly count: () => number } {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/contact')) posts += 1;
  });
  return { count: () => posts };
}

for (const locale of Object.values(SITE_LOCALE)) {
  const { form: copy } = contactCopy[locale];
  const errors = contactCopy[locale].errors;

  test.describe(`contact failure recovery, ${locale}`, () => {
    test('a server error keeps the text, and the resubmit delivers it', async ({ page }) => {
      const state: MockState = { contact: 'server-error', log: 'accept' };
      await installMockBackend(page, state);
      const posts = countPosts(page);
      const form = await openForm(page, locale);
      await fillVisitor(page);

      await form.getByRole('button', { name: copy.submit, exact: true }).click();

      const alert = form.getByRole('alert');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(errors.requestFailed);
      await expect(alert).toContainText(copy.retained);
      await expectFieldsKept(page);
      await expect(page.getByTestId('contact-success')).toHaveCount(0);
      await expect(form.getByRole('button', { name: copy.submit, exact: true })).toHaveAttribute(
        'aria-disabled',
        'false',
      );

      state.contact = 'happy';
      await form.getByRole('button', { name: copy.submit, exact: true }).click();

      await expect(page.getByTestId('contact-success')).toBeVisible();
      await expect(page.getByTestId('contact-success')).toBeFocused();
      await expect(form).toHaveCount(0);
      await expect(page.locator('.contact-alert')).toHaveCount(0);
      expect(posts.count(), 'one failed send and one delivered resend').toBe(2);
    });

    test('a 429 with Retry-After says to wait, keeps the text and leaves submit usable', async ({
      page,
    }) => {
      await installMockBackend(page, { contact: 'happy', log: 'accept' });
      await page.route(CONTACT_ENDPOINT, (route) =>
        route.fulfill({
          status: RATE_LIMITED_STATUS,
          contentType: 'application/json',
          headers: { 'Retry-After': RETRY_AFTER_SECONDS },
          body: JSON.stringify({
            ok: false,
            requestId: 'contact-test-request-id',
            error: { code: 'rate_limited', message: 'too many requests' },
          }),
        }),
      );
      const posts = countPosts(page);
      const form = await openForm(page, locale);
      await fillVisitor(page);
      const submit = form.getByRole('button', { name: copy.submit, exact: true });

      await submit.click();

      const alert = form.getByRole('alert');
      await expect(alert).toContainText(errors.rateLimited);
      await expect(alert).not.toContainText(errors.requestFailed);
      await expectFieldsKept(page);
      await expect(submit).toHaveAttribute('aria-disabled', 'false');
      await expect(submit).toBeEnabled();

      await submit.click();
      await expect.poll(posts.count).toBe(2);
      await expect(alert).toContainText(errors.rateLimited);
    });
  });
}
