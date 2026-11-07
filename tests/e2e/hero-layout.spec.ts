import { expect, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const MOBILE_HERO_MAX_PX = 600;

test.describe('hero desktop layout', () => {
  for (const width of [768, 1280]) {
    test(`the hero clears the topbar and keeps the section rhythm at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const hero = page.locator('[data-testid="hero-desktop"]');
      await expect(hero).toBeVisible();

      const geometry = await page.evaluate(() => {
        const bar = document.querySelector('.desktop-topbar')?.getBoundingClientRect();
        const heroBox = document
          .querySelector('[data-testid="hero-desktop"]')
          ?.getBoundingClientRect();
        const aboutSection = document.querySelector('#sec-readme');
        const about = aboutSection?.getBoundingClientRect();
        const next = aboutSection?.nextElementSibling?.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.paddingTop = 'var(--space-page-top)';
        document.body.appendChild(probe);
        const pageTop = Number.parseFloat(getComputedStyle(probe).paddingTop);
        probe.remove();
        return {
          barBottom: bar?.bottom ?? 0,
          heroTop: heroBox?.top ?? 0,
          heroBottom: heroBox?.bottom ?? 0,
          aboutTop: about?.top ?? 0,
          aboutBottom: about?.bottom ?? 0,
          nextTop: next?.top ?? 0,
          pageTop,
        };
      });

      expect(
        geometry.heroTop - geometry.barBottom,
        'the hero must clear the fixed topbar by the section spacing',
      ).toBeGreaterThanOrEqual(geometry.pageTop);
      const heroGap = geometry.aboutTop - geometry.heroBottom;
      const sectionGap = geometry.nextTop - geometry.aboutBottom;
      expect(
        Math.abs(heroGap - sectionGap),
        'the hero-to-section gap must match the gap between the other sections',
      ).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('hero mobile layout', () => {
  test('the mobile hero fits the 600px budget at 390', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const hero = page.locator('[data-testid="hero-mobile"]');
    await expect(hero).toBeVisible();
    const height = await hero.evaluate((node) => node.getBoundingClientRect().height);
    expect(
      height,
      'the mobile hero grew past the budget: the boot log, the stats and the CTA rows are the levers',
    ).toBeLessThanOrEqual(MOBILE_HERO_MAX_PX);
  });

  for (const [path, width] of [
    ['/', 320],
    ['/pt', 320],
    ['/', 1280],
    ['/pt', 1280],
  ] as const) {
    test(`stat tile text stays inside its tile at ${width} (${path})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto(path);
      const stats = page.locator('[data-testid="hero-stats"]').filter({ visible: true }).first();
      await expect(stats).toBeVisible();
      const overflow = await stats.evaluate((node) => {
        const found: string[] = [];
        for (const tile of node.querySelectorAll('.stat-tile')) {
          const tileBox = tile.getBoundingClientRect();
          for (const text of tile.querySelectorAll('.stat-tile-label, .stat-tile-value')) {
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const rect of Array.from(range.getClientRects())) {
              if (rect.right > tileBox.right + 1 || rect.left < tileBox.left - 1) {
                found.push(`${text.textContent}: paints past its stat tile`);
                break;
              }
            }
            range.detach();
          }
        }
        return found;
      });
      expect(overflow, `no stat tile text may overflow its tile at ${width}px`).toEqual([]);
    });
  }

  test('the impact stats render as a 2x2 grid at 390', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const stats = page.locator('[data-testid="hero-stats"]').filter({ visible: true }).first();
    await expect(stats).toBeVisible();
    const { columns, rows } = await stats.evaluate((node) => {
      const style = getComputedStyle(node);
      const tops = new Set(
        [...node.children].map((child) => Math.round(child.getBoundingClientRect().top)),
      );
      return {
        columns: style.gridTemplateColumns.split(' ').length,
        rows: tops.size,
      };
    });
    expect(columns, 'the stats grid must be two columns wide at 390').toBe(2);
    expect(rows, 'the stats grid must be two rows tall at 390').toBe(2);
  });
});
