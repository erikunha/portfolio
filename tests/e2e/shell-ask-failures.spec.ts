import { expect, type Page, test } from '@playwright/test';
import { askErrors } from '../../content/ask-errors';
import { SITE_LOCALE } from '../../content/site-locale';
import { STREAM_ERR_SENTINEL } from '../../lib/stream-protocol';
import { installChunkedAsk, installMockBackend, type MockState } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy } from './_helpers/shell';

const { ui, states } = shellCopy();
const EN = askErrors[SITE_LOCALE.en];
const QUESTION = 'are you there?';
const PARTIAL = 'Erik builds agent ';
const LOCAL_COMMAND = 'cat stack.md';
const LOCAL_COMMAND_OUTPUT = 'llm systems';
const SERVER_ERROR_REFERENCE = 'server-error-request-id';
const CHUNKED_FIRST_REFERENCE = 'chunked-request-id-1';
const HTTP_UNAVAILABLE = 503;
const HTTP_SERVER_ERROR = 500;

async function expectLocalCommandStillWorks(page: Page) {
  const outputs = page.locator(SHELL_SELECTOR.output);
  const before = await outputs.count();
  await askShell(page, LOCAL_COMMAND);
  await expect(outputs).toHaveCount(before + 1);
  await expect(outputs.last()).toContainText(LOCAL_COMMAND_OUTPUT);
}

async function expectDraftRestored(page: Page) {
  const input = page.locator(SHELL_SELECTOR.input);
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue(QUESTION);
}

test.beforeEach(async ({ page }) => {
  await freezeMotion(page);
});

test.describe('a stream that fails mid answer', () => {
  test('keeps the partial text, the error line and the request reference, and leaves the input usable', async ({
    page,
  }) => {
    const chunked = await installChunkedAsk(page);
    await openShell(page);
    await askShell(page, QUESTION);
    await expect.poll(chunked.requests).toBe(1);
    await chunked.push(PARTIAL);
    await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(PARTIAL.trim());
    await chunked.push(`${STREAM_ERR_SENTINEL}${EN.interrupted}`);
    await chunked.end();

    await expect(page.locator(SHELL_SELECTOR.output).last()).toHaveText(
      `${ui.aiLabel}: ${PARTIAL.trim()}`,
    );
    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(
      `${ui.errorPrefix} ${EN.interrupted}`,
    );
    await expect(page.locator(SHELL_SELECTOR.error)).not.toContainText(STREAM_ERR_SENTINEL);
    await expect(page.locator(SHELL_SELECTOR.reference)).toContainText(CHUNKED_FIRST_REFERENCE);
    await expect(page.locator(SHELL_SELECTOR.loading)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
    await expectDraftRestored(page);
    await expectLocalCommandStillWorks(page);
  });

  test('with no partial text shows only the error line', async ({ page }) => {
    await installMockBackend(page, { ask: 'stream-error' });
    await openShell(page);
    await askShell(page, QUESTION);

    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(
      `${ui.errorPrefix} ${EN.interrupted}`,
    );
    await expect(page.locator(SHELL_SELECTOR.output).filter({ hasText: ui.aiLabel })).toHaveCount(
      0,
    );
    await expect(page.locator(SHELL_SELECTOR.reference)).toHaveCount(1);
    await expectDraftRestored(page);
  });
});

test.describe('a request that fails before any answer', () => {
  test('a 500 shows the status line, the fallback hint and the reference, and restores the draft', async ({
    page,
  }) => {
    await installMockBackend(page, { ask: 'server-error' });
    await openShell(page);
    await askShell(page, QUESTION);

    await expect(page.locator(`${SHELL_SELECTOR.error} strong`)).toHaveText(
      `${states.stderrCommand} ${HTTP_SERVER_ERROR}`,
    );
    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(ui.serverError);
    await expect(page.locator(SHELL_SELECTOR.hint)).toContainText(
      `${states.tryPrefix} ${states.tryCommand} ${states.trySuffix}`,
    );
    await expect(page.locator(SHELL_SELECTOR.reference)).toContainText(SERVER_ERROR_REFERENCE);
    await expectDraftRestored(page);
    await expectLocalCommandStillWorks(page);
  });

  test('a failed connection shows the network error line and restores the draft', async ({
    page,
  }) => {
    await installMockBackend(page, { ask: 'network-error' });
    await openShell(page);
    await askShell(page, QUESTION);

    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(
      `${ui.errorPrefix} ${ui.networkError}`,
    );
    await expect(page.locator(SHELL_SELECTOR.loading)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.reference)).toHaveCount(0);
    await expectDraftRestored(page);
    await expectLocalCommandStillWorks(page);
  });
});

type Refusal = { state: NonNullable<MockState['ask']>; copy: string };

const REFUSALS: readonly Refusal[] = [
  { state: 'kill-switch', copy: EN.unavailable },
  { state: 'budget-exhausted', copy: EN.budget },
  { state: 'budget-daily', copy: EN.budgetDaily },
];

test.describe('a refusal from the server', () => {
  for (const refusal of REFUSALS) {
    test(`${refusal.state} shows its own copy and keeps the local commands working`, async ({
      page,
    }) => {
      await installMockBackend(page, { ask: refusal.state });
      await openShell(page);
      await askShell(page, QUESTION);

      await expect(page.locator(`${SHELL_SELECTOR.error} strong`)).toHaveText(
        `${states.stderrCommand} ${HTTP_UNAVAILABLE}`,
      );
      await expect(page.locator(SHELL_SELECTOR.error)).toContainText(refusal.copy);
      for (const other of REFUSALS.filter((entry) => entry.copy !== refusal.copy)) {
        await expect(page.locator(SHELL_SELECTOR.error)).not.toContainText(other.copy);
      }
      await expect(page.locator(SHELL_SELECTOR.hint)).toContainText(states.tryCommand);
      await expectDraftRestored(page);
      await expectLocalCommandStillWorks(page);
    });
  }
});
