import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';
import { expectStableFor, heightOf, settleFrames } from './_helpers/geometry';
import { freezeMotion } from './_helpers/motion';
import { drainRoutes } from './_helpers/routes';

const WIDTHS = [320, 360, 390, 600, 768, 1024, 1280] as const;
const FEED_WIDTHS = [390, 768, 1280] as const;
const VIEWPORT_HEIGHT = 900;
const SUBPIXEL_PX = 1;
const PENDING_DATA = '#sec-live-metrics [aria-busy="true"]';
const PENDING_FEED = '[data-col="channel-loading"]';
const LOADING_COPY = /fetch|loading|load|buscando|carregando/i;
const HOME_PATHS = ['/', '/pt'] as const;
const LINKS_PATHS = ['/links', '/links/en'] as const;
const BOUNDARY_SWAP = /\$RC\("B:/g;
const BOUNDARY_HELD = 'void("B:';
const APP_SCRIPT = /\/_next\/static\/.*\.js/;

type Pair = { name: string; fallback: string[]; resolved: string[]; tolerance: number };

const HOME_PAIRS: Pair[] = [
  {
    name: 'Lighthouse block',
    fallback: ['#sec-live-perf'],
    resolved: ['#sec-live-perf'],
    tolerance: 0,
  },
  {
    name: 'mixer boot log',
    fallback: ['.daw-mixer-loading'],
    resolved: ['.guitar-mixer'],
    tolerance: 0.08,
  },
  {
    name: 'shell',
    fallback: ['.shell-loading'],
    resolved: ['.interactive-shell'],
    tolerance: 0.25,
  },
  {
    name: 'contact form',
    fallback: ['.contact-loading'],
    resolved: ['.contact-shell'],
    tolerance: 0.25,
  },
];
const FEED_PAIRS: Pair[] = [
  {
    name: 'feed columns',
    fallback: ['[data-col="channel-loading"]', '[data-col="history-loading"]'],
    resolved: ['[data-col="channel"]', '[data-col="history"]'],
    tolerance: 0.25,
  },
];

async function holdBoundaries(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() === 'script' && APP_SCRIPT.test(request.url())) {
      await route.abort();
      return;
    }
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text()).replace(BOUNDARY_SWAP, BOUNDARY_HELD);
    await route.fulfill({ response, body });
  });
}

async function heights(page: Page, groups: string[][]) {
  return Promise.all(
    groups.map(async (selectors) => {
      const each = await Promise.all(selectors.map((selector) => heightOf(page, selector)));
      return each.reduce((sum, height) => sum + height, 0);
    }),
  );
}

async function measure(
  browser: Browser,
  baseURL: string | undefined,
  path: string,
  width: number,
  pairs: Pair[],
) {
  const options = {
    viewport: { width, height: VIEWPORT_HEIGHT },
    ...(baseURL ? { baseURL } : {}),
  };

  const held = await browser.newContext(options);
  await freezeMotion(held);
  await holdBoundaries(held);
  const heldPage = await held.newPage();
  await heldPage.goto(path);
  const fallback = await heights(
    heldPage,
    pairs.map((pair) => pair.fallback),
  );
  await drainRoutes(held);
  await held.close();

  const live = await browser.newContext(options);
  await freezeMotion(live);
  const livePage = await live.newPage();
  await livePage.goto(path);
  await expect(livePage.locator(PENDING_DATA)).toHaveCount(0);
  await expect(livePage.locator(PENDING_FEED)).toHaveCount(0);
  await expectStableFor(() =>
    heights(
      livePage,
      pairs.map((pair) => pair.resolved),
    ),
  );
  await settleFrames(livePage);
  const resolved = await heights(
    livePage,
    pairs.map((pair) => pair.resolved),
  );
  await live.close();

  return pairs.map((pair, index) => ({
    pair,
    fallback: fallback[index] ?? 0,
    resolved: resolved[index] ?? 0,
  }));
}

function expectReserved(measured: Awaited<ReturnType<typeof measure>>, where: string): void {
  for (const { pair, fallback, resolved } of measured) {
    const gap = Math.abs(resolved - fallback);
    const limit = pair.tolerance === 0 ? SUBPIXEL_PX : resolved * pair.tolerance;
    expect
      .soft(gap, `${where} ${pair.name}: loading ${fallback}, resolved ${resolved}`)
      .toBeLessThan(limit);
  }
}

test.describe('a loading fallback reserves the height of what replaces it', () => {
  test.setTimeout(120_000);

  for (const path of HOME_PATHS) {
    for (const width of WIDTHS) {
      test(`${path} at ${width}px: Lighthouse block, mixer, shell and contact form hold their final room`, async ({
        browser,
        baseURL,
      }) => {
        expectReserved(
          await measure(browser, baseURL, path, width, HOME_PAIRS),
          `${path} ${width}px`,
        );
      });
    }
  }

  for (const path of LINKS_PATHS) {
    for (const width of FEED_WIDTHS) {
      test(`${path} at ${width}px: the feed skeleton is as tall as the channel card and history`, async ({
        browser,
        baseURL,
      }) => {
        expectReserved(
          await measure(browser, baseURL, path, width, FEED_PAIRS),
          `${path} ${width}px`,
        );
      });
    }
  }
});

async function visibleLoadingStatuses(page: Page) {
  return page.locator('[role="status"]:visible', { hasText: LOADING_COPY }).count();
}

test.describe('without JavaScript a loading state is not left running', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of [...HOME_PATHS, ...LINKS_PATHS]) {
    test(`${path} shows no status that says it is still loading`, async ({ page }) => {
      await page.goto(path);
      expect(
        await visibleLoadingStatuses(page),
        'a streamed section never resolves without a script, so its loading line must not be shown or announced',
      ).toBe(0);
    });
  }

  test('the island placeholders leave the accessibility tree', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status', { name: 'Loading interactive shell' })).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Loading contact form' })).toHaveCount(0);
  });

  test('the mixer boot box gives its reserved height back', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    const box = await heightOf(page, '.daw-mixer-loading');
    expect(box, 'nothing replaces the box, so it takes only its own lines').toBeLessThan(
      VIEWPORT_HEIGHT / 2,
    );
  });
});
