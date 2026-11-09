import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { gotoHydrated, MENU_TRIGGER } from './_helpers/hydration';
import { drainRoutes } from './_helpers/routes';
import { gotoSettled, PENDING_STREAMED, selfHostedFaceStatuses } from './_helpers/streamed';

const BOUNDARY_SWAP = /\$RC\(("B:[^)]*)\)/g;
const HELD_SWAP = '(window.__heldSwaps=window.__heldSwaps||[]).push(()=>$RC($1))';
const HELD_FRAMES = 30;

test.describe('settling the streamed boundaries', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = (await response.text()).replace(BOUNDARY_SWAP, HELD_SWAP);
      await route.fulfill({ response, body });
    });
  });

  test.afterEach(({ context }) => drainRoutes(context));

  test('gotoSettled stays pending until every held boundary swaps in', async ({ page }) => {
    let settled = false;
    const navigation = gotoSettled(page, '/').then(() => {
      settled = true;
    });

    await expect(
      page.locator(PENDING_STREAMED),
      'the held swap must leave a fallback in the DOM, or this test proves nothing',
    ).not.toHaveCount(0);
    await settleFrames(page, HELD_FRAMES);
    expect(settled, 'gotoSettled returned while a fallback was still in the DOM').toBe(false);

    await page.evaluate(() => {
      for (const swap of (window as unknown as { __heldSwaps: Array<() => void> }).__heldSwaps) {
        swap();
      }
    });
    await navigation;

    expect(settled).toBe(true);
    await expect(page.locator(PENDING_STREAMED)).toHaveCount(0);
    await expect(page.locator('.measured-heading').first()).toBeAttached();
  });
});

const SETTLE_BUDGET_MS = 5_000;
const LOW_PRIORITY_SCRIPT = /<link rel="preload" as="script" fetchPriority="low" href="([^"]+)"/;

async function stallUntilReleased(context: BrowserContext, pattern: string): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(pattern, async (route) => {
    await released;
    await route.abort();
  });
  return release;
}

test.describe('settling while a subresource never answers', () => {
  let release: () => void = () => undefined;

  test.afterEach(async ({ context }) => {
    release();
    await drainRoutes(context);
  });

  async function settleWithinBudget(page: Page): Promise<void> {
    const started = Date.now();
    await gotoSettled(page, '/');
    expect(
      Date.now() - started,
      'gotoSettled waited on a subresource the measurement does not need',
    ).toBeLessThan(SETTLE_BUDGET_MS);
    await expect(page.locator(PENDING_STREAMED)).toHaveCount(0);
    const box = await page.locator('#main-content').boundingBox();
    expect(box, 'the page must be laid out and measurable').not.toBeNull();
    const statuses = await selfHostedFaceStatuses(page);
    expect(statuses.length, 'the page must declare self-hosted font faces').toBeGreaterThan(0);
    expect(
      statuses.every((status) => status === 'loaded'),
      `every self-hosted font face must be loaded when the page is measured, got ${statuses}`,
    ).toBe(true);
  }

  test('a manifest that never answers does not hold the navigation', async ({ context, page }) => {
    release = await stallUntilReleased(context, '**/site.webmanifest');

    await settleWithinBudget(page);
  });

  test('a low-priority script chunk that never answers does not hold the navigation', async ({
    context,
    page,
    request,
  }) => {
    const html = await (await request.get('/')).text();
    const href = LOW_PRIORITY_SCRIPT.exec(html)?.[1];
    expect(href, 'the document must preload a low-priority script chunk').toBeDefined();
    release = await stallUntilReleased(context, `**${href}`);

    await settleWithinBudget(page);
  });
});

const SCRIPT_CHUNK_DELAY_MS = 3_000;
const SCRIPT_CHUNK_PATH = '/_next/static/chunks/';

test.describe('interacting while the script chunks arrive late', () => {
  let delayedChunks = 0;

  test.beforeEach(async ({ context }) => {
    delayedChunks = 0;
    await context.route(
      (url) => url.pathname.startsWith(SCRIPT_CHUNK_PATH) && url.pathname.endsWith('.js'),
      async (route) => {
        delayedChunks += 1;
        await new Promise((resolve) => setTimeout(resolve, SCRIPT_CHUNK_DELAY_MS));
        await route.continue();
      },
    );
  });

  test.afterEach(({ context }) => drainRoutes(context));

  test('the section menu opens on the first click once the trigger has hydrated', async ({
    page,
  }) => {
    await gotoHydrated(page, '/', MENU_TRIGGER);
    const trigger = page
      .getByRole('button', { name: 'Open menu', exact: true })
      .locator('visible=true');
    await trigger.click();

    await expect(
      page.locator('#section-drawer'),
      'a click before React attaches its handlers is lost: the interaction must wait for hydration',
    ).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      delayedChunks,
      'the delay must have held script requests, or this test proves nothing',
    ).toBeGreaterThan(0);
  });
});
