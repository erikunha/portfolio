import { expect, type Locator, type Page, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';

const NO_OUTLINE_STYLE = 'none';
const MIXER_ROUTE = '/';
const LINKS_ROUTE = '/links';
const MIXER_SECTION = '#sec-guitar';

interface RingTarget {
  name: string;
  route: string;
  selector: string;
}

const TARGETS: RingTarget[] = [
  { name: 'fader', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .fader-track` },
  { name: 'vu meter', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .vu-meter` },
  { name: 'knob', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .knob-container` },
  { name: 'rms toggle', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .rms-inactive` },
  { name: 'brand link', route: MIXER_ROUTE, selector: '.brand-link' },
  { name: 'links pill', route: LINKS_ROUTE, selector: '.links-pill' },
  { name: 'links footer link', route: LINKS_ROUTE, selector: '.links-footer-link' },
];

async function focusByKeyboard(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await target.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

for (const { name, route, selector } of TARGETS) {
  test(`keyboard focus on the ${name} shows a focus ring`, async ({ page }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.goto(route);
    const target = page.locator(`${selector}:visible`).first();
    await expect(target).toBeVisible();
    await focusByKeyboard(page, target);
    const ring = await target.evaluate((node) => {
      const style = getComputedStyle(node);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(
      ring.style,
      `${selector} lost its keyboard focus ring: an outline: none in @layer components beats the global :focus-visible rule in @layer base (WCAG 2.4.7)`,
    ).not.toBe(NO_OUTLINE_STYLE);
    expect(ring.width).toBeGreaterThan(0);
  });
}
