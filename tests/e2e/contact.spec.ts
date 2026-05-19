// tests/e2e/contact.spec.ts
//
// Phase 1 anchor tests: contact form happy path + blank-submit validation.
// Full surface (tests 3-4: rate-limit, server-error) ships in Phase 2.
// Test 5 (honeypot trip) was removed — the honeypot field was planned but never built.

import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

test.describe('contact form', () => {
  test.beforeEach(async ({ page }) => {
    // Install mocks before navigation so no real /api/* call escapes.
    await installMockBackend(page, {
      contact: 'happy',
      log: 'accept',
    });
    await page.goto('/');
    // Scroll the contact section into view. It is below the fold.
    await page.locator('#sec-contact').scrollIntoViewIfNeeded();
    // Wait for the lazy-loaded ContactForm island to hydrate.
    await page.waitForSelector('form.contact', { state: 'visible' });
  });

  test('1 — happy path: fill all fields and submit → success state', async ({ page }) => {
    // Fill the name field (first input inside form.contact).
    await page.locator('form.contact input[autocomplete="name"]').fill('Test User');
    // Fill the email field.
    await page.locator('form.contact input[type="email"]').fill('test@example.com');
    // Fill the message textarea (minLength=10 required).
    await page.locator('form.contact textarea').fill('Hello, this is a test message long enough.');

    // Submit the form.
    await page.locator('form.contact button[type="submit"]').click();

    // After success the form is replaced by the success div.
    const successEl = page.locator('.contact.contact--success[role="status"]');
    await expect(successEl).toBeVisible({ timeout: 5_000 });
    // The success message uses terminal-style copy.
    await expect(successEl).toContainText('EXECUTE_SEND :: SUCCESS');
  });

  test('2 — validation: blank submit shows field-level error (browser native)', async ({ page }) => {
    // Click submit without filling any fields. The browser prevents submission
    // via HTML5 validation (required attributes). No fetch call reaches /api/contact.
    await page.locator('form.contact button[type="submit"]').click();

    // The form must still be visible (not replaced by success state).
    await expect(page.locator('form.contact')).toBeVisible();
    // The name input must be invalid per the Constraint Validation API.
    const nameInput = page.locator('form.contact input[autocomplete="name"]');
    await expect(nameInput).toHaveAttribute('required');
    // Playwright exposes :invalid pseudo-class via evaluate.
    const isInvalid = await nameInput.evaluate(
      (el) => !((el as HTMLInputElement).validity.valid),
    );
    expect(isInvalid).toBe(true);
  });
});
