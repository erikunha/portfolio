import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { localizedSectionLabel, SECTION_ID } from '@/content/section-registry';
import { shellUi } from '@/content/shell-ui';
import {
  LANGUAGE_SWITCH_NAME,
  SITE_HTML_LANG,
  SITE_LOCALE,
  type SiteLocale,
} from '@/content/site-locale';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend, MOCK_ASK_ANSWER } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const SHELL_FORM = '[data-testid="shell-form"]';
const SHELL_INPUT = '[aria-label="shell command"]';
const CONTACT_FORM = '[data-testid="contact-form"]';
const DRAWER = '#section-drawer';
const ABORTED_REQUEST = /ERR_ABORTED|cancelled/i;
const HTTP_ERROR_FLOOR = 400;
const FIRST_QUESTION = 'what do you build?';
const SECOND_QUESTION = 'what is your stack?';

interface Watch {
  problems: string[];
}

function watch(page: Page): Watch {
  const state: Watch = { problems: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') state.problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => state.problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? '';
    if (ABORTED_REQUEST.test(reason)) return;
    state.problems.push(`requestfailed: ${request.url()} ${reason}`);
  });
  page.on('response', (response) => {
    if (response.status() >= HTTP_ERROR_FLOOR) {
      state.problems.push(`response ${response.status()}: ${response.url()}`);
    }
  });
  return state;
}

async function expectHop(
  page: Page,
  state: Watch,
  hop: { path: RegExp; locale: SiteLocale },
): Promise<void> {
  await expect(page).toHaveURL(hop.path);
  await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[hop.locale]);
  expect(state.problems, `after ${page.url()}`).toEqual([]);
}

async function openDrawer(page: Page, locale: SiteLocale): Promise<void> {
  const name = locale === SITE_LOCALE.pt ? 'Abrir menu' : 'Open menu';
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
  await expect(page.locator(DRAWER)).toHaveClass(/is-open/);
}

test('one visitor session: drawer, shell, contact, language switch, CV and links', async ({
  page,
}) => {
  const state = watch(page);
  await installMockBackend(page, { contact: 'happy', log: 'accept', forget: 'happy' });
  let answering = false;
  await page.route('**/api/ask', (route) =>
    answering
      ? route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          headers: { 'X-Request-Id': 'journey-request-id' },
          body: MOCK_ASK_ANSWER,
        })
      : new Promise(() => undefined),
  );
  await freezeMotion(page);

  await gotoSettled(page, '/');
  await waitForHydration(page, SHELL_FORM);
  await expectHop(page, state, { path: /\/$/, locale: SITE_LOCALE.en });

  await openDrawer(page, SITE_LOCALE.en);
  await page
    .locator('#section-nav')
    .getByRole('link', { name: localizedSectionLabel(SITE_LOCALE.en, SECTION_ID.shell) })
    .click();
  await expect(page.locator(`#${SECTION_ID.shell}`)).toBeInViewport();
  await expect(page.locator(DRAWER)).not.toHaveClass(/is-open/);
  await expectHop(page, state, { path: /\/#sec-shell$|\/$/, locale: SITE_LOCALE.en });

  const input = page.locator(SHELL_INPUT);
  await input.fill(FIRST_QUESTION);
  await page.keyboard.press('Enter');
  const stop = page.getByRole('button', { name: shellUi.en.stopLabel });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(stop).toHaveCount(0);
  await expect(page.locator('[data-kind="info"]').last()).toContainText(shellUi.en.stoppedBefore);
  await expectHop(page, state, { path: /\/(#sec-shell)?$/, locale: SITE_LOCALE.en });

  answering = true;
  await input.fill(SECOND_QUESTION);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log')).toContainText(MOCK_ASK_ANSWER);
  await expectHop(page, state, { path: /\/(#sec-shell)?$/, locale: SITE_LOCALE.en });

  await openDrawer(page, SITE_LOCALE.en);
  await page
    .locator('#section-nav')
    .getByRole('link', { name: localizedSectionLabel(SITE_LOCALE.en, SECTION_ID.contact) })
    .click();
  const form = page.locator(CONTACT_FORM);
  await expect(form).toBeVisible();
  await waitForHydration(page, CONTACT_FORM);
  await form.locator('input[name="name"]').fill('Ada Lovelace');
  await form.locator('input[name="email"]').fill('ada@example.com');
  await form.locator('textarea[name="message"]').fill('A message from the journey test.');
  await form.getByRole('button', { name: contactCopy.en.form.submit, exact: true }).click();
  await expect(page.getByTestId('contact-success')).toBeVisible();
  await expectHop(page, state, { path: /\/(#sec-contact)?$/, locale: SITE_LOCALE.en });

  await page
    .getByRole('navigation', { name: /^Language$/ })
    .filter({ visible: true })
    .first()
    .getByRole('link', { name: LANGUAGE_SWITCH_NAME.pt })
    .click();
  await expectHop(page, state, { path: /\/pt(#.*)?$/, locale: SITE_LOCALE.pt });
  await waitForHydration(page, '.menu-trigger');

  await openDrawer(page, SITE_LOCALE.pt);
  await page.locator(`${DRAWER} a[href="/pt/cv"]`).click();
  await expectHop(page, state, { path: /\/pt\/cv$/, locale: SITE_LOCALE.pt });

  await openDrawer(page, SITE_LOCALE.pt);
  await page.locator(`${DRAWER} a[href="/links"]`).click();
  await expectHop(page, state, { path: /\/links$/, locale: SITE_LOCALE.pt });
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
});
