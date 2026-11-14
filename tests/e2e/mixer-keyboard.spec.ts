import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';

const MIXER = '#sec-guitar .guitar-mixer';
// WebKit on macOS leaves buttons out of the Tab order unless full keyboard access is on, so
// there the walk covers the sliders, which carry tabindex. WebKit on Linux tabs to buttons.
const CONTROLS = `${MIXER} [role="slider"]:visible, ${MIXER} button:visible`;
const SLIDERS = `${MIXER} [role="slider"]:visible`;
const MIN_RING_PX = 2;
const NO_OUTLINE = 'none';
const VIEWPORT = { width: 1280, height: 900 } as const;
const ARROW_STEPS = 3;
const WEBKIT = 'webkit';
const MACOS = 'darwin';

test.skip(
  ({ isMobile }) => isMobile,
  'a mobile user agent gets the static three-card mixer, which has no controls',
);

async function openMixer(page: Page): Promise<void> {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await freezeMotion(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.locator(MIXER).scrollIntoViewIfNeeded();
  await waitForHydration(page, `${MIXER} [role="slider"]`);
}

async function activeControl(page: Page) {
  return page.evaluate((mixerSelector) => {
    const node = document.activeElement;
    if (!node || node === document.body) return null;
    const style = getComputedStyle(node);
    return {
      label: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '',
      inMixer: document.querySelector(mixerSelector)?.contains(node) ?? false,
      ringStyle: style.outlineStyle,
      ringWidth: Number.parseFloat(style.outlineWidth) || 0,
    };
  }, MIXER);
}

test('Tab walks every mixer control in order, each shows a focus ring, and focus leaves', async ({
  page,
  browserName,
}) => {
  await openMixer(page);
  const buttonsSkipTab = browserName === WEBKIT && process.platform === MACOS;
  const controls = page.locator(buttonsSkipTab ? SLIDERS : CONTROLS);
  const count = await controls.count();
  expect(count, 'the mixer exposes faders, knobs and buttons').toBeGreaterThan(3);
  const expected = await controls.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label') ?? node.textContent?.trim() ?? ''),
  );

  await controls.first().focus();
  const visited: string[] = [];
  for (let step = 0; step < count; step++) {
    const active = await activeControl(page);
    expect(active?.inMixer, `step ${step} is outside the mixer`).toBe(true);
    expect(
      active?.ringStyle,
      `${active?.label} has no outline when focused by keyboard (WCAG 2.4.7)`,
    ).not.toBe(NO_OUTLINE);
    expect(
      active?.ringWidth,
      `${active?.label} ring is thinner than ${MIN_RING_PX}px`,
    ).toBeGreaterThanOrEqual(MIN_RING_PX);
    visited.push(active?.label ?? '');
    await page.keyboard.press('Tab');
  }

  expect(visited).toEqual(expected);
  const after = await activeControl(page);
  expect(after?.inMixer, 'Tab after the last control stays inside the mixer: a focus trap').toBe(
    false,
  );
});

test('Shift+Tab from the first control leaves the mixer backwards', async ({ page }) => {
  await openMixer(page);
  await page.locator(CONTROLS).first().focus();

  await page.keyboard.press('Shift+Tab');

  expect((await activeControl(page))?.inMixer).not.toBe(true);
});

test('arrow keys move every slider and the value text follows', async ({ page }) => {
  await openMixer(page);
  const sliders = page.locator(SLIDERS);
  const count = await sliders.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index++) {
    const slider = sliders.nth(index);
    const name = await slider.getAttribute('aria-label');
    await slider.focus();
    await page.keyboard.press('Home');
    const floor = Number(await slider.getAttribute('aria-valuenow'));
    for (let step = 0; step < ARROW_STEPS; step++) await page.keyboard.press('ArrowRight');
    const raised = Number(await slider.getAttribute('aria-valuenow'));
    expect(raised, `${name}: ArrowRight did not raise the value`).toBeGreaterThan(floor);
    await page.keyboard.press('ArrowLeft');
    const lowered = Number(await slider.getAttribute('aria-valuenow'));
    expect(lowered, `${name}: ArrowLeft did not lower the value`).toBeLessThan(raised);
    await page.keyboard.press('End');
    const ceiling = Number(await slider.getAttribute('aria-valuenow'));
    expect(ceiling).toBeGreaterThan(lowered);
    expect(await slider.getAttribute('aria-valuetext')).not.toBe('');
    expect(await slider.getAttribute('aria-valuetext')).not.toBeNull();
  }
});
