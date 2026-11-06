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
  { name: 'links CTA buttons', path: '/links', container: '[data-testid="links-channel-actions"]' },
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

for (const path of ['/', '/pt']) {
  test(`dock items keep one height and one-line labels at 320 (${path})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const items = page.locator('.dock > a, .dock > button');
    const heights = await items.evaluateAll((nodes) =>
      nodes.map((item) => Math.round(item.getBoundingClientRect().height)),
    );
    expect(heights.length).toBeGreaterThan(1);
    expect(new Set(heights).size, `dock item heights ${heights.join(',')}`).toBe(1);
    const lineCounts = await items.evaluateAll((nodes) =>
      nodes.map((node) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let lines = 0;
        let textNode = walker.nextNode();
        while (textNode) {
          if ((textNode.textContent ?? '').trim()) {
            range.selectNodeContents(textNode);
            lines += Array.from(range.getClientRects()).length;
          }
          textNode = walker.nextNode();
        }
        range.detach();
        return lines;
      }),
    );
    expect(
      lineCounts,
      `dock labels must render on one line, got line counts ${lineCounts.join(',')}`,
    ).toEqual(lineCounts.map(() => 1));
  });
}

test('the contact submit button spans its row below 768 and keeps its size at 1280', async ({
  page,
}) => {
  const rowGap = async () =>
    page.locator('.contact-send').evaluate((button) => {
      const row = button.closest('.contact-submit-row')?.getBoundingClientRect();
      return row ? Math.round(row.width - button.getBoundingClientRect().width) : Number.NaN;
    });
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  expect(await rowGap(), 'free space beside the button on a phone').toBeLessThanOrEqual(
    EDGE_TOLERANCE_PX,
  );
  await page.setViewportSize(DESKTOP);
  expect(await rowGap(), 'the desktop button keeps its natural width').toBeGreaterThan(
    EDGE_TOLERANCE_PX,
  );
});

for (const bar of ['.shell-chrome', '.contact-chrome']) {
  test(`${bar} keeps the window dots left and centres its labels at 375`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const chrome = page.locator(bar).first();
    await chrome.scrollIntoViewIfNeeded();
    const layout = await chrome.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(element).paddingLeft);
      const [dots, ...labels] = [...element.children].map((child) => child.getBoundingClientRect());
      const centre = (box.left + box.right) / 2;
      return {
        dotsOffset: (dots?.left ?? 0) - (box.left + padding),
        labelOffsets: labels.map((label) => Math.abs((label.left + label.right) / 2 - centre)),
      };
    });
    expect(layout.dotsOffset, 'the close/minimise/zoom dots stay at the left edge').toBeLessThan(2);
    for (const offset of layout.labelOffsets) {
      expect(offset, 'a wrapped label sits on the centre axis, not stranded right').toBeLessThan(3);
    }
  });
}
