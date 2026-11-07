import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';

const REF_A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const REF_B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
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
  test('an answer ends with a req= line and its forget button deletes the record', async ({
    page,
  }) => {
    const forgotten = await openShell(page, [REF_A]);
    await run(page, 'what does erik do?');
    const trailer = page.getByTestId('shell-reference');
    await expect(trailer).toContainText(`${ui.trailerPrefix}${REF_A}`);
    await trailer.getByRole('button', { name: ui.forget }).click();
    await expect(trailer).toContainText(ui.forgetDeleted);
    expect(forgotten).toEqual([REF_A]);
    await expect(trailer.getByRole('button', { name: ui.forget })).toHaveCount(0);
  });

  test('privacy lists this session ids and forgets them all, one result line each', async ({
    page,
  }) => {
    const forgotten = await openShell(page, [REF_A, REF_B]);
    await run(page, 'first question');
    await expect(page.getByTestId('shell-reference')).toHaveCount(1);
    await run(page, 'second question');
    await expect(page.getByTestId('shell-reference')).toHaveCount(2);
    await run(page, 'privacy');
    const feed = page.getByRole('log', { name: ui.outputLabel });
    await expect(feed).toContainText(`1. ${REF_A}`);
    await expect(feed).toContainText(`2. ${REF_B}`);
    await run(page, 'privacy forget --all');
    await expect(feed).toContainText(`${REF_A} ${ui.forgetDeleted}`);
    await expect(feed).toContainText(`${REF_B} ${ui.forgetDeleted}`);
    expect(forgotten).toEqual([REF_A, REF_B]);
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
    await expect(page.getByTestId('shell-reference')).toHaveCount(1);
    await run(page, 'privacy forget 1');
    await expect(page.getByRole('log', { name: ui.outputLabel })).toContainText(
      `2 ${states.minutesUnit}`,
    );
  });

  test('the footer shows the last request only after one is made, and follows a forget', async ({
    page,
  }) => {
    await openShell(page, [REF_A]);
    const receipt = page.getByTestId('footer-receipt');
    await expect(receipt).toHaveCount(0);
    await run(page, 'a question');
    await expect(page.getByTestId('shell-reference')).toHaveCount(1);
    await expect(receipt).toContainText(REF_A);
    await page.getByTestId('shell-reference').getByRole('button', { name: ui.forget }).click();
    await expect(receipt).toHaveCount(0);
  });

  test('at 320px the trailer, the privacy list and the footer receipt do not overflow', async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await openShell(page, [REF_A]);
    await run(page, 'a question');
    await expect(page.getByTestId('shell-reference')).toBeVisible();
    await run(page, 'privacy');
    await expect(page.getByTestId('footer-receipt')).toHaveCount(1);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('a failed contact send shows the ref chip stacked at 320px and a ref-carrying mailto', async ({
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
    const alert = page.getByRole('alert');
    const chip = alert.locator('.ref-chip');
    await expect(chip).toContainText('contact-test-request-id');
    const idBox = await chip.locator('.ref-chip-id').boundingBox();
    const buttonBox = await chip.getByRole('button').boundingBox();
    const chipBox = await chip.boundingBox();
    expect(idBox && buttonBox && chipBox).toBeTruthy();
    expect(buttonBox?.y).toBeGreaterThanOrEqual(
      (idBox?.y ?? 0) + (idBox?.height ?? 0) - SUBPIXEL_PX,
    );
    expect(buttonBox?.width).toBeGreaterThan((chipBox?.width ?? 0) / 2);
    const href = (await alert.locator('a[href^="mailto:"]').getAttribute('href')) ?? '';
    const subject = new URL(href).searchParams.get('subject');
    expect(subject).toBe('[ref contact-] contact');
    expect(new URL(href).searchParams.get('body')).toContain('contact-test-request-id');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
