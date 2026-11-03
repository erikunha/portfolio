import { expect, type Locator, test } from '@playwright/test';

const PAIR = '#sec-guitar .guitar-pair > *';
const STATS = '#sec-guitar .guitar-facts > *';
const STACKED_GROUPS = [
  { name: 'mixer and photo', children: PAIR },
  { name: 'facts', children: STATS },
];

const PHONE = { width: 390, height: 844 };
const JUST_BELOW_DESKTOP = { width: 767, height: 900 };
const TABLET = { width: 1000, height: 900 };
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

  test('mixer and photo stay side by side', async ({ page }) => {
    await page.goto('/');
    await page.locator(PAIR).first().scrollIntoViewIfNeeded();
    const [mixer, photo] = await page.locator(PAIR).evaluateAll((nodes) =>
      nodes.map((node) => {
        const { left, right, top, bottom } = node.getBoundingClientRect();
        return { left, right, top: top + window.scrollY, bottom: bottom + window.scrollY };
      }),
    );
    expect(mixer).toBeDefined();
    expect(photo).toBeDefined();
    expect(photo?.left ?? 0).toBeGreaterThanOrEqual(mixer?.right ?? Number.POSITIVE_INFINITY);
    expect(photo?.top ?? 0).toBeLessThan(mixer?.bottom ?? 0);
  });

  test('facts sit in one row under the pair', async ({ page }) => {
    await page.goto('/');
    const found = await edges(page.locator(STATS));
    expect(found).toHaveLength(5);
    expect(new Set(found.map((box) => box.top)).size).toBe(1);
  });
});

test.describe('#sec-guitar at 1000px', () => {
  test.use({ viewport: TABLET });

  test('the mixer sits above the photo and the facts take two columns', async ({ page }) => {
    await page.goto('/');
    const pair = await edges(page.locator(PAIR));
    expect(new Set(pair.map((box) => box.left)).size).toBe(1);
    const facts = await edges(page.locator(STATS));
    expect(new Set(facts.map((box) => box.left)).size).toBe(2);
  });
});

const PHI = 1.618;
const PHI_TOLERANCE = 0.05;
const SIGNAL_STRIP_PARTS = '#sec-guitar .guitar-signal-strip > *';
const CAMERA_LABELS = '#sec-guitar .guitar-camera-labels > *';
const CHANNEL_CELLS = '#sec-guitar fieldset[data-testid^="channel-"] >> nth=0';

for (const viewport of [PHONE, JUST_BELOW_DESKTOP]) {
  test.describe(`#sec-guitar rows become columns at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const [name, selector] of [
      ['signal strip parts', SIGNAL_STRIP_PARTS],
      ['camera labels', CAMERA_LABELS],
    ] as const) {
      test(`${name} stack top to bottom`, async ({ page }) => {
        await page.goto('/');
        const found = await edges(page.locator(selector));
        expect(new Set(found.map((box) => box.top)).size).toBe(found.length);
      });
    }

    test('the cells of a channel row share one left edge', async ({ page }) => {
      await page.goto('/');
      const row = page.locator(CHANNEL_CELLS);
      await row.scrollIntoViewIfNeeded();
      const lefts = await row.evaluate((node) =>
        Array.from(node.children)
          .filter((child) => child.getBoundingClientRect().height > 0)
          .map((child) => Math.round(child.getBoundingClientRect().left)),
      );
      expect(lefts.length).toBeGreaterThan(1);
      expect(new Set(lefts).size).toBe(1);
    });
  });
}

test.describe('#sec-guitar golden-ratio split at 1280px', () => {
  test.use({ viewport: DESKTOP });

  test('the mixer is 1.618 times as wide as the photo', async ({ page }) => {
    await page.goto('/');
    const widths = await page
      .locator(PAIR)
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
    expect(widths).toHaveLength(2);
    const [mixer = 0, photo = 1] = widths;
    expect(Math.abs(mixer / photo - PHI)).toBeLessThan(PHI_TOLERANCE);
  });
});
