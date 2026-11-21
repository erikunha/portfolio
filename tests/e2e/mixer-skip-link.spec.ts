import { expect, type Page, test } from '@playwright/test';
import { WIDTH } from './_helpers/geometry';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';

const MIXER = '#sec-guitar .guitar-mixer';
const SKIP_LINK = `${MIXER} a.mixer-skip-link`;
const FIRST_CONTROL = `${MIXER} [role="slider"]:visible`;
const MIN_RING_PX = 2;
const REVEALED_CLIP = 'inset(0px)';
const VIEWPORT = { width: WIDTH.DESKTOP, height: 900 } as const;

test.skip(
  ({ isMobile }) => isMobile,
  'a mobile user agent gets the static three-card mixer, which has no controls',
);

test.skip(
  ({ browserName }) => browserName === 'webkit' && process.platform === 'darwin',
  'WebKit on macOS leaves links out of the Tab order unless full keyboard access is on',
);

async function openMixer(page: Page): Promise<void> {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await freezeMotion(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.locator(SKIP_LINK).scrollIntoViewIfNeeded();
  await waitForHydration(page, `${MIXER} [role="slider"]`);
}

test('the skip link shows a focus ring and moves focus past every mixer control', {
  tag: '@cross-browser',
}, async ({ page }) => {
  await openMixer(page);
  await page.locator(FIRST_CONTROL).first().focus();

  await page.keyboard.press('Shift+Tab');

  const link = page.locator(SKIP_LINK);
  await expect(link).toBeFocused();
  await expect
    .poll(() => link.evaluate((node) => getComputedStyle(node).clipPath), {
      message: 'the focused skip link is revealed',
    })
    .toBe(REVEALED_CLIP);
  const ring = await link.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(MIN_RING_PX);

  await page.keyboard.press('Enter');
  const landed = await page.evaluate((mixerSelector) => {
    const node = document.activeElement;
    const mixer = document.querySelector(mixerSelector);
    const controls = Array.from(mixer?.querySelectorAll('[role="slider"], button') ?? []);
    return {
      id: node?.id ?? '',
      hash: location.hash.slice(1),
      afterEveryControl: controls.every(
        (control) =>
          node !== null &&
          Boolean(control.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    };
  }, MIXER);
  expect(landed.id).not.toBe('');
  expect(landed.id).toBe(landed.hash);
  expect(landed.afterEveryControl, 'focus landed after the last control').toBe(true);

  await page.keyboard.press('Tab');
  const inMixer = await page.evaluate(
    (mixerSelector) => document.querySelector(mixerSelector)?.contains(document.activeElement),
    MIXER,
  );
  expect(inMixer, 'the next Tab stop is past the mixer').toBe(false);
});
