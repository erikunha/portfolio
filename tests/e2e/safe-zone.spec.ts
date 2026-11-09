import { expect, type Page, test } from '@playwright/test';
import { waitForHydration } from './_helpers/hydration';
import { gotoSettled } from './_helpers/streamed';

const WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920];
const VIEWPORT_HEIGHT = 900;
const EDGE_TOLERANCE_PX = 1;
const BANNER_CONTROLS = 'a, button';
const PAGE_ZONE = '.page-container';
const FOOTER_ZONE = '.footer-inner';
const MAIN = 'main#main-content';

const ROUTES = [
  '/',
  '/pt',
  '/cv',
  '/pt/cv',
  '/summary',
  '/pt/summary',
  '/links/en',
  '/links',
  '/design-system',
  '/design-system/tokens',
  '/this-route-does-not-exist',
  '/pt/rota-que-nao-existe',
];

type Edges = { left: number; right: number };

function headerEdges(page: Page): Promise<Edges> {
  return page
    .getByRole('banner')
    .locator(BANNER_CONTROLS)
    .evaluateAll((nodes) => {
      const boxes = nodes
        .map((node) => node.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0);
      return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
      };
    });
}

function contentBoxEdges(
  page: Page,
  selector: string,
  symmetricInset: boolean,
): Promise<Edges | null> {
  return page.locator(selector).evaluateAll((nodes, symmetric) => {
    const node = nodes.find((candidate) => candidate.getClientRects().length > 0);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const inlineStart = Number.parseFloat(style.paddingLeft);
    const inlineEnd = symmetric ? inlineStart : Number.parseFloat(style.paddingRight);
    return { left: box.left + inlineStart, right: box.right - inlineEnd };
  }, symmetricInset);
}

function renderedContentEdges(page: Page): Promise<Edges> {
  return page.locator(PAGE_ZONE).evaluate((zone) => {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const node of zone.querySelectorAll('*')) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed' || style.position === 'absolute') continue;
      if (style.display === 'none' || style.display === 'contents') continue;
      if (node.closest('canvas, svg, [aria-hidden="true"], [hidden]')) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      let visibleLeft = box.left;
      let visibleRight = box.right;
      for (let clip = node.parentElement; clip; clip = clip.parentElement) {
        if (getComputedStyle(clip).overflowX === 'visible') continue;
        const clipBox = clip.getBoundingClientRect();
        visibleLeft = Math.max(visibleLeft, clipBox.left);
        visibleRight = Math.min(visibleRight, clipBox.right);
      }
      if (visibleRight <= visibleLeft) continue;
      left = Math.min(left, visibleLeft);
      right = Math.max(right, visibleRight);
    }
    return { left, right };
  });
}

test.describe('every page content sits on the header safe zone', () => {
  for (const route of ROUTES) {
    test(`${route} shares the header content edges at every width`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[0] ?? 320, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, route);
      await waitForHydration(page, MAIN);
      const failures: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        );
        const header = await headerEdges(page);
        const zone = await contentBoxEdges(page, PAGE_ZONE, false);
        const rendered = await renderedContentEdges(page);
        const footer = await contentBoxEdges(page, FOOTER_ZONE, true);
        const record = (label: string, edges: Edges | null) => {
          if (!edges) {
            failures.push(`${width}: ${label} renders no box`);
            return;
          }
          const dl = edges.left - header.left;
          const dr = edges.right - header.right;
          const bad = Math.abs(dl) > EDGE_TOLERANCE_PX || Math.abs(dr) > EDGE_TOLERANCE_PX;
          if (bad) failures.push(`${width}: ${label} left ${dl.toFixed(1)} right ${dr.toFixed(1)}`);
        };
        record('page container', zone);
        record('rendered content', rendered);
        if (footer) record('footer', footer);
      }
      expect(failures, 'content edges against the header content edges').toEqual([]);
    });
  }
});

const READING_ROUTES = ['/cv', '/pt/cv', '/summary', '/pt/summary'];
const TWO_COLUMN_FROM_PX = 1024;
const GOLDEN_RATIO = 1.618;
const RATIO_TOLERANCE = 0.1;
const FLOW_BLOCKS = '.reading-doc > *, .reading-main > *, .reading-split > :not(.reading-side)';
const ASIDE = '.reading-side';

type Box = { left: number; right: number; width: number };

function visibleBoxes(page: Page, selector: string): Promise<Box[]> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      }),
  );
}

test.describe('reading pages start every block on the left edge and fill the zone with the aside', () => {
  for (const route of READING_ROUTES) {
    test(`${route} keeps blocks on the safe-zone left edge, the aside on the right`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: WIDTHS[0] ?? 320, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, route);
      const failures: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        const zone = await contentBoxEdges(page, PAGE_ZONE, false);
        if (!zone) throw new Error('the page container renders no box');
        for (const box of await visibleBoxes(page, FLOW_BLOCKS)) {
          if (Math.abs(box.left - zone.left) > EDGE_TOLERANCE_PX) {
            failures.push(
              `${width}: a block starts ${(box.left - zone.left).toFixed(1)} off the left edge`,
            );
          }
        }
        const [aside] = await visibleBoxes(page, ASIDE);
        const [main] = await visibleBoxes(page, '.reading-main, .reading-split > section');
        if (!aside || !main) {
          failures.push(`${width}: the page has no main and aside columns`);
          continue;
        }
        if (Math.abs(aside.right - zone.right) > EDGE_TOLERANCE_PX) {
          failures.push(
            `${width}: the aside ends ${(aside.right - zone.right).toFixed(1)} off the right edge`,
          );
        }
        if (width >= TWO_COLUMN_FROM_PX) {
          if (aside.left <= main.right)
            failures.push(`${width}: the aside is not beside the main column`);
          const ratio = main.width / aside.width;
          if (Math.abs(ratio - GOLDEN_RATIO) > RATIO_TOLERANCE) {
            failures.push(`${width}: main to aside ratio ${ratio.toFixed(2)}`);
          }
        } else if (Math.abs(aside.left - zone.left) > EDGE_TOLERANCE_PX) {
          failures.push(
            `${width}: the stacked aside starts ${(aside.left - zone.left).toFixed(1)} off the left edge`,
          );
        }
      }
      expect(failures, 'reading layout against the safe zone').toEqual([]);
    });
  }
});
