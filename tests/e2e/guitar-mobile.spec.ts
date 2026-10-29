import { expect, type Locator, test } from 'playwright/test';

const CHAIN = '#sec-guitar [data-testid^="signal-node-"]';
const PAIR = '#sec-guitar .guitar-pair > *';
const STATS = '#sec-guitar .guitar-stats > *';
const STACKED_GROUPS = [
  { name: 'signal chain nodes', children: CHAIN },
  { name: 'details and photo', children: PAIR },
  { name: 'stat facts', children: STATS },
];

const PHONE = { width: 390, height: 844 };
const JUST_BELOW_DESKTOP = { width: 767, height: 900 };
const DESKTOP = { width: 1280, height: 720 };

async function edges(children: Locator) {
  await children.first().scrollIntoViewIfNeeded();
  const found = await children.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { left, top } = node.getBoundingClientRect();
      return { left: Math.round(left), top: Math.round(top) };
    }),
  );
  expect(found.length).toBeGreaterThan(1);
  return found;
}

for (const viewport of [PHONE, JUST_BELOW_DESKTOP]) {
  test.describe(`#sec-guitar at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const group of STACKED_GROUPS) {
      test(`${group.name} share one left edge and stack top to bottom`, async ({ page }) => {
        await page.goto('/');
        const found = await edges(page.locator(group.children));
        expect(new Set(found.map((box) => box.left)).size).toBe(1);
        const tops = found.map((box) => box.top);
        expect(tops).toEqual([...tops].sort((a, b) => a - b));
        expect(new Set(tops).size).toBe(tops.length);
      });
    }
  });
}

test.describe('#sec-guitar at 1280px', () => {
  test.use({ viewport: DESKTOP });

  test('signal chain nodes stay on one row', async ({ page }) => {
    await page.goto('/');
    const found = await edges(page.locator(CHAIN));
    expect(new Set(found.map((box) => box.top)).size).toBe(1);
  });

  test('details and photo stay side by side', async ({ page }) => {
    await page.goto('/');
    const found = await edges(page.locator(PAIR));
    expect(new Set(found.map((box) => box.top)).size).toBe(1);
    expect(new Set(found.map((box) => box.left)).size).toBe(found.length);
  });

  test('stat facts stay in two columns', async ({ page }) => {
    await page.goto('/');
    const found = await edges(page.locator(STATS));
    expect(new Set(found.map((box) => box.left)).size).toBe(2);
  });
});
