import { expect, type Locator, type Page, test } from '@playwright/test';
import { installMockBackend, type MockState } from '../../../tests/e2e/_helpers/mock-backend';

async function setupAskPage(page: Page, state: MockState): Promise<void> {
  await installMockBackend(page, state);
  await page.goto('/');
  await page.waitForSelector('[data-testid="shell-form"]', { state: 'visible' });
}

function getShellInput(page: Page): Locator {
  return page.locator('[aria-label="shell command"]').first();
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

    const feed = page.locator('[role="log"]');
    await expect(feed).toContainText('Erik is a Senior Full-Stack Engineer', { timeout: 10_000 });
  });

  test('2 — kill switch on: 503 surfaces "temporarily unavailable" message', async ({ page }) => {
    await setupAskPage(page, { ask: 'kill-switch', log: 'accept' });
    await ask(page, 'are you available?');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('temporarily unavailable');
  });

  test('3 — rate-limit hit: 429 surfaces "try again in an hour"', async ({ page }) => {
    await setupAskPage(page, { ask: 'rate-limit', log: 'accept' });
    await ask(page, 'spammy question');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('try again in an hour');
  });

  test('4 — budget exhausted: 503 surfaces budget message', async ({ page }) => {
    await setupAskPage(page, { ask: 'budget-exhausted', log: 'accept' });
    await ask(page, 'what is your stack?');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('budget exhausted');
  });

  test('5 — stream error: STREAM_ERR_SENTINEL mid-stream renders an error line', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'stream-error', log: 'accept' });
    await ask(page, 'tell me about your projects');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('upstream error');
  });

  test('6 — pre-stream timeout: SDK rejects before SSE starts → error line, no crash', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'pre-stream-timeout', log: 'accept' });
    await ask(page, 'slow question');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText('Request Timeout');

    await expect(getShellInput(page)).toBeEnabled();
  });

  test('7 — X-Request-Id header is the deterministic value from the happy mock', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'happy', log: 'accept' });

    const responsePromise = page.waitForResponse('**/api/ask', { timeout: 10_000 });
    await ask(page, 'Test question for header check');
    const response = await responsePromise;
    const requestId = response.headers()['x-request-id'] ?? null;

    expect(requestId).toBe('test-request-id-abc123');
  });

  test('8 — privacy notice is visible with a working mailto: link to the canonical email', async ({
    page,
  }) => {
    await setupAskPage(page, { log: 'accept' });

    const notice = page.locator('[data-testid="shell-privacy-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Queries are stored 90 days');
    await expect(notice).toContainText('To request deletion');

    const mailLink = notice.locator('a[href^="mailto:"]');
    await expect(mailLink).toBeVisible();
    await expect(mailLink).toHaveAttribute('href', 'mailto:erikhenriquealvescunha@gmail.com');
    await expect(mailLink).toHaveText('erikhenriquealvescunha@gmail.com');
  });
});
