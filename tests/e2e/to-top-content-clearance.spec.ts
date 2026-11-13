import { expect, type Page, test } from '@playwright/test';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 360, 375] as const;
const VIEWPORT_HEIGHT = 700;
const SAMPLES_PER_AXIS = 5;
const SETTLE_FRAMES = 3;

const TARGETS = [
  { name: 'the shell privacy email', selector: '[data-testid="shell-privacy-notice"] a' },
  { name: 'the contact send button', selector: '.contact-send' },
  { name: 'the contact character counter', selector: '.contact-count' },
] as const;

async function scrollIntoButtonRow(page: Page, selector: string): Promise<void> {
  await page.evaluate(
    async ([target, frames]) => {
      const button = document.querySelector('.to-top-btn') as HTMLElement;
      const node = document.querySelector(String(target)) as HTMLElement;
      const rowCenter = button.getBoundingClientRect().top + button.offsetHeight / 2;
      const box = node.getBoundingClientRect();
      window.scrollBy(0, box.top + box.height / 2 - rowCenter);
      for (let frame = 0; frame < Number(frames); frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    },
    [selector, SETTLE_FRAMES] as const,
  );
}

function coveredByButton(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    ([target, samples]) => {
      const node = document.querySelector(String(target)) as HTMLElement;
      const button = document.querySelector('.to-top-btn') as HTMLElement;
      const zone = button.getBoundingClientRect();
      const hits: string[] = [];
      const count = Number(samples);
      for (const box of node.getClientRects()) {
        if (box.right > zone.left && box.left < zone.right) {
          if (box.bottom > zone.top && box.top < zone.bottom) {
            hits.push(`box ${Math.round(box.left)}-${Math.round(box.right)} meets the button`);
          }
        }
        for (let column = 0; column < count; column += 1) {
          for (let row = 0; row < count; row += 1) {
            const x = box.left + ((box.width - 1) * column) / (count - 1);
            const y = box.top + ((box.height - 1) * row) / (count - 1);
            const top = document.elementFromPoint(x, y);
            if (top?.closest('.to-top-btn')) {
              hits.push(`point ${Math.round(x)},${Math.round(y)} hits the button`);
            }
          }
        }
      }
      return hits;
    },
    [selector, SAMPLES_PER_AXIS] as const,
  );
}

test.describe('the back-to-top button never covers shell or contact content', () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const width of WIDTHS) {
    for (const { name, selector } of TARGETS) {
      test(`${name} at ${width}px, scrolled into the button's row`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await freezeMotion(page);
        await gotoSettled(page, '/');
        await page.locator(selector).first().scrollIntoViewIfNeeded();
        await scrollIntoButtonRow(page, selector);
        await expect(page.locator('.to-top-btn')).toHaveClass(/to-top-show/);
        expect(
          await coveredByButton(page, selector),
          'the button sits clear of the box, so a tap or a read never lands on it',
        ).toEqual([]);
      });
    }
  }
});
