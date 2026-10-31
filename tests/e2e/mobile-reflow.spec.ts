import { expect, type Locator, test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
const EDGE_TOLERANCE_PX = 1;

interface Group {
  name: string;
  path: string;
  container: string;
}

const GROUPS: Group[] = [
  { name: 'links CTA buttons', path: '/links', container: 'section .grid.gap-2.mt-\\[13px\\]' },
  { name: 'links footer list', path: '/links', container: 'ul.list-none.grid.gap-2' },
  { name: 'cv actions', path: '/cv', container: '.reading-actions' },
  {
    name: 'cv row',
    path: '/cv',
    container: '.reading-rows li',
  },
  { name: 'summary actions', path: '/summary', container: '.reading-actions' },
  { name: 'summary stats', path: '/summary', container: '.reading-stats' },
];

interface Box {
  left: number;
  width: number;
}

async function measure(container: Locator): Promise<{ inner: number; children: Box[] }> {
  return container.first().evaluate((node) => {
    const style = getComputedStyle(node);
    const px = (value: string) => Number.parseFloat(value) || 0;
    const rect = node.getBoundingClientRect();
    const inner =
      rect.width -
      px(style.paddingLeft) -
      px(style.paddingRight) -
      px(style.borderLeftWidth) -
      px(style.borderRightWidth);
    const children = Array.from(node.children).map((child) => {
      const box = child.getBoundingClientRect();
      return { left: box.left, width: box.width };
    });
    return { inner, children };
  });
}

test.describe('mobile reflow: side-by-side groups stack below the tablet breakpoint', () => {
  for (const group of GROUPS) {
    test(`${group.name} is one full-width column at 390`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(group.path);
      const container = page.locator(group.container);
      await expect(container.first()).toBeVisible();
      const { inner, children } = await measure(container);
      const [first] = children;
      expect(first).toBeDefined();
      for (const child of children) {
        expect(Math.abs(child.left - (first?.left ?? 0))).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
        expect(child.width).toBeGreaterThanOrEqual(inner - EDGE_TOLERANCE_PX);
      }
    });

    test(`${group.name} keeps children side by side at 1280`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(group.path);
      const container = page.locator(group.container);
      await expect(container.first()).toBeVisible();
      const { children } = await measure(container);
      expect(children.length).toBeGreaterThan(1);
      const lefts = new Set(children.map((child) => Math.round(child.left)));
      expect(lefts.size).toBeGreaterThan(1);
    });
  }
});
