import { WIDTH } from './_helpers/geometry';
import { gotoHydrated } from './_helpers/hydration';
import { installMockBackend } from './_helpers/mock-backend';
import { freezeMotion } from './_helpers/motion';
import { expect, type Locator, type Page, test } from './_helpers/test';

const SECTION = '#sec-guitar';
const VIEWPORT_HEIGHT = 800;
const SIGNAL = '--color-signal-400';
const ACCENT = '--color-accent';
const QUIET = '--color-signal-quiet';

type Role = typeof SIGNAL | typeof ACCENT | typeof QUIET;

// Resolves a custom property to the colour the engine computes for it, so the
// expected value is read from the live stylesheet and not hardcoded.
function roleColour(page: Page, role: Role): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, role);
}

function paint(node: Locator) {
  return node.evaluate((el) => {
    const style = getComputedStyle(el);
    return { text: style.color, border: style.borderTopColor, fill: style.backgroundColor };
  });
}

// The shipped data has no inactive plugin, so the off classes are read from a
// sibling clone of an active node with only the state class swapped.
function inactiveClone(node: Locator, from: string, to: string) {
  return node.evaluate(
    (el, [a, b]) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.classList.replace(a as string, b as string);
      clone.removeAttribute('data-testid');
      el.parentElement?.append(clone);
      const style = getComputedStyle(clone);
      const out = { text: style.color, border: style.borderTopColor, fill: style.backgroundColor };
      clone.remove();
      return out;
    },
    [from, to],
  );
}

async function openMixer(page: Page, width: number, ready: string) {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await freezeMotion(page);
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await gotoHydrated(page, '/', ready);
  await page.locator(`${SECTION} .guitar-mixer`).scrollIntoViewIfNeeded();
}

test.describe('desktop mixer at 1280px', () => {
  test.skip(({ isMobile }) => isMobile, 'the desktop table only ships to desktop user agents');

  test('an active plugin chip keeps the signal text colour and an accent border', {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await openMixer(page, WIDTH.DESKTOP, `${SECTION} .rms-btn`);
    const chip = page.locator(`${SECTION} [data-testid="plugin-CH 01-COMP"]`);
    await expect(chip).toBeVisible();
    const signal = await roleColour(page, SIGNAL);
    const accent = await roleColour(page, ACCENT);
    const quiet = await roleColour(page, QUIET);
    expect(
      signal,
      'the signal and accent roles must differ for this guard to mean anything',
    ).not.toBe(accent);
    const active = await paint(chip);
    expect(active.text, 'active chip text is the signal role, not the accent').toBe(signal);
    expect(active.border, 'active chip border is the accent role').toBe(accent);
    const inactive = await inactiveClone(chip, 'mx-plugin-chip-on', 'mx-plugin-chip-off');
    expect(inactive.text, 'inactive chip text is the signal role').toBe(signal);
    expect(inactive.border, 'inactive chip border is the quiet role').toBe(quiet);
  });

  test('clicking an R/M/S toggle flips its colours between the accent and signal roles', {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await openMixer(page, WIDTH.DESKTOP, `${SECTION} .rms-btn`);
    const signal = await roleColour(page, SIGNAL);
    const accent = await roleColour(page, ACCENT);
    const quiet = await roleColour(page, QUIET);
    const toggle = page.getByRole('button', { name: 'RHYTHM GTR mute', exact: true });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => paint(toggle)).toMatchObject({ text: signal, border: quiet });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => paint(toggle)).toMatchObject({ text: accent, border: accent });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => paint(toggle)).toMatchObject({ text: signal, border: quiet });
  });
});

test.describe('mobile mixer at 390px', () => {
  test.skip(({ isMobile }) => !isMobile, 'the mobile variant only ships to mobile user agents');

  test('an active plugin row keeps the signal text colour with accent border and dot', {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await openMixer(page, WIDTH.PHONE, `${SECTION} [data-testid="daw-mixer-mobile"]`);
    const row = page.locator(`${SECTION} [data-testid="plugin-mobile-CH 01-COMP"]`);
    await expect(row).toBeVisible();
    const signal = await roleColour(page, SIGNAL);
    const accent = await roleColour(page, ACCENT);
    const quiet = await roleColour(page, QUIET);
    expect(signal).not.toBe(accent);
    const active = await paint(row);
    expect(active.text, 'active row text is the signal role, not the accent').toBe(signal);
    expect(active.border, 'active row border is the accent role').toBe(accent);
    const dot = row.locator(':scope > span').first();
    expect((await paint(dot)).fill, 'active dot fill is the accent role').toBe(accent);
    const inactive = await inactiveClone(row, 'mx-plugin-mobile-on', 'mx-plugin-mobile-off');
    expect(inactive.text, 'inactive row text is the signal role').toBe(signal);
    expect(inactive.border, 'inactive row border must not read as active').not.toBe(accent);
    const inactiveDot = await inactiveClone(dot, 'mx-plugin-dot-on', 'mx-plugin-dot-off');
    expect(inactiveDot.fill, 'inactive dot fill is the quiet role').toBe(quiet);
  });

  test('the static mobile toggles read accent when on and signal when off', {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await openMixer(page, WIDTH.PHONE, `${SECTION} [data-testid="daw-mixer-mobile"]`);
    const signal = await roleColour(page, SIGNAL);
    const accent = await roleColour(page, ACCENT);
    const quiet = await roleColour(page, QUIET);
    const on = page
      .locator(`${SECTION} [data-testid="channel-mobile-CH 02"]`)
      .getByText('R', { exact: true });
    const off = page
      .locator(`${SECTION} [data-testid="channel-mobile-CH 01"]`)
      .getByText('R', { exact: true });
    await on.scrollIntoViewIfNeeded();
    expect(await paint(on)).toMatchObject({ text: accent, border: accent });
    expect(await paint(off)).toMatchObject({ text: signal, border: quiet });
  });
});
