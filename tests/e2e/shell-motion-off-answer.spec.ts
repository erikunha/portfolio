import { expect, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { installChunkedAsk } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy } from './_helpers/shell';

const { ui } = shellCopy();
const QUESTION = 'what does Erik build?';
const ANSWER =
  'Erik builds agent platforms, eval harnesses and guardrails for production language model systems.';
const PLACEHOLDER = '[data-testid="shell-placeholder"]';
const NO_ANIMATION = 'none';

test('with MOTION off the answer lands whole and the carets stay still', async ({ page }) => {
  await freezeMotion(page);
  const chunked = await installChunkedAsk(page);
  await openShell(page);
  await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
  await askShell(page, QUESTION);
  await expect.poll(chunked.requests).toBe(1);

  await chunked.push(ANSWER);
  await settleFrames(page);
  await expect(
    page.locator(SHELL_SELECTOR.output).last(),
    'the whole chunk must render on the next frame, not character by character',
  ).toContainText(ANSWER);
  const caret = page.locator(SHELL_SELECTOR.caret);
  await expect(caret).toBeVisible();
  expect(await caret.evaluate((node) => getComputedStyle(node).animationName)).toBe(NO_ANIMATION);

  await chunked.end();
  await expect(page.locator(SHELL_SELECTOR.output).last()).toHaveText(`${ui.aiLabel}: ${ANSWER}`);
  await expect(caret).toHaveCount(0);
  await expect(page.locator(SHELL_SELECTOR.reference)).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.locator(SHELL_SELECTOR.input)).not.toBeFocused();
  const placeholder = page.locator(PLACEHOLDER);
  await expect(placeholder).toHaveText(ui.placeholder);
  expect(
    await page
      .locator('[data-testid="shell-cursor"]')
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe(NO_ANIMATION);
});
