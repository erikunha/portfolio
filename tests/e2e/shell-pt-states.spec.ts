import { expect, test } from '@playwright/test';
import { askErrors } from '../../content/ask-errors';
import { SITE_HTML_LANG, SITE_LOCALE } from '../../content/site-locale';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, shellCopy, stopButton } from './_helpers/shell';

const PT = SITE_LOCALE.pt;
const { ui, states } = shellCopy(PT);
const PT_PATH = '/pt';
const QUESTION = 'quem é o Erik?';
const HTTP_RATE_LIMITED = 429;
const ENGLISH_SHELL_COPY = shellCopy(SITE_LOCALE.en);

test.beforeEach(async ({ page }) => {
  await freezeMotion(page);
});

test.describe('the shell on the Portuguese page', () => {
  test('declares pt-BR and renders its chrome in Portuguese', async ({ page }) => {
    await installMockBackend(page, { ask: 'rate-limit', locale: PT });
    await openShell(page, PT_PATH);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(SITE_HTML_LANG[PT]);
    await expect(page.locator(SHELL_SELECTOR.input)).toHaveAttribute('aria-label', ui.inputLabel);
    await expect(page.locator(SHELL_SELECTOR.feed)).toHaveAttribute('aria-label', ui.outputLabel);
  });

  test('a 429 reads in Portuguese with the Portuguese fallback', async ({ page }) => {
    await installMockBackend(page, { ask: 'rate-limit', locale: PT });
    await openShell(page, PT_PATH);
    await askShell(page, QUESTION);

    await expect(page.locator(`${SHELL_SELECTOR.error} strong`)).toHaveText(
      `${states.stderrCommand} ${HTTP_RATE_LIMITED}`,
    );
    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(askErrors[PT].rateLimited);
    await expect(page.locator(SHELL_SELECTOR.error)).toContainText(ui.localAvailable);
    await expect(page.locator(SHELL_SELECTOR.error)).not.toContainText(
      ENGLISH_SHELL_COPY.ui.localAvailable,
    );
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(SITE_HTML_LANG[PT]);
  });

  test('Escape stops a pending answer with the Portuguese message and labels', async ({ page }) => {
    await page.route('**/api/ask', () => new Promise(() => undefined));
    await openShell(page, PT_PATH);
    await askShell(page, QUESTION);

    await expect(stopButton(page, PT)).toBeVisible();
    await expect(stopButton(page, PT).locator('.shell-stop-elapsed')).toContainText(
      ui.stopPill.slice(0, ui.stopPill.indexOf('{')),
    );
    await expect(page.locator(SHELL_SELECTOR.loading)).toContainText(
      states.thinkingElapsed.slice(0, states.thinkingElapsed.indexOf('{')),
    );
    await page.keyboard.press('Escape');

    await expect(page.locator(SHELL_SELECTOR.info).last()).toHaveText(ui.stoppedBefore);
    await expect(page.locator(SHELL_SELECTOR.info).last()).not.toContainText(
      ENGLISH_SHELL_COPY.ui.stoppedBefore,
    );
    await expect(stopButton(page, PT)).toHaveCount(0);
    await expect(page.locator(SHELL_SELECTOR.input)).toBeFocused();
  });
});
