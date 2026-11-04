import { expect, type Locator, test } from '@playwright/test';

const STATS = '#sec-guitar .guitar-facts > *';
const PHOTO = '#sec-guitar .guitar-photo';

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

    test('the facts stack top to bottom on one left edge', async ({ page }) => {
      await page.goto('/');
      const found = await edges(page.locator(STATS));
      expect(new Set(found.map((box) => box.left)).size).toBe(1);
      const tops = found.map((box) => box.top);
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      expect(new Set(tops).size).toBe(tops.length);
    });

    test('the photo spans the module and the mixer is gone from the guitar', async ({ page }) => {
      await page.goto('/');
      const photo = page.locator(PHOTO);
      await photo.scrollIntoViewIfNeeded();
      const box = await photo.boundingBox();
      const module = await page.locator('#sec-guitar .guitar-presentation').boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan((module?.width ?? 0) - 1);
      await expect(page.locator('#sec-guitar [data-testid^="channel-"]')).toHaveCount(0);
      await expect(page.locator('#sec-guitar .guitar-mixer')).toHaveCount(0);
    });
  });
}

test.describe('#sec-guitar at 1280px', () => {
  test.use({ viewport: DESKTOP });

  test('the photo sits directly above the facts', async ({ page }) => {
    await page.goto('/');
    const photo = page.locator(PHOTO);
    await photo.scrollIntoViewIfNeeded();
    const relation = await page.evaluate(() => {
      const photoEl = document.querySelector('#sec-guitar .guitar-photo');
      const factsEl = document.querySelector('#sec-guitar .guitar-facts');
      if (!photoEl || !factsEl) return 'missing';
      return String(photoEl.nextElementSibling === factsEl);
    });
    expect(relation).toBe('true');
  });

  test('facts sit in one row under the photo', async ({ page }) => {
    await page.goto('/');
    const found = await edges(page.locator(STATS));
    expect(found).toHaveLength(5);
    expect(new Set(found.map((box) => box.top)).size).toBe(1);
  });
});

test.describe('#sec-guitar at 1000px', () => {
  test.use({ viewport: TABLET });

  test('the facts take two columns', async ({ page }) => {
    await page.goto('/');
    const facts = await edges(page.locator(STATS));
    expect(new Set(facts.map((box) => box.left)).size).toBe(2);
  });
});

const SIGNAL_STRIP_PARTS = '#sec-guitar .guitar-signal-strip > *';
const TELEMETRY_BAR = '#sec-guitar .guitar-photo-telemetry > *';

for (const viewport of [PHONE, JUST_BELOW_DESKTOP]) {
  test.describe(`#sec-guitar rows become columns at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const [name, selector] of [
      ['signal strip parts', SIGNAL_STRIP_PARTS],
      ['photo bottom bar', TELEMETRY_BAR],
    ] as const) {
      test(`${name} stack top to bottom`, async ({ page }) => {
        await page.goto('/');
        const found = await edges(page.locator(selector));
        expect(new Set(found.map((box) => box.top)).size).toBe(found.length);
      });
    }
  });
}

test.describe('#sec-guitar facts keep their emphasis', () => {
  test.use({ viewport: DESKTOP });

  test('values and the obsession label are bold signal green at the phi text step', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator(STATS).first().scrollIntoViewIfNeeded();
    const styles = await page.evaluate(() => {
      const signal = document.createElement('span');
      signal.style.color = 'var(--color-primary-500)';
      document.body.append(signal);
      const expected = getComputedStyle(signal).color;
      signal.remove();
      const read = (selector: string) => {
        const node = document.querySelector(`#sec-guitar ${selector}`);
        const style = node ? getComputedStyle(node) : null;
        return style
          ? {
              color: style.color,
              weight: Number(style.fontWeight),
              size: Number.parseFloat(style.fontSize),
            }
          : null;
      };
      return {
        expected,
        value: read('.guitar-stat-value'),
        obsession: read('.guitar-influences strong'),
        body: read('.guitar-label'),
      };
    });
    expect(styles.value?.color).toBe(styles.expected);
    expect(styles.value?.weight).toBeGreaterThanOrEqual(700);
    expect(styles.value?.size).toBeGreaterThan(styles.body?.size ?? Number.POSITIVE_INFINITY);
    expect(styles.obsession?.color).toBe(styles.expected);
    expect(styles.obsession?.weight).toBeGreaterThanOrEqual(700);
  });
});
