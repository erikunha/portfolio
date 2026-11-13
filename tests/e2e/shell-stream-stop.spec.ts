import { expect, type Page, test } from '@playwright/test';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy, stopButton } from './_helpers/shell';

const { ui } = shellCopy();
const QUESTION = 'what does Erik build?';
const FIRST_CHUNK = 'Erik builds agent ';
const SECOND_QUESTION = 'and what else?';
const SECOND_ANSWER = 'He also plays guitar.';

type StopPath = { name: string; stop: (page: Page) => Promise<void> };

const STOP_PATHS: readonly StopPath[] = [
  {
    name: 'the Escape key typed in the input',
    stop: async (page) => {
      await page.locator(SHELL_SELECTOR.input).focus();
      await page.keyboard.press('Escape');
    },
  },
  {
    name: 'a click on STOP',
    stop: async (page) => {
      await stopButton(page).click();
    },
  },
  {
    name: 'keyboard activation of STOP after tabbing to it',
    stop: async (page) => {
      await stopButton(page).focus();
      await page.keyboard.press('Enter');
    },
  },
];

async function openStreamingShell(page: Page) {
  await freezeMotion(page);
  const chunked = await installChunkedAsk(page);
  await openShell(page);
  await askShell(page, QUESTION);
  await expect.poll(chunked.requests).toBe(1);
  await chunked.push(FIRST_CHUNK);
  await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(FIRST_CHUNK.trim());
  await expect(page.locator(SHELL_SELECTOR.caret)).toBeVisible();
  return chunked;
}

test.describe('stopping a real chunked answer', () => {
  test('keeps the partial text, frees the input and lets a second question stream and settle', async ({
    page,
  }) => {
    const chunked = await openStreamingShell(page);
    await stopButton(page).click();

    await expect(stopButton(page)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.output).last()).toContainText(FIRST_CHUNK.trim());
    await expect(page.locator(SHELL_SELECTOR.info).last()).toHaveText(ui.stoppedPartial);
    await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.loading)).toHaveCount(0);
    expect(await chunked.aborted(), 'stopping must cancel the transport').toBe(1);
    const input = page.locator(SHELL_SELECTOR.input);
    await expect(input).toBeEnabled();
    await expect(input).toBeFocused();

    await askShell(page, SECOND_QUESTION);
    await expect.poll(chunked.requests).toBe(2);
    await expect(stopButton(page)).toBeVisible();
    await chunked.push(SECOND_ANSWER);
    await chunked.end();

    await expect(page.locator(SHELL_SELECTOR.output).last()).toHaveText(
      `${ui.aiLabel}: ${SECOND_ANSWER}`,
    );
    await expect(stopButton(page)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.loading)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.caret)).toHaveCount(0);
    await expect(
      page.locator(SHELL_SELECTOR.output).filter({ hasText: FIRST_CHUNK.trim() }),
    ).toHaveCount(1);
    await expect(page.locator(SHELL_SELECTOR.reference)).toHaveCount(2);
    await expect(page.locator(SHELL_SELECTOR.feed)).toHaveAttribute('aria-busy', 'false');
  });

  for (const path of STOP_PATHS) {
    test(`leaves the shell input focused after ${path.name}`, async ({ page }) => {
      await openStreamingShell(page);
      await path.stop(page);
      await expect(page.locator(SHELL_SELECTOR.info).last()).toHaveText(ui.stoppedPartial);
      await expect(page.locator(SHELL_SELECTOR.input)).toBeFocused();
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute('name')),
        'document.activeElement must be the shell input',
      ).toBe('command');
    });
  }
});
