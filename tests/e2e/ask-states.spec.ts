import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';

const SHELL_INPUT = '[aria-label="shell command"]';
const SHELL_FORM = '[data-testid="shell-form"]';
const IDLE_MS = 15_000;
const WAIT_SECONDS = '2280';

async function openShell(page: Page): Promise<void> {
  await page.goto('/');
  await waitForHydration(page, SHELL_FORM);
}

async function ask(page: Page, question: string): Promise<void> {
  await page.locator(SHELL_INPUT).first().fill(question);
  await page.keyboard.press('Enter');
}

test.describe('shell failure and wait states', () => {
  test('a 429 with Retry-After becomes a visible countdown', async ({ page }) => {
    await page.route('**/api/ask', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': WAIT_SECONDS, 'X-Request-Id': 'limited-e2e' },
        body: JSON.stringify({ error: 'rate limit exceeded' }),
      }),
    );
    await openShell(page);
    await ask(page, 'one question too many');
    const notice = page.locator('[data-kind="ratelimit"]');
    await expect(notice).toContainText('! slow down: 38 min until the next question');
    await expect(notice).toContainText('Local commands keep working meanwhile');
    await expect(page.locator('[data-kind="error"]')).toHaveCount(0);
  });

  test('a 503 reads as shell stderr with a local fallback and the request id', async ({ page }) => {
    await page.route('**/api/ask', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'X-Request-Id': 'stderr-e2e' },
        body: JSON.stringify({ error: 'temporarily unavailable' }),
      }),
    );
    await openShell(page);
    await ask(page, 'are you there?');
    await expect(page.locator('[data-kind="error"] strong')).toHaveText('ask: 503');
    await expect(page.locator('[data-kind="hint"]')).toContainText('cat stack.md (works offline)');
    await expect(page.locator('[data-testid="shell-receipt"]')).toHaveCount(0);
  });

  test('Escape in the shell stops a pending answer', async ({ page }) => {
    await page.route('**/api/ask', () => new Promise(() => undefined));
    await openShell(page);
    await ask(page, 'take your time');
    await expect(page.locator('[data-testid="shell-line-loading"]')).toContainText('[ thinking');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-kind="info"]').last()).toContainText('stopped before');
  });

  test('a silent model times out after 15s and the retry resends the question', async ({
    page,
  }) => {
    let asked = 0;
    await page.route('**/api/ask', () => {
      asked += 1;
      return new Promise(() => undefined);
    });
    await page.clock.install();
    await openShell(page);
    await ask(page, 'slow one');
    await page.clock.runFor(IDLE_MS);
    await expect(page.locator('[data-kind="error"]')).toContainText(
      'the model went quiet for 15s. The partial answer above is kept.',
    );
    await page.getByRole('button', { name: 'Retry the last question' }).click();
    await expect.poll(() => asked).toBe(2);
  });
});
