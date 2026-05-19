// tests/e2e/ask.spec.ts
//
// Phase 1 anchor tests: ask happy path + X-Request-Id header assertion.
// Full surface (tests 2-6, 8: error states + privacy notice) ships in Phase 2.

import { expect, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

test.describe('ask / interactive shell', () => {
  test.beforeEach(async ({ page }) => {
    await installMockBackend(page, {
      ask: 'happy',
      log: 'accept',
    });
    await page.goto('/');
    // Wait for the Shell island to hydrate (shell form is present).
    await page.waitForSelector('.shell__form', { state: 'visible' });
  });

  test('1 — happy path: type a question → canned answer renders in shell feed', async ({ page }) => {
    // Type a question into the shell input.
    const shellInput = page.locator('.shell__form input[type="text"], .shell__form input:not([type])').first();
    await shellInput.fill('Who is Erik?');
    await shellInput.press('Enter');

    // After submission the canned mock answer should appear in the feed.
    // The mock returns: "Erik is a Senior Full-Stack Engineer with 8+ years of experience."
    const feed = page.locator('.shell__feed');
    await expect(feed).toContainText('Erik is a Senior Full-Stack Engineer', { timeout: 10_000 });
  });

  test('7 — X-Request-Id header is present and non-empty in /api/ask response', async ({ page }) => {
    // Intercept the /api/ask response to capture headers.
    let requestId: string | null = null;

    page.on('response', (resp) => {
      if (resp.url().includes('/api/ask')) {
        requestId = resp.headers()['x-request-id'] ?? null;
      }
    });

    const shellInput = page.locator('.shell__form input[type="text"], .shell__form input:not([type])').first();
    await shellInput.fill('Test question for header check');
    await shellInput.press('Enter');

    // Wait for the response to arrive.
    await page.waitForFunction(() => document.querySelector('.shell__line--output') !== null, { timeout: 10_000 });

    expect(requestId).not.toBeNull();
    expect(requestId).not.toBe('');
  });
});
