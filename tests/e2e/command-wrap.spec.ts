import { expect, type Page, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/', '/pt'];
const WIDTHS = [320, 360, 390];
const VIEWPORT_HEIGHT = 844;
const COMMANDS = '.career-command, .career-header-command-mobile';

function splitFlags(page: Page): Promise<string[]> {
  return page.locator(COMMANDS).evaluateAll((nodes) => {
    const split: string[] = [];
    const range = document.createRange();
    for (const node of nodes) {
      if (node.getClientRects().length === 0) continue;
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const data = (text as Text).data;
        for (const flag of data.matchAll(/--?[A-Za-z][\w-]*/g)) {
          const first = flag.index ?? 0;
          const last = first + flag[0].length - 1;
          range.setStart(text, first);
          range.setEnd(text, first + 1);
          const top = Math.round(range.getBoundingClientRect().top);
          range.setStart(text, last);
          range.setEnd(text, last + 1);
          if (Math.round(range.getBoundingClientRect().top) !== top) split.push(flag[0]);
        }
      }
    }
    return split;
  });
}

for (const path of ROUTES) {
  for (const width of WIDTHS) {
    test(`${path} git log command never wraps inside a flag at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await gotoSettled(page, path);
      expect(
        await splitFlags(page),
        'a line break after the dashes leaves "--" alone on one line and the flag name on the next',
      ).toEqual([]);
    });
  }
}
