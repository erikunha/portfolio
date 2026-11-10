import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';

const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 700 };
const DESKTOP = { width: 1280, height: 800 };
const SHOT_DIR = process.env.CONTACT_SHOT_DIR;
const SUBPIXEL_PX = 1;
const SCROLL_MARGIN_PX = 100;
const HYDRATION_DELAY_MS = 2000;
const PATHS: Record<SiteLocale, string> = { en: '/', pt: '/pt' };
const FORM_SELECTOR = '[data-testid="contact-form"]';
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
  await waitForHydration(page, FORM_SELECTOR);
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

test.describe('contact form before it hydrates', () => {
  test('a submit while the scripts are still loading neither navigates nor puts the message in the URL', async ({
    page,
  }) => {
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
      await route.continue();
    });
    const documents: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents.push(request.url());
    });
    await page.goto('/', { waitUntil: 'commit' });
    const form = page.getByTestId('contact-form');
    await form.waitFor({ state: 'attached' });
    await form.scrollIntoViewIfNeeded();
    await fillValid(page);

    await form.getByRole('button', { name: contactCopy.en.form.submit, exact: true }).click();
    await waitForHydration(page, FORM_SELECTOR);

    expect(documents, 'the page loaded once and the submit did not reload it').toHaveLength(1);
    expect(new URL(page.url()).search, 'the typed message stays out of the URL').toBe('');
  });

  test('text typed into every field while the scripts load survives hydration and is submitted', async ({
    page,
  }) => {
    const typed = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'A message long enough to be accepted.',
    };
    await installMockBackend(page, { contact: 'happy', log: 'accept' });
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
      await route.continue();
    });
    let sent: Record<string, string> | null = null;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/contact') && request.method() === 'POST') {
        sent = request.postDataJSON();
      }
    });
    await page.goto('/', { waitUntil: 'commit' });
    const form = page.getByTestId('contact-form');
    await form.waitFor({ state: 'attached' });
    await form.scrollIntoViewIfNeeded();
    await page.locator(FIELD_SELECTORS.name).pressSequentially(typed.name);
    await page.locator(FIELD_SELECTORS.email).pressSequentially(typed.email);
    await page.locator(FIELD_SELECTORS.message).pressSequentially(typed.message);
    await waitForHydration(page, FORM_SELECTOR);

    for (const field of Object.keys(typed) as (keyof typeof typed)[]) {
      await expect(
        page.locator(FIELD_SELECTORS[field]),
        `${field} typed before hydration is still in the field after it`,
      ).toHaveValue(typed[field]);
    }
    await expect(page.getByTestId('contact-form').locator('.contact-count')).toContainText(
      `${typed.message.length}`,
    );

    await form.getByRole('button', { name: contactCopy.en.form.submit, exact: true }).click();
    await expect(page.getByTestId('contact-success')).toBeVisible();
    expect(sent, 'the submit carries what was typed before hydration').toMatchObject(typed);
  });
});

test.describe('contact submit status line', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    for (const viewport of [NARROW, PHONE]) {
      test(`${locale} at ${viewport.width}px: announces sending, then the error, without moving the row`, async ({
        page,
      }) => {
        const { form: copy } = contactCopy[locale];
        await page.setViewportSize(viewport);
        await freezeMotion(page);
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
    await freezeMotion(page);
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

const SHOT_VIEWPORTS = [
  { name: '320', size: NARROW },
  { name: '390', size: PHONE },
  { name: '1280', size: DESKTOP },
] as const;

async function shot(name: string, locator: ReturnType<Page['locator']>) {
  if (SHOT_DIR) await locator.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

test.describe('contact state boards', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    for (const viewport of SHOT_VIEWPORTS) {
      const tag = `${locale}-${viewport.name}`;

      test(`${tag}: L4 the static timezone panel shows the spinner line and dashed rows`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport.size);
        await page.addInitScript(() => {
          window.IntersectionObserver = class {
            observe() {
              return undefined;
            }
            unobserve() {
              return undefined;
            }
            disconnect() {
              return undefined;
            }
            takeRecords() {
              return [];
            }
          } as unknown as typeof IntersectionObserver;
        });
        await page.goto(PATHS[locale]);
        const host = page.locator('.ctz-host');
        await expect(page.getByTestId('ctz-spin')).toBeAttached();
        await expect(page.getByTestId('ctz-spin')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.getByTestId('ctz-loading')).toHaveText(
          contactCopy[locale].timezone.loading,
        );
        await shot(`L4-${tag}`, host);
      });

      test(`${tag}: L6 the busy button keeps its width and the fields lock`, async ({ page }) => {
        const { form: copy } = contactCopy[locale];
        await page.setViewportSize(viewport.size);
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await installMockBackend(page, { contact: 'happy', log: 'accept' });
        await page.route('**/api/contact', async (route) => {
          await gate;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, requestId: 'contact-test-request-id' }),
          });
        });
        const form = await openForm(page, locale);
        await fillValid(page);
        const button = form.getByRole('button', { name: copy.submit, exact: true });
        const idleWidth = (await button.boundingBox())?.width ?? 0;
        await button.click();
        await expect(form.getByTestId('contact-status')).toHaveText(copy.sending);
        const busy = form.getByRole('button', { name: copy.submitting, exact: true });
        const busyWidth = (await busy.boundingBox())?.width ?? 0;

        expect(Math.abs(busyWidth - idleWidth)).toBeLessThan(SUBPIXEL_PX);
        await expect(page.locator(FIELD_SELECTORS.name)).toHaveJSProperty('readOnly', true);
        await expect(page.locator(FIELD_SELECTORS.message)).toHaveValue(
          'A message long enough to be accepted.',
        );
        await shot(`L6-${tag}`, form);
        release();
        await expect(page.getByTestId('contact-success')).toBeVisible();
      });

      test(`${tag}: E5 each invalid field says how to fix it and keeps the text`, async ({
        page,
      }) => {
        await installMockBackend(page, { contact: 'happy', log: 'accept' });
        await page.setViewportSize(viewport.size);
        const form = await openForm(page, locale);
        await page.locator(FIELD_SELECTORS.email).fill('erik@');
        await page.locator(FIELD_SELECTORS.message).fill('oi');
        await form
          .getByRole('button', { name: contactCopy[locale].form.submit, exact: true })
          .click();

        const summary = form.getByRole('alert');
        await expect(summary).toBeFocused();
        await expect(summary).toContainText(
          locale === 'pt' ? '! 3 campos precisam de ajuste' : '! 3 fields need fixing',
        );
        await expect(page.locator(FIELD_SELECTORS.email)).toHaveValue('erik@');
        await expect(form.locator('.field-error').nth(1)).toContainText(
          locale === 'pt'
            ? '> falta o domínio, por exemplo voce@empresa.com'
            : '> missing the domain, for example you@company.com',
        );
        await shot(`E5-${tag}`, form);
      });

      test(`${tag}: E6 queued is a status with no request id and no success copy`, async ({
        page,
      }) => {
        await installMockBackend(page, { contact: 'queued', log: 'accept' });
        await page.setViewportSize(viewport.size);
        const form = await openForm(page, locale);
        await fillValid(page);
        await form
          .getByRole('button', { name: contactCopy[locale].form.submit, exact: true })
          .click();

        const queued = page.getByTestId('contact-queued');
        await expect(queued).toContainText(contactCopy[locale].queued.title);
        await expect(queued).not.toContainText('contact-test-request-id');
        await expect(page.getByTestId('contact-success')).toHaveCount(0);
        const type = await queued.evaluate((node) => {
          const title = node.querySelector('.contact-state-title');
          const body = node.querySelectorAll(':scope > p');
          return {
            title: title ? getComputedStyle(title).fontSize : '',
            body: body[1] ? getComputedStyle(body[1]).fontSize : '',
          };
        });
        expect(type.title, 'the title states its own size').toBe('16px');
        expect(type.body, 'the body sits one canonical step below the title').toBe('14px');
        await shot(`E6-${tag}`, queued);
      });

      test(`${tag}: E7 the queued notice opens the way back to a new message`, async ({ page }) => {
        await installMockBackend(page, { contact: 'queued', log: 'accept' });
        await page.setViewportSize(viewport.size);
        const form = await openForm(page, locale);
        await fillValid(page);
        await form
          .getByRole('button', { name: contactCopy[locale].form.submit, exact: true })
          .click();

        const queued = page.getByTestId('contact-queued');
        await expect(queued).toBeVisible();
        const dismiss = queued.getByRole('button', { name: contactCopy[locale].dismiss.aria });
        await expect(dismiss).toBeVisible();
        await expect(dismiss).toHaveText(contactCopy[locale].dismiss.label);

        const row =
          (await page.locator('.contact-action-row').boundingBox()) ??
          ({ x: 0, y: 0, width: 0, height: 0 } as const);
        const button =
          (await dismiss.boundingBox()) ?? ({ x: 0, y: 0, width: 0, height: 0 } as const);
        expect(row.width).toBeGreaterThan(0);
        expect(button.width).toBeGreaterThan(0);
        expect(
          Math.abs(row.x + row.width - (button.x + button.width)),
          'the dismiss button sits at the far right of the row',
        ).toBeLessThan(SUBPIXEL_PX);
        const paint = await dismiss.evaluate((node) => {
          const style = getComputedStyle(node);
          return { color: style.color, border: style.borderTopColor };
        });
        expect(paint.color, 'the dismiss button wears the theme green').toBe('rgb(0, 255, 65)');
        expect(paint.border, 'the dismiss button wears the theme green').toBe('rgb(0, 255, 65)');

        await dismiss.click();
        await expect(page.getByTestId('contact-form')).toBeVisible();
        await expect(page.locator(FIELD_SELECTORS.message)).toBeFocused();
        await expect(page.locator(FIELD_SELECTORS.name)).toHaveValue('Ada Lovelace');
        await expect(page.locator(FIELD_SELECTORS.message)).toHaveValue('');
        await shot(`E7-${tag}`, page.getByTestId('contact-form'));
      });
    }
  }
});
