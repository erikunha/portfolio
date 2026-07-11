import { expect, type Page, test } from '@playwright/test';
import { installMockBackend, type MockState } from '../../../tests/e2e/_helpers/mock-backend';

async function setupContactPage(page: Page, state: MockState): Promise<void> {
  await installMockBackend(page, state);
  await page.goto('/');
  await page.locator('#sec-contact').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-testid="contact-form"]', { state: 'visible' });
}

async function fillValidForm(page: Page): Promise<void> {
  await page.locator('[data-testid="contact-form"] input[autocomplete="name"]').fill('Test User');
  await page.locator('[data-testid="contact-form"] input[type="email"]').fill('test@example.com');
  await page
    .locator('[data-testid="contact-form"] textarea')
    .fill('Hello, this is a test message long enough.');
}

test.describe('contact form', () => {
  test('1 — happy path: fill all fields and submit → success state', async ({ page }) => {
    await setupContactPage(page, { contact: 'happy', log: 'accept' });
    await fillValidForm(page);

    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    const successEl = page.locator('[data-testid="contact-success"]');
    await expect(successEl).toBeVisible({ timeout: 5_000 });
    await expect(successEl).toContainText('EXECUTE_SEND :: SUCCESS');
  });

  test('2 — validation: blank submit shows field-level error (browser native)', async ({
    page,
  }) => {
    await setupContactPage(page, { contact: 'happy', log: 'accept' });
    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    const nameInput = page.locator('[data-testid="contact-form"] input[autocomplete="name"]');
    await expect(nameInput).toHaveAttribute('required');
    const isInvalid = await nameInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('3 — rate-limited: 429 response surfaces "try again" message to the user', async ({
    page,
  }) => {
    await setupContactPage(page, { contact: 'rate-limit', log: 'accept' });
    await fillValidForm(page);

    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    const errorEl = page.locator('[data-testid="contact-form"]').getByRole('alert');
    await expect(errorEl).toBeVisible({ timeout: 5_000 });
    await expect(errorEl).toContainText('try again');
    await expect(errorEl).toContainText('10 minutes');
  });

  test('4 — server-error: 502 response renders graceful error UI, no crash', async ({ page }) => {
    await setupContactPage(page, { contact: 'server-error', log: 'accept' });
    await fillValidForm(page);

    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-success"]')).toHaveCount(0);
    const errorEl = page.locator('[data-testid="contact-form"]').getByRole('alert');
    await expect(errorEl).toBeVisible({ timeout: 5_000 });
    await expect(errorEl).toContainText('storage unavailable');

    await expect(page.locator('[data-testid="contact-form"] button[type="submit"]')).toBeEnabled();
  });
});
