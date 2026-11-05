import { expect, type Locator, test } from '@playwright/test';

const CHAIN = '#sec-guitar [data-testid^="signal-node-"]';
const PAIR = '#sec-guitar .guitar-pair > *';
const STATS = '#sec-guitar .guitar-stats > *';
const STACKED_GROUPS = [
  { name: 'signal chain nodes', children: CHAIN },
  { name: 'details and photo', children: PAIR },
  { name: 'stat facts', children: STATS },
];
const ROW_PARTS = ['#sec-guitar .guitar-signal-strip > *', '#sec-guitar .guitar-camera-labels > *'];

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

    test('the signal strip parts and the camera labels stack top to bottom', async ({ page }) => {
      await page.goto('/');
      for (const selector of ROW_PARTS) {
        const found = await edges(page.locator(selector));
        expect(new Set(found.map((box) => box.top)).size).toBe(found.length);
      }
    });
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

  test('the EQ strip opens the module, then the signal chain, then the mixer', async ({ page }) => {
    await page.goto('/');
    const order = await page.evaluate(() => {
      const strip = document.querySelector('#sec-guitar [data-testid="eq-spectrum"]');
      const chain = document.querySelector('#sec-guitar .guitar-chain');
      const mixer = document.querySelector('#sec-guitar .guitar-mixer');
      if (!strip || !chain || !mixer) return 'missing';
      const precedes = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return String(precedes(strip, chain) && precedes(chain, mixer));
    });
    expect(order).toBe('true');
  });
});

test.describe('#sec-guitar facts keep their emphasis', () => {
  test.use({ viewport: DESKTOP });

  test('values and the obsession label are bold signal green', async ({ page }) => {
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
        return style ? { color: style.color, weight: Number(style.fontWeight) } : null;
      };
      return {
        expected,
        value: read('.guitar-stat-value'),
        obsession: read('.guitar-influences strong'),
      };
    });
    expect(styles.value?.color).toBe(styles.expected);
    expect(styles.value?.weight).toBeGreaterThanOrEqual(700);
    expect(styles.obsession?.color).toBe(styles.expected);
    expect(styles.obsession?.weight).toBeGreaterThanOrEqual(700);
  });
});

for (const viewport of [PHONE, JUST_BELOW_DESKTOP]) {
  test(`stacked signal arrows stay between the nodes at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const chain = page.locator('#sec-guitar .guitar-chain');
    await chain.scrollIntoViewIfNeeded();
    const overlaps = await chain.evaluate((element) => {
      const children = [...element.children];
      const found: string[] = [];
      children.forEach((child, index) => {
        if (!child.classList.contains('guitar-arrow')) return;
        const { top, bottom } = child.getBoundingClientRect();
        const above = children[index - 1]?.getBoundingClientRect();
        const below = children[index + 1]?.getBoundingClientRect();
        if (above && top < above.bottom - 1) found.push(`arrow ${index} enters the node above`);
        if (below && bottom > below.top + 1) found.push(`arrow ${index} enters the node below`);
      });
      return found;
    });
    expect(overlaps, 'a rotated arrow longer than its row paints over the node text').toEqual([]);
  });
}

for (const width of [834, 1024, 1280]) {
  test(`every mixer plugin name is readable in full at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const mixer = page.locator('[data-testid="daw-mixer-desktop"]');
    if ((await mixer.count()) === 0) return;
    await mixer.scrollIntoViewIfNeeded();
    const clipped = await mixer
      .locator('[data-testid^="plugin-"] > span:first-child')
      .evaluateAll((labels) =>
        labels
          .filter(
            (label) =>
              label.scrollWidth > label.clientWidth + 1 ||
              label.scrollHeight > label.clientHeight + 1,
          )
          .map((label) => label.textContent),
      );
    expect(clipped, 'a plugin chip narrower than its name shows an ellipsis').toEqual([]);
  });
}

for (const width of [320, 375, 600]) {
  test(`the desktop mixer stacks its channels without a sideways scroll at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const mixer = page.locator('[data-testid="daw-mixer-desktop"]');
    if ((await mixer.count()) === 0) return;
    await mixer.scrollIntoViewIfNeeded();
    const fit = await mixer.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(
      fit.scroll,
      'a narrow desktop browser gets the desktop mixer, which must reflow, not scroll',
    ).toBeLessThanOrEqual(fit.client);
  });
}
