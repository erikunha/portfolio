import { expect, type Locator, type Page, test } from '@playwright/test';
import { askErrors } from '../../../content/ask-errors';
import { shellUi } from '../../../content/shell-ui';
import { SITE_LOCALE } from '../../../content/site-locale';
import { waitForHydration } from '../../../tests/e2e/_helpers/hydration';
import {
  installMockBackend,
  MOCK_ASK_ANSWER,
  type MockState,
} from '../../../tests/e2e/_helpers/mock-backend';

const SHELL_FORM = '[data-testid="shell-form"]';

async function setupAskPage(page: Page, state: MockState): Promise<void> {
  await installMockBackend(page, state);
  await page.goto('/');
  await page.waitForSelector(SHELL_FORM, { state: 'visible' });
  await waitForHydration(page, SHELL_FORM);
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
  test('1: happy path: type a question → canned answer renders in shell feed', async ({ page }) => {
    await setupAskPage(page, { ask: 'happy', log: 'accept' });
    await ask(page, 'Who is Erik?');

    const feed = page.locator('[role="log"]');
    await expect(feed).toContainText(MOCK_ASK_ANSWER, { timeout: 10_000 });
  });

  test('2: kill switch on: 503 surfaces "temporarily unavailable" message', async ({ page }) => {
    await setupAskPage(page, { ask: 'kill-switch', log: 'accept' });
    await ask(page, 'are you available?');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText(askErrors[SITE_LOCALE.en].unavailable);
  });

  test('3: rate-limit hit: 429 surfaces the rate-limit message', async ({ page }) => {
    await setupAskPage(page, { ask: 'rate-limit', log: 'accept' });
    await ask(page, 'spammy question');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText(askErrors[SITE_LOCALE.en].rateLimited);
  });

  test('4: budget exhausted: 503 surfaces budget message', async ({ page }) => {
    await setupAskPage(page, { ask: 'budget-exhausted', log: 'accept' });
    await ask(page, 'what is your stack?');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText(askErrors[SITE_LOCALE.en].budget);
  });

  test('4b: daily slice used up: 503 surfaces the day copy, not the month copy', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'budget-daily', log: 'accept' });
    await ask(page, 'what is your stack?');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText(askErrors[SITE_LOCALE.en].budgetDaily);
    await expect(errorLine).not.toContainText(askErrors[SITE_LOCALE.en].budget);
  });

  test('5: stream error: STREAM_ERR_SENTINEL mid-stream renders an error line', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'stream-error', log: 'accept' });
    await ask(page, 'tell me about your projects');

    const errorLine = page.locator('[role="log"] [data-kind="error"]');
    await expect(errorLine).toBeVisible({ timeout: 10_000 });
    await expect(errorLine).toContainText(askErrors[SITE_LOCALE.en].interrupted);
  });

  test('6: X-Request-Id header is the deterministic value from the happy mock', async ({
    page,
  }) => {
    await setupAskPage(page, { ask: 'happy', log: 'accept' });

    const responsePromise = page.waitForResponse('**/api/ask', { timeout: 10_000 });
    await ask(page, 'Test question for header check');
    const response = await responsePromise;
    const requestId = response.headers()['x-request-id'] ?? null;

    expect(requestId).toBe('test-request-id-abc123');
  });

  test('7: privacy notice is visible with a working mailto: link to the canonical email', async ({
    page,
  }) => {
    await setupAskPage(page, { log: 'accept' });

    const notice = page.locator('[data-testid="shell-privacy-notice"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(shellUi[SITE_LOCALE.en].privacy);

    const mailLink = notice.locator('a[href^="mailto:"]');
    await expect(mailLink).toBeVisible();
    await expect(mailLink).toHaveAttribute('href', 'mailto:erikhenriquealvescunha@gmail.com');
    await expect(mailLink).toHaveText('erikhenriquealvescunha@gmail.com');
  });
});

test('toolbar chips fill the prompt instead of submitting', async ({ page }) => {
  await setupAskPage(page, { ask: 'happy', log: 'accept' });

  const toolbar = page.locator('[data-testid="shell-commands"]');
  await expect(toolbar.getByRole('button')).toHaveText([...shellUi[SITE_LOCALE.en].commands]);

  await toolbar.getByRole('button', { name: 'help' }).click();

  const shellInput = getShellInput(page);
  await expect(shellInput).toHaveValue('help');
  await expect(shellInput).toBeFocused();
  const feed = page.locator('[role="log"]');
  await expect(feed).not.toContainText('commands:');

  await shellInput.press('Enter');
  await expect(feed).toContainText('commands:');
});

test('the first line is the welcome for the viewport the visitor is on', async ({ page }) => {
  await setupAskPage(page, { ask: 'happy', log: 'accept' });
  const { welcome, mobileWelcome } = shellUi[SITE_LOCALE.en];
  const isMobile = test.info().project.name.includes('mobile');
  await expect(
    page.locator('[role="log"]'),
    'hydration must not freeze the desktop welcome the server rendered',
  ).toContainText(isMobile ? mobileWelcome : welcome);
});

test('the clear chip still runs immediately', async ({ page }) => {
  await setupAskPage(page, { ask: 'happy', log: 'accept' });
  await ask(page, 'Who is Erik?');
  await expect(page.locator('[role="log"]')).toContainText(MOCK_ASK_ANSWER, {
    timeout: 10_000,
  });

  await page
    .locator('[data-testid="shell-commands"]')
    .getByRole('button', { name: 'clear' })
    .click();

  const { welcome, mobileWelcome } = shellUi[SITE_LOCALE.en];
  const isMobile = test.info().project.name.includes('mobile');
  await expect(page.locator('[role="log"]')).toContainText(isMobile ? mobileWelcome : welcome);
  await expect(getShellInput(page)).toHaveValue('');
});

test('quick commands read as inert while an answer is pending', async ({ page }) => {
  await setupAskPage(page, { ask: 'happy', log: 'accept' });
  const neverSettles = () => new Promise<void>(() => undefined);
  await page.route('**/api/ask', neverSettles);
  await ask(page, 'Who is Erik?');

  const hint = page.locator('.shell-cmd-hint').first();
  await expect(hint).toHaveAttribute('aria-disabled', 'true');
  await hint.hover();
  const style = await hint.evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      opacity: computed.opacity,
      textShadow: computed.textShadow,
      background: computed.backgroundColor,
    };
  });
  expect(style.opacity, 'inert quick commands must look dimmed').toBe('0.5');
  expect(style.textShadow, 'hover glow must not fire on an inert command').toBe('none');
  expect(style.background, 'hover highlight must not fire on an inert command').toBe(
    'rgba(0, 0, 0, 0)',
  );
});
