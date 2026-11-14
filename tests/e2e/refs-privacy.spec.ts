import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { waitForConfirmArmed } from './_helpers/shell';

const REF_A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const REF_B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const CONTACT_REF = 'contact-test-request-id';
const MAILTO_SHORT_REF_LENGTH = 8;
const SHELL_INPUT = '[aria-label="shell command"]';
const SHELL_FORM = '[data-testid="shell-form"]';
const NARROW = { width: 320, height: 700 };
const SUBPIXEL_PX = 1;
const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];

async function openShell(page: Page, refs: string[], forgetStatus = 200) {
  const queue = [...refs];
  await page.route('**/api/ask', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'X-Request-Id': queue.shift() ?? REF_A },
      body: 'An answer.',
    }),
  );
  const forgotten: string[] = [];
  await page.route('**/api/log/forget', async (route) => {
    forgotten.push((route.request().postDataJSON() as { requestId: string }).requestId);
    await route.fulfill({
      status: forgetStatus,
      contentType: 'application/json',
      body: JSON.stringify({ ok: forgetStatus === 200, requestId: 'forget-call' }),
    });
  });
  await page.goto('/');
  await waitForHydration(page, SHELL_FORM);
  return forgotten;
}

async function run(page: Page, command: string) {
  await page.locator(SHELL_INPUT).first().fill(command);
  await page.keyboard.press('Enter');
}

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(
    (slack) => document.documentElement.scrollWidth <= document.documentElement.clientWidth + slack,
    SUBPIXEL_PX,
  );

test.describe('request refs and privacy', () => {
  test('an answer ends with the conversation receipt and its forget deletes the conversation', async ({
    page,
  }) => {
    const forgotten = await openShell(page, [REF_A]);
    await run(page, 'what does erik do?');
    const receipt = page.getByTestId('shell-receipt');
    await expect(receipt.locator('code')).toHaveText(REF_A);
    await receipt.getByRole('button', { name: ui.forget, exact: true }).click();
    await waitForConfirmArmed(page);
    await receipt.getByRole('button', { name: ui.forgetConfirm, exact: true }).click();
    await expect(receipt).toHaveCount(0);
    expect(forgotten).toEqual([REF_A]);
    await expect(page.getByRole('log', { name: ui.outputLabel })).toContainText(
      ui.conversationForgotten,
    );
  });

  test('privacy lists this session ids and forgets the conversation through one of them', async ({
    page,
  }) => {
    const forgotten = await openShell(page, [REF_A, REF_B]);
    await run(page, 'first question');
    await expect(page.getByTestId('shell-receipt')).toHaveCount(1);
    await run(page, 'second question');
    await expect(page.getByTestId('shell-receipt').locator('code')).toHaveText(REF_B);
    await run(page, 'privacy');
    const feed = page.getByRole('log', { name: ui.outputLabel });
    await expect(feed).toContainText(`1. ${REF_A}`);
    await expect(feed).toContainText(`2. ${REF_B}`);
    await run(page, 'privacy forget --all');
    await expect(feed).toContainText(`${REF_B} ${ui.forgetDeleted}`);
    expect(forgotten).toEqual([REF_B]);
    await run(page, 'privacy');
    await expect(feed).toContainText(ui.privacyEmpty);
  });

  test('privacy forget stops with a wait time when the endpoint answers 429', async ({ page }) => {
    await openShell(page, [REF_A]);
    await page.unroute('**/api/log/forget');
    await page.route('**/api/log/forget', (route) =>
      route.fulfill({ status: 429, headers: { 'Retry-After': '120' }, body: '{}' }),
    );
    await run(page, 'a question');
    await expect(page.getByTestId('shell-receipt')).toHaveCount(1);
    await run(page, 'privacy forget 1');
    await expect(page.getByRole('log', { name: ui.outputLabel })).toContainText(
      `2 ${states.minutesUnit}`,
    );
  });

  test('the footer signals the last request without its id, and follows a forget', async ({
    page,
  }) => {
    await openShell(page, [REF_A]);
    const receipt = page.getByTestId('footer-receipt');
    await expect(receipt).toHaveCount(0);
    await run(page, 'a question');
    await expect(page.getByTestId('shell-receipt')).toHaveCount(1);
    await expect(receipt).toHaveCount(1);
    await expect(receipt).not.toContainText(REF_A);
    const shellReceipt = page.getByTestId('shell-receipt');
    await shellReceipt.getByRole('button', { name: ui.forget, exact: true }).click();
    await waitForConfirmArmed(page);
    await shellReceipt.getByRole('button', { name: ui.forgetConfirm, exact: true }).click();
    await expect(receipt).toHaveCount(0);
  });

  test('at 320px the shell receipt, the privacy list and the footer receipt do not overflow', async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await openShell(page, [REF_A]);
    await run(page, 'a question');
    await expect(page.getByTestId('shell-receipt')).toBeVisible();
    await run(page, 'privacy');
    await expect(page.getByTestId('footer-receipt')).toHaveCount(1);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('a failed contact send shows no ref to the visitor but keeps it in the mailto', async ({
    page,
  }) => {
    await installMockBackend(page, { contact: 'server-error', log: 'accept' });
    await page.setViewportSize(NARROW);
    await page.goto('/');
    const form = page.getByTestId('contact-form');
    await form.scrollIntoViewIfNeeded();
    await waitForHydration(page, '[data-testid="contact-form"]');
    await page.locator('input[name="name"]').fill('Ada Lovelace');
    await page.locator('input[name="email"]').fill('ada@example.com');
    await page.locator('textarea[name="message"]').fill('A message long enough to be accepted.');
    await form
      .getByRole('button', { name: contactCopy[SITE_LOCALE.en].form.submit, exact: true })
      .click();
    const alert = form.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(CONTACT_REF);
    await expect(alert.locator('.ref-chip')).toHaveCount(0);
    const href = (await alert.locator('a[href^="mailto:"]').getAttribute('href')) ?? '';
    const subject = new URL(href).searchParams.get('subject');
    expect(subject).toBe(`[ref ${CONTACT_REF.slice(0, MAILTO_SHORT_REF_LENGTH)}] contact`);
    expect(new URL(href).searchParams.get('body')).toContain(CONTACT_REF);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
