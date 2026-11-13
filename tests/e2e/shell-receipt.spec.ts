import { expect, type Page, test } from '@playwright/test';
import { fillShellState, shellStates, shellUi } from '../../content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { FORGET_RETRY_AFTER_S, type ForgetMock, fulfillForget } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { askShell, openShell, SHELL_SELECTOR, waitForConfirmArmed } from './_helpers/shell';

const CASES = [
  { width: 320, height: 844, locale: SITE_LOCALE.en, motionOff: true },
  { width: 375, height: 844, locale: SITE_LOCALE.pt, motionOff: false },
  { width: 768, height: 1024, locale: SITE_LOCALE.en, motionOff: false },
  { width: 1280, height: 800, locale: SITE_LOCALE.pt, motionOff: true },
] as const;
const PATHS: Record<SiteLocale, string> = { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' };
const IDS = [
  '3f1c9a2e-7b44-4d0a-9c1e-5a8d2b6f0e71',
  '8a2d4c6e-1f3b-4a5c-9d7e-0b1c2d3e4f5a',
  '5c2e1d0f-3b4a-4c5d-8e6f-7a8b9c0d1e2f',
];
const TARGET_PX = 44;
const SUBPIXEL_PX = 1;
const SECONDS_PER_MINUTE = 60;

type Backend = {
  askBodies: Record<string, unknown>[];
  forgetBodies: Record<string, unknown>[];
  releaseForget: () => void;
};

async function backend(page: Page, forgets: ForgetMock[] = ['happy']): Promise<Backend> {
  const queue = [...IDS];
  const forgetQueue = [...forgets];
  const askBodies: Record<string, unknown>[] = [];
  const forgetBodies: Record<string, unknown>[] = [];
  let releaseForget: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    releaseForget = resolve;
  });
  await page.route('**/api/ask', async (route) => {
    askBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'X-Request-Id': queue.shift() ?? crypto.randomUUID() },
      body: 'Erik builds agent platforms.',
    });
  });
  await page.route('**/api/log/forget', async (route) => {
    forgetBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await fulfillForget(route, forgetQueue.shift() ?? 'happy', released);
  });
  return { askBodies, forgetBodies, releaseForget };
}

const receipt = (page: Page) => page.locator(SHELL_SELECTOR.receipt);
const named = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const primaryButton = (page: Page) => receipt(page).getByTestId('shell-receipt-primary');
const secondaryButton = (page: Page) => receipt(page).getByTestId('shell-receipt-secondary');

async function answerTwice(page: Page) {
  await askShell(page, 'what does erik build?');
  await expect(receipt(page)).toHaveCount(1);
  await askShell(page, 'who is erik?');
  await expect(receipt(page).locator('code')).toHaveText(IDS[1] ?? '');
}

async function fits(page: Page) {
  return page.evaluate(() => {
    const feed = document.querySelector('[role="log"]')?.getBoundingClientRect();
    const box = document.querySelector('[data-testid="shell-receipt"]')?.getBoundingClientRect();
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      right: box && feed ? box.right - feed.right : Number.NaN,
      left: box && feed ? feed.left - box.left : Number.NaN,
    };
  });
}

for (const { width, height, locale, motionOff } of CASES) {
  const ui = shellUi[locale];
  const states = shellStates[locale];

  test.describe(`at ${width}px (${locale}${motionOff ? ', MOTION off' : ''}) the receipt`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      if (motionOff) await freezeMotion(page);
    });

    test('follows only the latest answer, counts the conversation, fits and keeps 44px buttons', async ({
      page,
    }) => {
      const { askBodies } = await backend(page);
      await openShell(page, PATHS[locale]);
      await answerTwice(page);
      await expect(receipt(page)).toHaveCount(1);
      await expect(receipt(page)).toContainText(
        fillShellState(ui.receiptQuestionsMany, { count: '2' }),
      );
      await expect(receipt(page)).toContainText(ui.receiptRetention);
      await expect(page.locator(SHELL_SELECTOR.feed)).not.toContainText(IDS[0] ?? '');
      expect(askBodies[1]?.conversationId).toBe(askBodies[0]?.conversationId);

      const fit = await fits(page);
      expect(fit.page, 'the page scrolls sideways').toBeLessThanOrEqual(0);
      expect(fit.right).toBeLessThanOrEqual(SUBPIXEL_PX);
      expect(fit.left).toBeLessThanOrEqual(SUBPIXEL_PX);
      for (const name of [ui.copy, ui.forget]) {
        const box = await named(page, name).boundingBox();
        expect(box?.height ?? 0, `${name} is a 44px target`).toBeGreaterThanOrEqual(TARGET_PX);
      }
    });

    test('forget conversation confirms in place, clears the receipt and starts a new conversation', async ({
      page,
    }) => {
      const { askBodies, forgetBodies, releaseForget } = await backend(page, ['held']);
      await openShell(page, PATHS[locale]);
      await answerTwice(page);
      const forget = named(page, ui.forget);
      const widthBefore = (await forget.boundingBox())?.width ?? 0;

      await forget.click();
      await expect(receipt(page)).toContainText(ui.forgetConfirmTitle);
      await expect(named(page, ui.forgetCancel)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(receipt(page)).not.toContainText(ui.forgetConfirmTitle);
      expect(forgetBodies).toEqual([]);

      await named(page, ui.forget).click();
      await expect(named(page, ui.forgetConfirm)).toBeVisible();
      await waitForConfirmArmed(page);
      const confirm = secondaryButton(page);
      expect((await confirm.boundingBox())?.width ?? 0).toBeCloseTo(widthBefore, 0);
      await confirm.click();
      await expect(page.locator(SHELL_SELECTOR.receiptMessage)).toHaveText(
        fillShellState(ui.forgetPendingMany, { count: '2' }),
      );
      await expect(named(page, ui.forgetting)).toHaveAttribute('aria-busy', 'true');
      await expect(primaryButton(page)).toHaveAttribute('aria-disabled', 'true');
      expect(forgetBodies).toEqual([{ requestId: IDS[1] }]);
      await expect(receipt(page)).toHaveCount(1);
      releaseForget();

      await expect(receipt(page)).toHaveCount(0);
      expect(forgetBodies).toEqual([{ requestId: IDS[1] }]);
      await expect(page.locator(SHELL_SELECTOR.feed)).toContainText(ui.conversationForgotten);
      await expect(page.locator(SHELL_SELECTOR.feed)).toContainText(
        fillShellState(ui.conversationForgottenMany, { count: '2' }),
      );
      await expect(page.locator(SHELL_SELECTOR.input)).toBeFocused();

      await askShell(page, 'and now?');
      await expect(receipt(page)).toContainText(ui.receiptQuestionsOne);
      expect(askBodies[2]?.conversationId).not.toBe(askBodies[0]?.conversationId);
    });

    test('a storage outage keeps the receipt with an alert, the email fallback and a retry', async ({
      page,
    }) => {
      await backend(page, ['storage-unavailable', 'happy']);
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      await named(page, ui.forget).click();
      await waitForConfirmArmed(page);
      await named(page, ui.forgetConfirm).click();
      await expect(receipt(page).getByRole('alert')).toHaveText(ui.forgetUnavailable);
      await expect(receipt(page).locator(`a[href="${ui.emailHref}"]`)).toBeVisible();
      expect((await fits(page)).page).toBeLessThanOrEqual(0);
      await named(page, ui.forgetRetry).click();
      await expect(receipt(page)).toHaveCount(0);
    });

    test('a lost connection says nothing was deleted and offers a retry', async ({ page }) => {
      await backend(page, ['network-error']);
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      await named(page, ui.forget).click();
      await waitForConfirmArmed(page);
      await named(page, ui.forgetConfirm).click();
      await expect(receipt(page).getByRole('alert')).toHaveText(ui.forgetOffline);
      await expect(named(page, ui.forgetRetry)).toBeVisible();
    });

    test('a rate limit counts down in minutes with forget disabled', async ({ page }) => {
      await backend(page, ['rate-limit']);
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      await named(page, ui.forget).click();
      await waitForConfirmArmed(page);
      await named(page, ui.forgetConfirm).click();
      const left = `${Math.ceil(FORGET_RETRY_AFTER_S / SECONDS_PER_MINUTE)} ${states.minutesUnit}`;
      await expect(page.locator(SHELL_SELECTOR.receiptMessage)).toHaveText(
        fillShellState(ui.forgetWaitNotice, { left }),
      );
      await expect(receipt(page)).toContainText(ui.forgetWaitHint);
      await expect(named(page, fillShellState(ui.forgetWait, { left }))).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect((await fits(page)).page).toBeLessThanOrEqual(0);
    });

    test('copy feedback keeps the button width, and a denied clipboard selects the id', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        let calls = 0;
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: () => {
              calls += 1;
              return calls === 1 ? Promise.resolve() : Promise.reject(new Error('denied'));
            },
          },
        });
      });
      await backend(page);
      await openShell(page, PATHS[locale]);
      await askShell(page, 'who is erik?');
      const copy = primaryButton(page);
      const before = await copy.boundingBox();
      await copy.click();
      await expect(copy.locator('[data-current]')).toHaveText(ui.copied);
      const after = await copy.boundingBox();
      expect(after?.width ?? 0).toBeCloseTo(before?.width ?? 0, 0);
      await copy.click();
      await expect(page.locator(SHELL_SELECTOR.receiptMessage)).toHaveText(
        ui.copyFailedAnnouncement,
      );
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(IDS[0]);
    });
  });
}
