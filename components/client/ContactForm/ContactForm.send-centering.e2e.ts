import { waitForHydration } from '../../../tests/e2e/_helpers/hydration';
import { installMockBackend } from '../../../tests/e2e/_helpers/mock-backend';
import { expect, test } from '../../../tests/e2e/_helpers/test';

const FORM_SELECTOR = '[data-testid="contact-form"]';
const SEND_SELECTOR = `${FORM_SELECTOR} .contact-send`;
const CENTER_TOLERANCE_PX = 0.5;
const HALF = 2;

test.describe('contact send button label', () => {
  test('sits on the vertical center of the button', async ({ page }) => {
    await installMockBackend(page, { contact: 'happy', log: 'accept' });
    await page.goto('/');
    await page.locator('#sec-contact').scrollIntoViewIfNeeded();
    await page.waitForSelector(FORM_SELECTOR, { state: 'visible' });
    await waitForHydration(page, FORM_SELECTOR);

    const send = page.locator(SEND_SELECTOR);
    await expect(send).toBeVisible();
    const offset = await send.evaluate((button, half) => {
      const label = button.querySelector('span');
      if (!label) throw new Error('the send button has no label');
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return (text.top + text.bottom) / half - (box.top + box.bottom) / half;
    }, HALF);

    expect(
      Math.abs(offset),
      `the label center sits ${offset}px from the button center: align-items: normal on .contact-send overrides the base center`,
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  });
});
