import { expect, type Locator, type Page } from '@playwright/test';

const MIXER_ROUTE = '/';
const LINKS_ROUTE = '/links';
const MIXER_SECTION = '#sec-guitar';

export interface RingTarget {
  name: string;
  route: string;
  selector: string;
}

export const FOCUS_RING_TARGETS: RingTarget[] = [
  { name: 'fader', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .fader-track` },
  { name: 'vu meter', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .vu-meter` },
  { name: 'knob', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .knob-container` },
  { name: 'rms toggle', route: MIXER_ROUTE, selector: `${MIXER_SECTION} .rms-inactive` },
  { name: 'brand link', route: MIXER_ROUTE, selector: '.brand-link' },
  { name: 'links pill', route: LINKS_ROUTE, selector: '.links-pill' },
  { name: 'links footer link', route: LINKS_ROUTE, selector: '.links-footer-link' },
];

export async function focusByKeyboard(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await target.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}
