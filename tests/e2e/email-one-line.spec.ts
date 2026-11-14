import { expect, type Page, test } from '@playwright/test';
import { revealDeferredContent } from './_helpers/snapshot';
import { gotoSettled } from './_helpers/streamed';

const PHONE_WIDTHS = [320, 375, 768] as const;
const VIEWPORT_HEIGHT = 812;
const ROUTES = ['/', '/pt'] as const;
const CONTACT_EMAIL = '.contact-channels-body a[href^="mailto:"]';
const CONTACT_FRAME = '.contact-channels';
const SHELL_EMAIL = '.shell-privacy-notice a[href^="mailto:"]';
const SHELL_FRAME = '.shell-privacy-notice p';

interface EmailLayout {
  lines: number;
  overflow: number;
  trailingOnLine: boolean | null;
}

function measureEmail(page: Page, selector: string, frame: string): Promise<EmailLayout> {
  return page.locator(selector).evaluate((link, frameSelector) => {
    const range = document.createRange();
    range.selectNodeContents(link);
    const rects = [...range.getClientRects()];
    const tops = new Set(rects.map((rect) => Math.round(rect.top)));
    const container = link.closest(frameSelector) as HTMLElement;
    const outer = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const inner = {
      left: outer.left + Number.parseFloat(style.borderLeftWidth),
      right: outer.right - Number.parseFloat(style.borderRightWidth),
    };
    const box = link.getBoundingClientRect();
    const next = link.nextSibling;
    let trailingOnLine: boolean | null = null;
    if (next?.nodeType === Node.TEXT_NODE && (next.textContent ?? '').trim() !== '') {
      const mark = document.createRange();
      const offset = (next.textContent ?? '').search(/\S/);
      mark.setStart(next, offset);
      mark.setEnd(next, offset + 1);
      const rect = mark.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      trailingOnLine = middle >= box.top && middle <= box.bottom;
    }
    return {
      lines: tops.size,
      overflow: Math.max(
        container.scrollWidth - container.clientWidth,
        ...rects.map((rect) => Math.max(inner.left - rect.left, rect.right - inner.right)),
      ),
      trailingOnLine,
    };
  }, frame);
}

for (const width of PHONE_WIDTHS) {
  test.describe(`the email address at ${width}px`, () => {
    test.use({
      viewport: { width, height: VIEWPORT_HEIGHT },
      isMobile: true,
      hasTouch: true,
    });

    for (const route of ROUTES) {
      test(`${route}: the contact channel shows the address on one line`, async ({ page }) => {
        await gotoSettled(page, route);
        await revealDeferredContent(page);
        await page.locator(CONTACT_EMAIL).scrollIntoViewIfNeeded();
        const layout = await measureEmail(page, CONTACT_EMAIL, CONTACT_FRAME);
        expect(layout.lines, 'the address breaks inside the domain').toBe(1);
        expect(layout.overflow, 'the address runs past its row').toBeLessThanOrEqual(0);
      });

      test(`${route}: the shell disclosure keeps the address and its full stop together`, async ({
        page,
      }) => {
        await gotoSettled(page, route);
        await revealDeferredContent(page);
        await page.locator(SHELL_EMAIL).scrollIntoViewIfNeeded();
        const layout = await measureEmail(page, SHELL_EMAIL, SHELL_FRAME);
        expect(layout.lines, 'the address breaks inside the domain').toBe(1);
        expect(layout.trailingOnLine, 'the full stop wraps onto a line of its own').toBe(true);
        expect(layout.overflow, 'the sentence runs past the notice').toBeLessThanOrEqual(0);
      });
    }
  });
}
