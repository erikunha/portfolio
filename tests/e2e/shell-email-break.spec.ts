import { expect, type Locator, type Page, test } from '@playwright/test';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import {
  askShell,
  openShell,
  SHELL_SELECTOR,
  shellCopy,
  waitForConfirmArmed,
} from './_helpers/shell';

const CLASSIC_SCROLLBAR_PX = 15;
const DESKTOP_SCROLLBAR_PX = 11;
const WIDTHS = [320 - CLASSIC_SCROLLBAR_PX, 320, 375] as const;
const DESKTOP_WIDTHS = [320, 375 - DESKTOP_SCROLLBAR_PX, 375] as const;
const VIEWPORT_HEIGHT = 844;
const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const MAIL_LINK = 'a[href^="mailto:"]';
const BREAK_AFTER = '@';
const QUESTION = 'are you there?';

function breaksWithin(link: Locator): Promise<string[]> {
  return link.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const before: string[] = [];
    let previousTop: number | null = null;
    let previousChar = '';
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const content = text.textContent ?? '';
      for (let index = 0; index < content.length; index++) {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        if (previousTop !== null && top !== previousTop) before.push(previousChar);
        previousTop = top;
        previousChar = content.charAt(index);
      }
    }
    return before;
  });
}

async function expectNaturalBreaks(page: Page, scope: string) {
  const links = page.locator(`${scope} ${MAIL_LINK}`);
  await expect(links.first()).toBeVisible();
  for (const link of await links.all()) {
    const breaks = await breaksWithin(link);
    expect(
      breaks.filter((char) => char !== BREAK_AFTER),
      'the address breaks mid word',
    ).toEqual([]);
  }
}

for (const width of WIDTHS) {
  for (const locale of Object.values(SITE_LOCALE)) {
    test.describe(`an email address in the shell at ${width}px (${locale})`, () => {
      test.use({ viewport: { width, height: VIEWPORT_HEIGHT }, isMobile: true, hasTouch: true });
      const { ui } = shellCopy(locale);

      test.beforeEach(async ({ page }) => {
        await freezeMotion(page);
      });

      test('the refusal line and its hint break only after the at sign', async ({ page }) => {
        await installMockBackend(page, { ask: 'kill-switch', locale });
        await openShell(page, PATHS[locale]);
        await askShell(page, QUESTION);
        await expect(page.locator(SHELL_SELECTOR.error)).toContainText(ui.email);
        await expectNaturalBreaks(page, SHELL_SELECTOR.error);
        await expectNaturalBreaks(page, SHELL_SELECTOR.hint);
      });

      test('the receipt storage error breaks the address only after the at sign', async ({
        page,
      }) => {
        await installMockBackend(page, { ask: 'happy', forget: 'storage-unavailable', locale });
        await openShell(page, PATHS[locale]);
        await askShell(page, QUESTION);
        const secondary = page.getByTestId('shell-receipt-secondary');
        await secondary.click();
        await waitForConfirmArmed(page);
        await secondary.click();
        await expect(page.getByTestId('shell-receipt-message')).toHaveText(ui.forgetUnavailable);
        await expectNaturalBreaks(page, '.shell-receipt-hint');
      });

      test('the contact command prints the address breaking only after the at sign', async ({
        page,
      }) => {
        await openShell(page, PATHS[locale]);
        await askShell(page, 'contact');
        await expectNaturalBreaks(page, `${SHELL_SELECTOR.output}`);
      });
    });
  }
}

for (const width of DESKTOP_WIDTHS) {
  for (const locale of Object.values(SITE_LOCALE)) {
    test.describe(`the privacy notice at ${width}px on a desktop browser (${locale})`, () => {
      test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

      test('keeps the header name and the endpoint on one line each', async ({ page }) => {
        await freezeMotion(page);
        await openShell(page, PATHS[locale]);
        const identifiers = page.locator('.shell-privacy-notice code');
        await expect(identifiers.first()).toBeVisible();
        for (const identifier of await identifiers.all()) {
          const lines = await identifier.evaluate(
            (node) => new Set([...node.getClientRects()].map((rect) => Math.round(rect.top))).size,
          );
          expect(lines, `${await identifier.textContent()} breaks inside the word`).toBe(1);
        }
      });
    });
  }
}
