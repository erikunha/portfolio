import { expect, type Page, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/', '/pt'];
const WIDTHS = [320, 375, 390, 768, 1024, 1280];
const VIEWPORT_HEIGHT = 900;
const LOCATION_SELECTOR = '.career-location';
const PERIOD_SELECTOR = '.career-period';
const MODE_START = ' (';

function splitUnits(page: Page): Promise<string[]> {
  return page.locator('.career-head').evaluateAll(
    (heads, selectors) => {
      const split: string[] = [];
      const range = document.createRange();
      const unitSplits = (root: Element, from: number, to: number): boolean => {
        const nodes: Text[] = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
        const locate = (offset: number) => {
          let rest = offset;
          for (const node of nodes) {
            if (rest < node.data.length) return { node, rest };
            rest -= node.data.length;
          }
          const last = nodes[nodes.length - 1] as Text;
          return { node: last, rest: last.data.length - 1 };
        };
        const top = (offset: number) => {
          const { node, rest } = locate(offset);
          range.setStart(node, rest);
          range.setEnd(node, rest + 1);
          return Math.round(range.getBoundingClientRect().top);
        };
        return top(from) !== top(to);
      };
      for (const head of heads) {
        const location = head.querySelector(selectors.location);
        const period = head.querySelector(selectors.period);
        if (location?.textContent) {
          const text = location.textContent;
          const modeAt = text.indexOf(selectors.modeStart);
          const placeEnd = modeAt === -1 ? text.length : modeAt;
          if (unitSplits(location, 0, placeEnd - 1)) split.push(text.slice(0, placeEnd));
          if (modeAt !== -1 && unitSplits(location, modeAt + 1, text.length - 1)) {
            split.push(text.slice(modeAt + 1));
          }
        }
        if (period?.textContent && unitSplits(period, 0, period.textContent.length - 1)) {
          split.push(period.textContent);
        }
      }
      return split;
    },
    { location: LOCATION_SELECTOR, period: PERIOD_SELECTOR, modeStart: MODE_START },
  );
}

for (const path of ROUTES) {
  for (const width of WIDTHS) {
    test(`${path} career place, work mode and dates never wrap inside a unit at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, path);
      await expect(page.locator(LOCATION_SELECTOR).first()).toBeVisible();
      expect(
        await splitUnits(page),
        'a place, a work mode or a date range stays on one line; lines break between units',
      ).toEqual([]);
    });
  }
}
