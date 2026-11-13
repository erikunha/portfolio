import type { Locator, Page } from '@playwright/test';
import { SHELL_LIMITS, shellStates, shellUi } from '../../../content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '../../../content/site-locale';
import { waitForHydration } from './hydration';

export const SHELL_SELECTOR = {
  input: '[data-testid="shell-form"] input',
  form: '[data-testid="shell-form"]',
  feed: '[role="log"]',
  output: '[role="log"] [data-kind="output"]',
  info: '[role="log"] [data-kind="info"]',
  error: '[role="log"] [data-kind="error"]',
  hint: '[role="log"] [data-kind="hint"]',
  receipt: '[data-testid="shell-receipt"]',
  receiptMessage: '[data-testid="shell-receipt-message"]',
  stopPill: '.shell-stop-pill',
  loading: '[data-testid="shell-line-loading"]',
  caret: '.shell-caret',
  section: '#sec-shell',
} as const;

export function shellCopy(locale: SiteLocale = SITE_LOCALE.en) {
  return { ui: shellUi[locale], states: shellStates[locale] };
}

export async function openShell(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.getByTestId('shell-form').scrollIntoViewIfNeeded();
  await waitForHydration(page, SHELL_SELECTOR.form);
}

export async function askShell(page: Page, question: string): Promise<void> {
  await page.locator(SHELL_SELECTOR.input).fill(question);
  await page.keyboard.press('Enter');
}

export async function waitForConfirmArmed(page: Page): Promise<void> {
  await page.waitForTimeout(SHELL_LIMITS.confirmArmMs);
}

export function stopButton(page: Page, locale: SiteLocale = SITE_LOCALE.en): Locator {
  return page.getByRole('button', { name: shellUi[locale].stopLabel });
}
