// tests/e2e/contact.spec.ts
//
// Phase 1 anchor tests (1-2): happy path + blank-submit validation.
// Phase 2 expansion (3-4): rate-limit + server-error.
// Test 5 (honeypot trip) was removed — the honeypot field was planned but never built.

import { expect, type Page, test } from '@playwright/test';
import { installMockBackend, type MockState } from './_helpers/mock-backend';

async function setupContactPage(page: Page, state: MockState): Promise<void> {
  // Install mocks before navigation so no real /api/* call escapes.
  await installMockBackend(page, state);
  await page.goto('/');
  // Scroll the contact section into view. It is below the fold.
  await page.locator('#sec-contact').scrollIntoViewIfNeeded();
  // Wait for the lazy-loaded ContactForm island to hydrate.
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

    // Submit the form.
    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    // After success the form is replaced by the success div.
    const successEl = page.locator('[data-testid="contact-success"]');
    await expect(successEl).toBeVisible({ timeout: 5_000 });
    // The success message uses terminal-style copy.
    await expect(successEl).toContainText('EXECUTE_SEND :: SUCCESS');
  });

  test('2 — validation: blank submit shows field-level error (browser native)', async ({
    page,
  }) => {
    await setupContactPage(page, { contact: 'happy', log: 'accept' });
    // Click submit without filling any fields. The browser prevents submission
    // via HTML5 validation (required attributes). No fetch call reaches /api/contact.
    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    // The form must still be visible (not replaced by success state).
    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    // The name input must be invalid per the Constraint Validation API.
    const nameInput = page.locator('[data-testid="contact-form"] input[autocomplete="name"]');
    await expect(nameInput).toHaveAttribute('required');
    // Playwright exposes :invalid pseudo-class via evaluate.
    const isInvalid = await nameInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('3 — rate-limited: 429 response surfaces "try again" message to the user', async ({
    page,
  }) => {
    // Mock returns 429 with { error: 'too many requests — try again in 10 minutes' }.
    // ContactForm reads data.error and renders it inside .contact__error[role="alert"].
    await setupContactPage(page, { contact: 'rate-limit', log: 'accept' });
    await fillValidForm(page);

    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    // The form stays mounted (no success replacement) — the error renders inside it.
    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    // Pure semantic selector: scoped to the form, identified by ARIA role only.
    // Survives CSS refactors (e.g. renaming `.contact__error`) without churn.
    const errorEl = page.locator('[data-testid="contact-form"]').getByRole('alert');
    await expect(errorEl).toBeVisible({ timeout: 5_000 });
    // Surfaces the upstream "try again" hint with retry-after window (10 minutes).
    await expect(errorEl).toContainText('try again');
    await expect(errorEl).toContainText('10 minutes');
  });

  test('4 — server-error: 502 response renders graceful error UI, no crash', async ({ page }) => {
    // Mock returns 502 with { error: 'storage unavailable — try again' }, mirroring
    // the real route's KV-failure branch. The page must stay interactive — the form
    // remains mounted and the error renders inside it via role="alert".
    await setupContactPage(page, { contact: 'server-error', log: 'accept' });
    await fillValidForm(page);

    await page.locator('[data-testid="contact-form"] button[type="submit"]').click();

    // Form stays in place — no unhandled crash, no success state.
    await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-success"]')).toHaveCount(0);
    // Pure semantic selector: scoped to the form, identified by ARIA role only.
    // Survives CSS refactors (e.g. renaming `.contact__error`) without churn.
    const errorEl = page.locator('[data-testid="contact-form"]').getByRole('alert');
    await expect(errorEl).toBeVisible({ timeout: 5_000 });
    await expect(errorEl).toContainText('storage unavailable');

    // Sanity: page is still interactive — submit button is re-enabled
    // (status returns to 'error', no longer 'submitting').
    await expect(page.locator('[data-testid="contact-form"] button[type="submit"]')).toBeEnabled();
  });
});
