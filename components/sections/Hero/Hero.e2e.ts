import { expect, type Locator, type Page, test } from '@playwright/test';
import { heroContent } from '@/content/hero';
import { profile } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { waitForHydration } from '../../../tests/e2e/_helpers/hydration';

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
      const hire = hero.getByRole('link', {
        name: heroContent[SITE_LOCALE.en].hire.accessibleLabel,
      });
      await expect(hire).toBeVisible();
      await expect(hire).toHaveAttribute('href', heroContent[SITE_LOCALE.en].hire.href);
      for (const action of heroContent[SITE_LOCALE.en].actions) {
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

const TABLET_BOOT_WIDTHS = [768, 1023];
const TABLET_BOOT_VIEWPORT_HEIGHT = 900;

test.describe('Hero boot log between 768 and 1023px', () => {
  for (const width of TABLET_BOOT_WIDTHS) {
    test(`keeps every boot line on one line at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: TABLET_BOOT_VIEWPORT_HEIGHT });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');

      const lines = page.locator('.hero-desktop .hero-boot-line');
      await expect(lines.first()).toBeVisible();
      const count = await lines.count();
      expect(count, 'the desktop boot log renders its lines').toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        const line = lines.nth(index);
        const measured = await line.evaluate((node) => ({
          height: node.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(node).lineHeight),
          text: (node.textContent ?? '').trim(),
        }));
        expect(
          measured.height,
          `boot line ${index} wraps onto a second line: "${measured.text}"`,
        ).toBeLessThanOrEqual(measured.lineHeight + 1);
        if (measured.text.length > 0) {
          expect(
            Math.abs(measured.height - measured.lineHeight),
            `boot line ${index} is not exactly one line tall: "${measured.text}"`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

const METADATA_MOBILE_WIDTHS = [320, 390];
const METADATA_WIDE_WIDTHS = [768, 1280];
const METADATA_VIEWPORT_HEIGHT = 900;

const WIDE_METADATA_ROWS: Record<number, string[]> = {
  768: ['location + availability + employer', 'domain + language'],
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
      const employerTop = await topOf(
        metadataFact(page, heroContent[SITE_LOCALE.en].employerLabel),
      );
      expect(
        employerTop,
        'the NOW fact starts on its own line, below the availability fact',
      ).toBeGreaterThan(availabilityTop);

      const facts: [string, string][] = [
        ['location', heroContent[SITE_LOCALE.en].locationLabel],
        ['employer', heroContent[SITE_LOCALE.en].employerLabel],
        ['domain', profile.currentEmployer.context],
        ['language', heroContent[SITE_LOCALE.en].languageLabel],
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
        ['location', metadataFact(page, heroContent[SITE_LOCALE.en].locationLabel)],
        ['availability', metadataItem(page, profile.availability)],
        ['employer', metadataFact(page, heroContent[SITE_LOCALE.en].employerLabel)],
        ['domain', metadataFact(page, profile.currentEmployer.context)],
        ['language', metadataFact(page, heroContent[SITE_LOCALE.en].languageLabel)],
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

for (const width of [320, 375]) {
  test(`every hero CTA label fits inside its box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    const overflowing = await page
      .locator('.hero-frame:visible [data-testid="hero-ctas"] > a')
      .evaluateAll((links) =>
        links
          .filter((link) => link.scrollWidth > link.clientWidth)
          .map((link) => `${link.textContent?.trim()} ${link.scrollWidth}/${link.clientWidth}`),
      );
    expect(overflowing, 'a CTA label wider than its box paints over the border').toEqual([]);
  });
}

for (const width of [375, 1280]) {
  test(`the WHOAMI gutter numbers every visual line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const fit = await page
      .locator('.ab-text')
      .first()
      .evaluate((body) => {
        const gutter = body.querySelector<HTMLElement>('.ab-gutter');
        const prose = body.querySelector<HTMLElement>('.ab-prose');
        const first = gutter?.firstElementChild?.getBoundingClientRect();
        if (!gutter || !prose || !first) return null;
        const rows = prose.getBoundingClientRect().height / first.height;
        const gutterBottom = gutter.getBoundingClientRect().bottom;
        const shown = [...gutter.children].filter(
          (span) => span.getBoundingClientRect().bottom <= gutterBottom + 1,
        ).length;
        return { rows, shown, total: gutter.children.length };
      });
    expect(fit).not.toBeNull();
    expect(
      Math.abs((fit?.rows ?? 0) - Math.round(fit?.rows ?? 0)),
      'prose lines sit on the gutter rhythm',
    ).toBeLessThan(0.15);
    expect(fit?.shown, 'one number per visual line of prose').toBe(Math.round(fit?.rows ?? 0));
    expect(fit?.total, 'the gutter holds more numbers than any width shows').toBeGreaterThan(
      fit?.shown ?? 0,
    );
  });
}

const BOOT_HOST = '.hero-boot-desktop';
const BOOT_QUIET_WINDOW_MS = 1500;
const BOOT_SETTLE_MS = 400;
const BOOT_DIALOG_HOLD_MS = 2500;
const BOOT_DIALOG_START_TIMEOUT_MS = 15_000;
const SCROLL_STEP_PX = 1200;
const SCROLL_STEPS = 12;

async function countBootMutations(page: Page, windowMs: number): Promise<number> {
  return page.evaluate(
    ([selector, ms]) =>
      new Promise<number>((resolve) => {
        const host = document.querySelector(selector as string);
        let count = 0;
        const observer = new MutationObserver((records) => {
          count += records.length;
        });
        if (host) observer.observe(host, { childList: true, characterData: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, ms as number);
      }),
    [BOOT_HOST, windowMs] as const,
  );
}

test.describe('Hero boot loop follows the motion switch and the viewport', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('the MOTION control stops the typing loop and shows the static boot', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, BOOT_HOST);
    await expect(page.locator(`${BOOT_HOST} .hero-boot-matrix-out`)).not.toBeEmpty({
      timeout: BOOT_DIALOG_START_TIMEOUT_MS,
    });
    expect(
      await countBootMutations(page, BOOT_QUIET_WINDOW_MS),
      'the boot dialog types while motion is on',
    ).toBeGreaterThan(0);

    await page.locator('.topbar-action-toggle').click();
    await expect(page.locator('.topbar-action-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(BOOT_SETTLE_MS);

    expect(
      await countBootMutations(page, BOOT_QUIET_WINDOW_MS),
      'with motion off the boot log must not change',
    ).toBe(0);
    await expect(page.locator(`${BOOT_HOST} .hero-boot-cmd`)).toHaveText('run bio.exe --verbose');
  });

  test('the boot dialog stops typing while the hero is scrolled out of view', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page, BOOT_HOST);
    await expect(page.locator(`${BOOT_HOST} .hero-boot-matrix-out`)).not.toBeEmpty({
      timeout: BOOT_DIALOG_START_TIMEOUT_MS,
    });
    for (let step = 0; step < SCROLL_STEPS; step += 1) {
      await page.evaluate(
        (dy) => window.scrollBy({ top: dy, behavior: 'instant' }),
        SCROLL_STEP_PX,
      );
    }
    await expect(
      page.locator(BOOT_HOST),
      'the hero must leave the viewport; scrolling uses scrollBy because WebKit throws on mouse.wheel when isMobile is set, and the visibility observer reacts to any scroll',
    ).not.toBeInViewport();
    await page.waitForTimeout(BOOT_DIALOG_HOLD_MS);

    expect(
      await countBootMutations(page, BOOT_QUIET_WINDOW_MS),
      'an off-screen hero must not keep typing',
    ).toBe(0);
  });
});
