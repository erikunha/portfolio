import { expect, test } from '@playwright/test';
import { heroTagline } from '@/content/hero';
import { profile } from '@/content/profile';
import { readmeCopy, readmeLineNumbers, retryCode } from '@/content/readme';
import { responsibilities } from '@/content/responsibilities';

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 740 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
];
const dockSelector = 'nav.dock, [data-testid="mobile-dock"]';
const minimumTargetHeight = 44;
const signalColor = 'rgb(0, 255, 65)';
const minimumDesktopTextSize = 13;
const desktopActionsWidth = 1024;
const prototypeAboutHeight = 1984;
const aboutHeightTolerance = 30;

test.use({ hasTouch: true, reducedMotion: 'reduce' });

for (const viewport of viewports) {
  test(`Hero actions fit the first screen at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator('#bio');
    await expect(hero.getByRole('heading', { level: 1, name: profile.displayName })).toBeVisible();
    await expect(hero.getByText(heroTagline, { exact: true })).toBeVisible();
    await expect(hero.getByRole('heading', { level: 1 })).toHaveCSS('color', signalColor);
    await expect(hero.getByRole('heading', { level: 1 })).toHaveCSS('font-weight', '900');
    const dock = page.locator(dockSelector).filter({ visible: true }).first();
    const dockBox = (await dock.count()) ? await dock.boundingBox() : null;
    const bottom = dockBox?.y ?? viewport.height;
    for (const link of await hero.getByRole('link').filter({ visible: true }).all()) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(bottom);
      expect(box?.height).toBeGreaterThanOrEqual(minimumTargetHeight);
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    }
    for (const action of profile.actions) {
      const link = hero.getByRole('link', { name: action.label });
      await expect(link).toHaveAttribute('href', action.href);
      if (action.mobileOnly && viewport.width >= desktopActionsWidth)
        await expect(link).toBeHidden();
      else await expect(link).toBeVisible();
    }
    const hire = await hero.locator('.hero-hire').boundingBox();
    const actions = await hero.locator('.hero-actions').boundingBox();
    expect(hire?.width).toBe(actions?.width);
    await expect(hero.getByText(profile.country, { exact: true })).toHaveCSS(
      'background-color',
      signalColor,
    );
    await expect(hero.locator('.hero-relocation')).toHaveText('OPEN_TO_RELOCATION · WORLDWIDE');
    await expect(hero.locator('.hero-relocation .badge-dot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('About keeps complete responsibility names and retry code on a 390px screen', async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const about = page.locator('#sec-about');
  await expect(about.getByRole('heading', { level: 2 })).toHaveText(
    `${readmeCopy.aboutTitle} ${readmeCopy.aboutCommand}`,
  );
  const aboutBox = await about.boundingBox();
  expect(Math.abs((aboutBox?.height ?? 0) - prototypeAboutHeight)).toBeLessThanOrEqual(
    aboutHeightTolerance,
  );
  await expect(about.locator('.about-line-numbers')).toHaveAttribute('aria-hidden', 'true');
  await expect(about.locator('.about-line-numbers > span')).toHaveCount(readmeLineNumbers.length);
  await expect(about).not.toContainText('NEEDS_SPONSORSHIP');
  for (const row of responsibilities) {
    const name = about.getByText(row.name, { exact: true });
    await expect(name).toBeVisible();
    const box = await name.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
  }
  const headings = about.getByRole('heading', { level: 3 });
  const boxes = await Promise.all((await headings.all()).map((heading) => heading.boundingBox()));
  expect(boxes.every((box) => box !== null)).toBe(true);
  expect(boxes.map((box) => box?.y)).toEqual(
    boxes.map((box) => box?.y).toSorted((left, right) => (left ?? 0) - (right ?? 0)),
  );
  await expect(about.getByRole('region', { name: 'README code' })).toBeVisible();
  const code = about.getByRole('region', { name: retryCode.regionLabel });
  await expect(code).toHaveAttribute('tabindex', '0');
  expect(await code.textContent()).toBe(retryCode.source);
  const copy = about.getByRole('button', { name: 'COPY', exact: true });
  const copyBox = await copy.boundingBox();
  expect(copyBox?.height).toBeGreaterThanOrEqual(minimumTargetHeight);
  expect(copyBox?.width).toBeGreaterThanOrEqual(minimumTargetHeight);
  await copy.click();
  await page.keyboard.press('Tab');
  await expect(code).toBeFocused();
});

for (const width of [768, 1280]) {
  test(`Hero and About text stays at least 13px at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const sizes = await page.locator('#bio, #sec-about').evaluateAll((sections) =>
      sections.flatMap((section) =>
        Array.from(section.querySelectorAll('*'))
          .filter(
            (element) =>
              element.getClientRects().length > 0 &&
              !element.closest('[aria-hidden="true"]') &&
              Array.from(element.childNodes).some(
                (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
              ),
          )
          .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      ),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(minimumDesktopTextSize);
  });
}

test('About COPY copies the complete retry source and announces success', async ({ page }) => {
  await page.addInitScript(() => {
    let copied = '';
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: (text: string) => {
          copied = text;
          return Promise.resolve();
        },
        readText: () => Promise.resolve(copied),
      }),
    });
  });
  await page.goto('/');
  const about = page.locator('#sec-about');
  const copy = about.getByRole('button', { name: 'COPY', exact: true });
  await copy.click();
  await expect(copy).toHaveText('COPIED');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(retryCode.source);
  await expect(about.getByRole('status')).toHaveText('Copied to clipboard.');
});
