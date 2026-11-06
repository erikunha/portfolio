import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { installMockBackend } from './_helpers/mock-backend';

const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 700 };
const SUBPIXEL_PX = 1;
const SCROLL_MARGIN_PX = 100;
const PATHS: Record<SiteLocale, string> = { en: '/', pt: '/pt' };
const FIELD_SELECTORS = {
  name: 'input[name="name"]',
  email: 'input[name="email"]',
  message: 'textarea[name="message"]',
};

async function openForm(page: Page, locale: SiteLocale) {
  await page.goto(PATHS[locale]);
  await page.evaluate(
    (margin) =>
      window.scrollTo(
        0,
        (document.querySelector('.contact-main') as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          margin,
      ),
    SCROLL_MARGIN_PX,
  );
  const form = page.getByTestId('contact-form');
  await expect(form).toBeVisible();
  return form;
}

async function fillValid(page: Page) {
  await page.locator(FIELD_SELECTORS.name).fill('Ada Lovelace');
  await page.locator(FIELD_SELECTORS.email).fill('ada@example.com');
  await page.locator(FIELD_SELECTORS.message).fill('A message long enough to be accepted.');
}

const heightOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => node.getBoundingClientRect().height);

test.describe('contact form with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of Object.values(SITE_LOCALE)) {
    test(`${locale}: the section says the form needs JavaScript and links the email`, async ({
      page,
    }) => {
      const { section } = contactCopy[locale];
      await page.goto(PATHS[locale]);
      const hint = page.locator('#sec-contact').getByTestId('contact-nojs');

      await expect(hint).toBeVisible();
      await expect(hint).toContainText(section.noscript);
      await expect(hint.getByRole('link', { name: section.email })).toHaveAttribute(
        'href',
        `mailto:${section.email}`,
      );
    });
  }

  test('the timezone panel does not claim to be loading when nothing will load it', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByTestId('contact-timezone-static')).toBeAttached();
    await expect(page.getByTestId('ctz-loading')).toBeHidden();
  });
});

test.describe('contact section with JavaScript on', () => {
  test('shows no JavaScript hint', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#sec-contact')).toBeAttached();
    await expect(page.getByTestId('contact-nojs')).toHaveCount(0);
  });

  for (const locale of Object.values(SITE_LOCALE)) {
    test(`${locale}: the timezone box says it is loading before the live panel mounts`, async ({
      page,
    }) => {
      await page.goto(PATHS[locale]);
      const label = page.getByTestId('ctz-loading');

      await expect(label).toBeVisible();
      await expect(label).toHaveText(contactCopy[locale].timezone.loading);
    });
  }
});

test.describe('contact submit status line', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    for (const viewport of [NARROW, PHONE]) {
      test(`${locale} at ${viewport.width}px: announces sending, then the error, without moving the row`, async ({
        page,
      }) => {
        const { form: copy } = contactCopy[locale];
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await installMockBackend(page, { contact: 'server-error', log: 'accept' });
        await page.route('**/api/contact', async (route) => {
          await gate;
          await route.fulfill({
            status: 502,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: { code: 'storage_unavailable' } }),
          });
        });
        const form = await openForm(page, locale);
        const status = form.getByTestId('contact-status');
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status).toHaveText(copy.waiting);
        const rowIdle = await heightOf(page, '.contact-submit-row');

        await form.getByRole('button', { name: copy.submit, exact: true }).click();
        await expect(status).toHaveText(copy.statusInvalid);
        const rowInvalid = await heightOf(page, '.contact-submit-row');

        await fillValid(page);
        await expect(status).toHaveText(copy.waiting);
        await form.getByRole('button', { name: copy.submit, exact: true }).click();
        await expect(status).toHaveText(copy.sending);
        const rowSending = await heightOf(page, '.contact-submit-row');

        release();
        await expect(status).toHaveText(copy.statusFailed);
        const rowFailed = await heightOf(page, '.contact-submit-row');

        for (const [state, height] of Object.entries({ rowInvalid, rowSending, rowFailed })) {
          expect(Math.abs(height - rowIdle), `${state} ${height}, idle ${rowIdle}`).toBeLessThan(
            SUBPIXEL_PX,
          );
        }
      });
    }
  }
});

test.describe('contact form error growth', () => {
  test('a failed send grows the section by the alert alone and puts the alert in view', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installMockBackend(page, { contact: 'server-error', log: 'accept' });
    const form = await openForm(page, SITE_LOCALE.en);
    await fillValid(page);
    const before = await heightOf(page, '.contact-main');

    await form.getByRole('button', { name: contactCopy.en.form.submit, exact: true }).click();
    const alert = page.locator('.contact-alert');
    await expect(alert).toBeVisible();
    const after = await heightOf(page, '.contact-main');
    const alertHeight = await heightOf(page, '.contact-alert');
    const gap = await page.evaluate(
      () =>
        Number.parseFloat(
          getComputedStyle(document.querySelector('.contact-form') as Element).rowGap,
        ) || 0,
    );

    expect(
      Math.abs(after - before - alertHeight - gap),
      'only the alert and its gap are added',
    ).toBeLessThan(SUBPIXEL_PX);
    await expect(alert).toBeFocused();
    await expect(alert).toBeInViewport();
  });
});
