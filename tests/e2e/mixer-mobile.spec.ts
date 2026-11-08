import { expect, test } from '@playwright/test';
import { horizontalOverflow } from './_helpers/geometry';
import { installMockBackend } from './_helpers/mock-backend';

const SECTION_SELECTOR = '#sec-guitar';
const DESKTOP_SELECTOR = '#sec-guitar [data-testid="daw-mixer-desktop"]';
const MOBILE_SELECTOR = '#sec-guitar [data-testid="daw-mixer-mobile"]';
const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE_PX = 1;
const CROSSING_TOLERANCE_PX = 4;
const LINE_LEADING_TOLERANCE_PX = 4;
const MOBILE_PROJECTS = ['chromium-mobile', 'webkit-mobile'];
const FONT_FLOOR_PX = 12;
const CHANNEL_IDS = ['CH 01', 'CH 02', 'MASTER'];

test('the DAW mixer shares the guitar module and has no section of its own', async ({ page }) => {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.goto('/');
  const section = page.locator(SECTION_SELECTOR);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  await expect(section.locator('h2').first()).toContainText('./MIX --LIVE');
  await expect(page.locator('#sec-daw-mixer')).toHaveCount(0);
  const mixerBelowPair = await page.evaluate(() => {
    const pair = document.querySelector('#sec-guitar .guitar-pair');
    return pair?.nextElementSibling?.classList.contains('guitar-mixer') ?? false;
  });
  expect(mixerBelowPair, 'the mixer must follow the photo pair inside the module').toBe(true);
  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main section[id]')).map((el) => el.id),
  );
  expect(order.indexOf('sec-guitar')).toBeGreaterThanOrEqual(0);
  expect(order[order.indexOf('sec-guitar') + 1]).toBe('sec-contact');
});

const OVERFLOW_WIDTHS = [320, 390, 768, 1280];

for (const width of OVERFLOW_WIDTHS) {
  test(`the guitar and mixer module keeps the page inside the viewport at ${width}px`, async ({
    page,
  }) => {
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await page.locator(SECTION_SELECTOR).scrollIntoViewIfNeeded();
    expect(
      await horizontalOverflow(page),
      'the guitar and mixer module must not push the page into horizontal scroll',
    ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
  });
}

test('mobile UAs render the three-card mobile mixer with its own session header', async ({
  page,
}, testInfo) => {
  test.skip(
    !MOBILE_PROJECTS.includes(testInfo.project.name),
    'the mobile variant only ships to mobile user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(MOBILE_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toBeVisible();
  await expect(mixer.locator('[data-testid="session-header-mobile"]')).toContainText(
    'YELLOW_TAKE_03.ALS',
  );
  await expect(mixer.locator('[data-testid="session-header-mobile"]')).toContainText(
    '2 GTR TRACKS + MASTER',
  );
  const cards = mixer.locator('[data-testid^="channel-mobile-"]');
  await expect(cards).toHaveCount(CHANNEL_IDS.length);
  await expect(mixer.locator('[data-testid="channel-mobile-MASTER"]')).toBeVisible();
});

test('the cells of a mobile channel card share one left edge', async ({ page }, testInfo) => {
  test.skip(
    !MOBILE_PROJECTS.includes(testInfo.project.name),
    'the mobile variant only ships to mobile user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const card = page.locator('#sec-guitar [data-testid="channel-mobile-CH 01"]');
  await card.scrollIntoViewIfNeeded();
  const lefts = await card.evaluate((node) =>
    Array.from(node.children)
      .filter((child) => child.getBoundingClientRect().height > 0)
      .map((child) => Math.round(child.getBoundingClientRect().left)),
  );
  expect(lefts.length).toBeGreaterThan(1);
  expect(new Set(lefts).size).toBe(1);
});

test('desktop UAs render the three-channel table with session and column headers', async ({
  page,
}, testInfo) => {
  test.skip(
    MOBILE_PROJECTS.includes(testInfo.project.name),
    'the desktop table only ships to desktop user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 1280, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(DESKTOP_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toBeVisible();
  await expect(mixer.locator('[data-testid="session-header"]')).toContainText('YELLOW_TAKE_03.ALS');
  for (const id of CHANNEL_IDS) {
    await expect(mixer.locator(`[data-testid="channel-${id}"]`)).toBeVisible();
  }
  const headerText = await mixer.locator('.daw-channel-row').first().textContent();
  for (const column of ['ID', 'TRACK', 'I/O', 'R/M/S', 'PLUGIN CHAIN', 'METER', 'FADER', 'dB']) {
    expect(headerText).toContain(column);
  }
});

for (const width of [1280, 320]) {
  test(`no two cells of a desktop channel row overlap at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(
      MOBILE_PROJECTS.includes(testInfo.project.name),
      'the desktop table only ships to desktop user agents',
    );
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const mixer = page.locator(DESKTOP_SELECTOR);
    await mixer.scrollIntoViewIfNeeded();
    await expect(mixer.locator('[data-testid^="channel-"]').first()).toBeVisible();

    const overlaps = await page.evaluate(
      ({ selector, crossingTolerance, lineLeadingTolerance }) => {
        for (const el of document.querySelectorAll('[data-cv-defer]')) {
          (el as HTMLElement).style.contentVisibility = 'visible';
        }
        const found: string[] = [];
        const range = document.createRange();
        const intersect = (
          a: { left: number; top: number; right: number; bottom: number },
          b: { left: number; top: number; right: number; bottom: number },
        ) => ({
          left: Math.max(a.left, b.left),
          top: Math.max(a.top, b.top),
          right: Math.min(a.right, b.right),
          bottom: Math.min(a.bottom, b.bottom),
        });
        for (const row of document.querySelectorAll(`${selector} .daw-channel-row`)) {
          const cells = Array.from(row.children);
          for (const [index, first] of cells.entries()) {
            for (const second of cells.slice(index + 1)) {
              const a = first.getBoundingClientRect();
              const b = second.getBoundingClientRect();
              const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (overlapX > 1 && overlapY > 1) {
                found.push(`${row.getAttribute('data-testid')}: cell overlap`);
              }
            }
          }
          for (const [cellIndex, cell] of cells.entries()) {
            const cellBox = cell.getBoundingClientRect();
            const prevCell = cellIndex > 0 ? cells[cellIndex - 1] : undefined;
            const nextCell = cellIndex < cells.length - 1 ? cells[cellIndex + 1] : undefined;
            const sameLine = (box: DOMRect | undefined) =>
              box && box.bottom > cellBox.top + 1 && box.top < cellBox.bottom - 1 ? box : null;
            const prevBox = sameLine(prevCell?.getBoundingClientRect());
            const nextBox = sameLine(nextCell?.getBoundingClientRect());
            const leftLimit = prevBox ? prevBox.right : cellBox.left - crossingTolerance;
            const rightLimit = nextBox ? nextBox.left : cellBox.right + crossingTolerance;
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();
            while (textNode) {
              if ((textNode.textContent ?? '').trim()) {
                const chain: Element[] = [];
                for (
                  let el: Element | null = textNode.parentElement;
                  el && el !== cell;
                  el = el.parentElement
                ) {
                  const style = getComputedStyle(el);
                  if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
                    chain.push(el);
                  }
                }
                const tracking = Number.parseFloat(
                  getComputedStyle(textNode.parentElement ?? cell).letterSpacing,
                );
                range.selectNodeContents(textNode);
                for (const rect of Array.from(range.getClientRects())) {
                  let visible = {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right - (Number.isFinite(tracking) ? tracking : 0),
                    bottom: rect.bottom,
                  };
                  for (const clipper of chain) {
                    visible = intersect(visible, clipper.getBoundingClientRect());
                  }
                  if (visible.right - visible.left <= 1 || visible.bottom - visible.top <= 1) {
                    continue;
                  }
                  const overTop = cellBox.top - visible.top;
                  const overBottom = visible.bottom - cellBox.bottom;
                  if (
                    visible.left < leftLimit - crossingTolerance ||
                    visible.right > rightLimit + crossingTolerance ||
                    overTop > lineLeadingTolerance ||
                    overBottom > lineLeadingTolerance
                  ) {
                    found.push(
                      `${row.getAttribute('data-testid')}: text paints into a neighboring cell`,
                    );
                  }
                }
              }
              textNode = walker.nextNode();
            }
          }
        }
        range.detach();
        return found;
      },
      {
        selector: DESKTOP_SELECTOR,
        crossingTolerance: CROSSING_TOLERANCE_PX,
        lineLeadingTolerance: LINE_LEADING_TOLERANCE_PX,
      },
    );

    expect(overlaps, 'grid cells of a channel row must not share the same grid area').toEqual([]);
  });
}

test('narrow desktop windows stack the console instead of scrolling or shrinking targets', async ({
  page,
}, testInfo) => {
  test.skip(
    MOBILE_PROJECTS.includes(testInfo.project.name),
    'the desktop table only ships to desktop user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(DESKTOP_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();

  const metrics = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const fader = root?.querySelector('.fader-track');
    const meter = root?.querySelector('.vu-meter');
    return {
      clientWidth: root?.clientWidth ?? 0,
      scrollWidth: root?.scrollWidth ?? 0,
      faderWidth: fader?.getBoundingClientRect().width ?? 0,
      meterWidth: meter?.getBoundingClientRect().width ?? 0,
    };
  }, DESKTOP_SELECTOR);

  expect(metrics.faderWidth, 'a channel fader must keep a 24px target').toBeGreaterThanOrEqual(24);
  expect(metrics.meterWidth, 'a VU meter must keep a 24px target').toBeGreaterThanOrEqual(24);
  expect(
    metrics.scrollWidth,
    'below the md breakpoint each channel stacks into rows, so nothing scrolls sideways',
  ).toBeLessThanOrEqual(metrics.clientWidth);
});

test('the mobile mixer renders no text below the 12px floor', async ({ page }, testInfo) => {
  test.skip(
    !MOBILE_PROJECTS.includes(testInfo.project.name),
    'the mobile variant only ships to mobile user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const mixer = page.locator(MOBILE_SELECTOR);
  await mixer.scrollIntoViewIfNeeded();
  await expect(mixer).toBeVisible();
  const small = await mixer.evaluate((root, floor) => {
    const found: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const ownText = Array.from(el.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
      );
      if (!ownText) continue;
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      if (size < floor) found.push(`${el.tagName.toLowerCase()}: ${size}px`);
    }
    return found;
  }, FONT_FLOOR_PX);
  expect(small).toEqual([]);
});

const WCAG_MIN_TARGET_PX = 24;
const TOUCH_TARGET_PX = 44;
const NARROW_WIDTHS = [320, 375];

async function rmsBoxes(page: import('@playwright/test').Page) {
  await page.locator(DESKTOP_SELECTOR).scrollIntoViewIfNeeded();
  return page.locator(`${DESKTOP_SELECTOR} .rms-buttons button`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { name: node.getAttribute('aria-label'), width: box.width, height: box.height };
    }),
  );
}

for (const width of NARROW_WIDTHS) {
  test(`record, mute and solo keep a 24px target at ${width}px`, async ({ page }, testInfo) => {
    test.skip(
      MOBILE_PROJECTS.includes(testInfo.project.name),
      'the desktop table only ships to desktop user agents',
    );
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const boxes = await rmsBoxes(page);
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(WCAG_MIN_TARGET_PX);
      expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(WCAG_MIN_TARGET_PX);
    }
  });
}

test.describe('touch screens', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const width of NARROW_WIDTHS) {
    test(`record, mute and solo reach 44px and the console stays inside ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(
        MOBILE_PROJECTS.includes(testInfo.project.name),
        'the desktop table only ships to desktop user agents',
      );
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');
      const boxes = await rmsBoxes(page);
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
        expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
      }
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
    });
  }
});

test('channel subtitles wrap below the md breakpoint instead of truncating', async ({
  page,
}, testInfo) => {
  test.skip(
    MOBILE_PROJECTS.includes(testInfo.project.name),
    'the desktop table only ships to desktop user agents',
  );
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  await page.locator(DESKTOP_SELECTOR).scrollIntoViewIfNeeded();
  const clipped = await page
    .locator(`${DESKTOP_SELECTOR} [data-testid="mixer-desc"]`)
    .evaluateAll((nodes) =>
      nodes
        .filter(
          (node) =>
            node.scrollWidth > node.clientWidth + 1 ||
            (getComputedStyle(node).textOverflow === 'ellipsis' &&
              getComputedStyle(node).whiteSpace === 'nowrap'),
        )
        .map((node) => node.textContent),
    );
  expect(clipped, 'a subtitle clipped with an ellipsis hides its words from touch users').toEqual(
    [],
  );
});
