// tests/e2e/ask.spec.ts
//
// Phase 1 anchor tests (1, 7): happy path + X-Request-Id header.
// Phase 2 expansion (2-6): kill-switch, rate-limit, budget-exhausted, stream-error,
//                          pre-stream-timeout.
// Phase 3 expansion (8): privacy notice + mailto link.

import { expect, type Locator, type Page, test } from '@playwright/test';
import { installMockBackend, type MockState } from './_helpers/mock-backend';

async function setupAskPage(page: Page, state: MockState): Promise<void> {
  await installMockBackend(page, state);
  await page.goto('/');
  // Wait for the Shell island to hydrate (shell form is present).
  await page.waitForSelector('.shell__form', { state: 'visible' });
}

function getShellInput(page: Page): Locator {
  return page.locator('.shell__form input[type="text"], .shell__form input:not([type])').first();
}

async function ask(page: Page, question: string): Promise<void> {
  const shellInput = getShellInput(page);
  await shellInput.fill(question);
  await shellInput.press('Enter');
}

test.describe('ask / interactive shell', () => {
  test('1 — happy path: type a question → canned answer renders in shell feed', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'happy', log: 'accept' });
    await ask(page, 'Who is Erik?');

    // After submission the canned mock answer should appear in the feed.
    // The mock returns: "Erik is a Senior Full-Stack Engineer with 8+ years of experience."
    const feed = page.locator('.shell__feed');
    await expect(feed).toContainText('Erik is a Senior Full-Stack Engineer', { timeout: 10_000 });
  });

  test('2 — kill switch on: 503 surfaces "temporarily unavailable" message', async ({ page }) => {
    // Mock returns 503 with { error: 'temporarily unavailable — email ... directly' }.
    // InteractiveShell.streamQuestion reads data.error on !res.ok and renders it via
    // an error line in the shell feed (kind: 'error', prefixed with "error: ").
    await setupAskPage(page, { ask: 'kill-switch', log: 'accept' });
    await ask(page, 'are you available?');

    const errorLine = page.locator('.shell__feed .shell__line--error');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('temporarily unavailable');
  });

  test('3 — rate-limit hit: 429 surfaces "try again in an hour"', async ({ page }) => {
    // Mock returns 429 with { error: 'rate limit exceeded — try again in an hour' }.
    await setupAskPage(page, { ask: 'rate-limit', log: 'accept' });
    await ask(page, 'spammy question');

    const errorLine = page.locator('.shell__feed .shell__line--error');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('try again in an hour');
  });

  test('4 — budget exhausted: 503 surfaces budget message', async ({ page }) => {
    // Mock returns 503 with { error: 'monthly budget exhausted — email ... directly' }.
    // Same UI shape as kill-switch (both 503 + JSON error body), but distinct
    // copy that the user actually sees.
    await setupAskPage(page, { ask: 'budget-exhausted', log: 'accept' });
    await ask(page, 'what is your stack?');

    const errorLine = page.locator('.shell__feed .shell__line--error');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('budget exhausted');
  });

  test('5 — stream error: STREAM_ERR_SENTINEL mid-stream renders an error line', async ({
    page,
  }) => {
    // Mock streams the sentinel + "upstream error". The client splits the buffer
    // at the sentinel: anything before becomes the output line, anything after
    // becomes the error message. Here the sentinel arrives at byte 0 so only the
    // error line should render.
    await setupAskPage(page, { ask: 'stream-error', log: 'accept' });
    await ask(page, 'tell me about your projects');

    const errorLine = page.locator('.shell__feed .shell__line--error');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('upstream error');
  });

  test('6 — pre-stream timeout: SDK rejects before SSE starts → error line, no crash', async ({
    page,
  }) => {
    // Spec 1 fix: when Anthropic SDK times out before the first chunk, the route
    // emits STREAM_ERR_SENTINEL + "Request Timeout" instead of leaking an
    // unhandled rejection. The shell renders the timeout as a normal error line.
    await setupAskPage(page, { ask: 'pre-stream-timeout', log: 'accept' });
    await ask(page, 'slow question');

    const errorLine = page.locator('.shell__feed .shell__line--error');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('Request Timeout');

    // No unhandled crash: the shell input must be re-enabled after the failure
    // so the user can retry without reloading.
    await expect(getShellInput(page)).toBeEnabled();
  });

  test('7 — X-Request-Id header is the deterministic value from the happy mock', async ({
    page,
  }) => {
    // Single source of truth: the `ask: 'happy'` mock in mock-backend.ts owns
    // the X-Request-Id contract (deterministic value 'test-request-id-abc123').
    // We deliberately do NOT register a standalone page.route('**/api/ask', ...)
    // here — a second handler would race the mock-backend registration and the
    // ordering would silently determine which response wins.
    let requestId: string | null = null;

    page.on('response', (resp) => {
      if (resp.url().includes('/api/ask')) {
        requestId = resp.headers()['x-request-id'] ?? null;
      }
    });

    await setupAskPage(page, { ask: 'happy', log: 'accept' });
    await ask(page, 'Test question for header check');

    // Wait for the response to arrive.
    await page.waitForFunction(() => document.querySelector('.shell__line--output') !== null, {
      timeout: 10_000,
    });

    // Assert the exact value emitted by the happy mock. Pinning (vs. just
    // non-empty) makes any future drift in mock-backend.ts an intentional,
    // reviewable change instead of silently passing through.
    expect(requestId).toBe('test-request-id-abc123');
  });

  test('8 — privacy notice is visible with a working mailto: link to the canonical email', async ({
    page,
  }) => {
    // The privacy notice was added in PR #11 directly below the /api/ask form
    // inside InteractiveShell. It tells the visitor that queries are stored 90
    // days and points to the canonical contact email for deletion requests.
    // Neither the form nor /api/ask need to be exercised — we only assert that
    // (a) the notice is rendered in the DOM after the shell hydrates, and
    // (b) the mailto target matches the single source of truth used by
    // content/social.ts, /api/contact, /api/ask, and the manpage section.
    //
    // No ask state is configured: if the test accidentally fires /api/ask the
    // mock-backend default-throw branch will surface it as a real failure.
    await setupAskPage(page, { log: 'accept' });

    const notice = page.locator('.shell__privacy-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Queries are stored 90 days');
    await expect(notice).toContainText('To request deletion');

    // The mailto: link is the only <a> inside the notice. Pinning the exact
    // address (vs. asserting "starts with mailto:") makes a drift between the
    // notice copy and the canonical email a reviewable change instead of
    // silently passing through.
    const mailLink = notice.locator('a[href^="mailto:"]');
    await expect(mailLink).toBeVisible();
    await expect(mailLink).toHaveAttribute('href', 'mailto:erikhenriquealvescunha@gmail.com');
    await expect(mailLink).toHaveText('erikhenriquealvescunha@gmail.com');
  });
});
