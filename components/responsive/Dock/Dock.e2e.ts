import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Dock: mobile navigation', () => {
  test('shows the five controls', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole('link', { name: 'HOME' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'PROJECTS' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'SHELL' })).toBeVisible();
    await expect(dock.getByRole('link', { name: /Hire on LinkedIn/ })).toBeVisible();
    await expect(dock.getByRole('button', { name: /^MENU/ })).toBeVisible();
    await expect(dock.locator('a, button')).toHaveCount(5);
  });

  test('Work scrolls to Projects and becomes current', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: 'primary' });
    await dock.getByRole('link', { name: 'PROJECTS' }).click();
    await expect(page.locator('#sec-projects')).toBeInViewport();
    await expect(dock.getByRole('link', { name: 'PROJECTS' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  test('Hire opens LinkedIn in a new tab', async ({ page }) => {
    await page.goto('/');
    const hire = page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('link', { name: /Hire on LinkedIn/ });
    await expect(hire).toHaveAttribute('target', '_blank');
    await expect(hire).toHaveAttribute('href', /linkedin\.com\/in\/erikunha/);
  });

  test('Menu opens the drawer and Escape returns focus to it', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('navigation', { name: 'primary' }).getByRole('button', {
      name: /^MENU/,
    });
    await menu.click();
    await expect(page.getByRole('dialog', { name: 'Section menu' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(menu).toBeFocused();
  });
});

const NARROW_VIEWPORT = { width: 320, height: 640 };
const MIN_LABEL_GAP_PX = 8;
const MIN_TAP_TARGET_PX = 24;

test.describe('Dock: narrowest phone', () => {
  test.use({ viewport: NARROW_VIEWPORT });

  for (const path of ['/', '/pt']) {
    test(`${path} keeps every label inside its cell with a gap to its neighbour`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator('.dock')).toBeVisible();
      const cells = await page.evaluate(() =>
        [...document.querySelectorAll('.dock > a, .dock > button')].map((cell) => {
          const label = [...cell.childNodes].find(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          );
          const range = document.createRange();
          range.selectNodeContents(label as Node);
          const text = range.getBoundingClientRect();
          const box = cell.getBoundingClientRect();
          return {
            name: cell.textContent,
            cellLeft: box.left,
            cellRight: box.right,
            cellWidth: box.width,
            cellHeight: box.height,
            textLeft: text.left,
            textRight: text.right,
          };
        }),
      );
      expect(cells.length).toBeGreaterThan(0);
      for (const [index, cell] of cells.entries()) {
        expect(cell.textLeft, `${cell.name} starts left of its dock cell`).toBeGreaterThanOrEqual(
          cell.cellLeft,
        );
        expect(cell.textRight, `${cell.name} ends right of its dock cell`).toBeLessThanOrEqual(
          cell.cellRight,
        );
        expect(Math.min(cell.cellWidth, cell.cellHeight)).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        const next = cells[index + 1];
        if (next) {
          expect(
            next.textLeft - cell.textRight,
            `${cell.name} and ${next.name} labels must not crowd each other`,
          ).toBeGreaterThanOrEqual(MIN_LABEL_GAP_PX);
        }
      }
    });
  }
});
