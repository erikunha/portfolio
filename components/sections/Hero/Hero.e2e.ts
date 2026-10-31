import { expect, type Locator, type Page, test } from '@playwright/test';
import { heroContent } from '@/content/hero';
import { profile } from '@/content/profile';

const viewports = [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
];

const WIDE_BREAKPOINT = 1024;

for (const viewport of viewports) {
  test.describe(`r106 Hero and About at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('shows identity and hiring actions in the first screen', async ({ page }) => {
      await page.goto('/');
      const hero = page.locator('.hero-frame:visible');
      await expect(
        hero.getByRole('heading', { level: 1, name: profile.displayName }),
      ).toBeVisible();
      await expect(hero.getByText(profile.title, { exact: false })).toBeVisible();
      const hire = hero.getByRole('link', { name: heroContent.hire.accessibleLabel });
      await expect(hire).toBeVisible();
      await expect(hire).toHaveAttribute('href', heroContent.hire.href);
      for (const action of heroContent.actions) {
        if (action.hiddenOnWide && viewport.width >= WIDE_BREAKPOINT) continue;
        const link = hero.getByRole('link', { name: action.accessibleLabel, exact: true });
        await expect(link).toHaveAttribute('href', action.href);
        await expect(link).toBeInViewport();
      }
      if (viewport.width < 390) {
        await expect(hero.locator('.hero-boot-mobile')).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    });

    test('keeps five bordered About panels and readable retry code', async ({ page }, testInfo) => {
      await page.goto('/');
      const about = page.locator('#sec-readme');
      await expect(about.locator('.ab-panel')).toHaveCount(5);
      for (const panel of await about.locator('.ab-panel').all()) {
        await expect(panel.locator(':scope > header h3')).toHaveCount(1);
        await expect(panel).toHaveCSS('border-top-width', '1px');
        await expect(panel.locator(':scope > header')).toHaveCSS('border-bottom-width', '1px');
      }
      await expect(about.getByText("$ git tag --list 'community/*'")).toHaveCount(0);
      await expect(about.locator('#sec-community')).toHaveCount(0);
      const code = about.getByRole('region', { name: 'README code' });
      await expect(code).toHaveAttribute('tabindex', '0');
      await expect(code).toContainText('Math.random()');
      await page.screenshot({ path: testInfo.outputPath('hero-about.png'), fullPage: true });
    });
  });
}

const MOBILE_STACK = { width: 390, height: 844 };
const DESKTOP_ROW = { width: 1280, height: 720 };
const HERO_GROUPS = ['[data-testid="hero-stats"]', '[data-testid="hero-ctas"]'];

async function childBoxes(page: Page, group: string) {
  const children = page.locator(`.hero-frame:visible ${group} > :visible`);
  const count = await children.count();
  expect(count).toBeGreaterThan(1);
  const boxes = [];
  for (let index = 0; index < count; index++) {
    const box = await children.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (box) boxes.push(box);
  }
  return boxes;
}

test.describe('Hero groups reflow by viewport', () => {
  test('keep the impact stats two by two below 768', async ({ page }) => {
    await page.setViewportSize(MOBILE_STACK);
    await page.goto('/');
    const boxes = await childBoxes(page, '[data-testid="hero-stats"]');
    expect(boxes).toHaveLength(4);
    expect(
      new Set(boxes.map((box) => Math.round(box.x))).size,
      'the stats sit in two columns',
    ).toBe(2);
    expect(new Set(boxes.map((box) => Math.round(box.y))).size, 'the stats sit in two rows').toBe(
      2,
    );
  });

  test('keep the secondary CTAs in one row of three below 768', async ({ page }) => {
    await page.setViewportSize(MOBILE_STACK);
    await page.goto('/');
    const boxes = await childBoxes(page, '[data-testid="hero-ctas"]');
    expect(boxes).toHaveLength(4);
    const [hire, ...secondary] = boxes;
    expect(hire?.width, 'the hire CTA spans the full width').toBeGreaterThan(
      secondary[0]?.width ?? 0,
    );
    expect(
      new Set(secondary.map((box) => Math.round(box.y))).size,
      'the three secondary CTAs share one row',
    ).toBe(1);
  });

  test('stay side by side at 1280', async ({ page }) => {
    await page.setViewportSize(DESKTOP_ROW);
    await page.goto('/');
    for (const group of HERO_GROUPS) {
      const boxes = await childBoxes(page, group);
      const lefts = new Set(boxes.map((box) => Math.round(box.x)));
      expect(lefts.size, `${group} children sit in more than one column`).toBeGreaterThan(1);
    }
  });

  test('hide the CV action at 1280 and keep it at 390', async ({ page }) => {
    await page.setViewportSize(DESKTOP_ROW);
    await page.goto('/');
    await expect(
      page.locator('.hero-frame:visible [data-testid="hero-ctas"] a:has-text("VIEW_CV")'),
    ).toBeHidden();

    await page.setViewportSize(MOBILE_STACK);
    await expect(
      page.locator('.hero-frame:visible [data-testid="hero-ctas"] a:has-text("VIEW_CV")'),
    ).toBeVisible();
  });
});

const METADATA_MOBILE_WIDTHS = [320, 390];
const METADATA_WIDE_WIDTHS = [768, 1280];
const METADATA_VIEWPORT_HEIGHT = 900;

const WIDE_METADATA_ROWS: Record<number, string[]> = {
  768: ['location + availability', 'employer', 'domain', 'language'],
  1280: ['location + availability + employer', 'domain + language'],
};

const metadataContext = (page: Page) => page.locator('.hero-frame:visible .hero-context');

const metadataFact = (page: Page, text: string) =>
  metadataContext(page).locator('span').filter({ hasText: text }).first();

const metadataItem = (page: Page, text: string) =>
  metadataContext(page).locator('span').filter({ hasText: text }).last();

async function topOf(locator: Locator): Promise<number> {
  return locator.evaluate((node) => Math.round(node.getBoundingClientRect().top));
}

async function renderedLines(locator: Locator): Promise<string[]> {
  return locator.evaluate((node) => {
    const lines = new Map<number, string>();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      const text = current.textContent ?? '';
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange();
        range.setStart(current, index);
        range.setEnd(current, index + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const top = Math.round(rect.top);
        lines.set(top, `${lines.get(top) ?? ''}${text[index]}`);
      }
    }
    return [...lines.entries()]
      .sort(([first], [second]) => first - second)
      .map(([, text]) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0);
  });
}

test.describe('Hero metadata facts', () => {
  for (const width of METADATA_MOBILE_WIDTHS) {
    test(`give every fact its own line at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: METADATA_VIEWPORT_HEIGHT });
      await page.goto('/');

      const availabilityTop = await topOf(metadataItem(page, profile.availability));
      const employerTop = await topOf(metadataFact(page, heroContent.employerLabel));
      expect(
        employerTop,
        'the NOW fact starts on its own line, below the availability fact',
      ).toBeGreaterThan(availabilityTop);

      const facts: [string, string][] = [
        ['location', heroContent.locationLabel],
        ['employer', heroContent.employerLabel],
        ['domain', profile.currentEmployer.context],
        ['language', heroContent.languageLabel],
      ];
      for (const [name, text] of facts) {
        const lines = await renderedLines(metadataFact(page, text));
        expect(lines.length, `the ${name} fact renders at least one line`).toBeGreaterThan(0);
        const lastLine = lines[lines.length - 1] ?? '';
        expect(
          lastLine.split(' ').filter(Boolean).length,
          `the last line of the ${name} fact holds more than one word: "${lastLine}"`,
        ).toBeGreaterThan(1);
      }
    });
  }

  for (const width of METADATA_WIDE_WIDTHS) {
    test(`keep the wide fact rows at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: METADATA_VIEWPORT_HEIGHT });
      await page.goto('/');

      const rows = new Map<number, string[]>();
      const facts: [string, Locator][] = [
        ['location', metadataFact(page, heroContent.locationLabel)],
        ['availability', metadataItem(page, profile.availability)],
        ['employer', metadataFact(page, heroContent.employerLabel)],
        ['domain', metadataFact(page, profile.currentEmployer.context)],
        ['language', metadataFact(page, heroContent.languageLabel)],
      ];
      for (const [name, locator] of facts) {
        const top = await topOf(locator);
        rows.set(top, [...(rows.get(top) ?? []), name]);
      }
      const shape = [...rows.entries()]
        .sort(([first], [second]) => first - second)
        .map(([, names]) => names.join(' + '));
      expect(shape, 'the wide hero keeps the fact rows it had').toEqual(WIDE_METADATA_ROWS[width]);
    });
  }
});
