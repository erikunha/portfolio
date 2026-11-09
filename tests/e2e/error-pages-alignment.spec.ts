import { expect, type Page, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const ROUTES = ['/this-route-does-not-exist', '/pt/rota-que-nao-existe'];
const WIDTHS = [320, 390, 768, 1280];
const VIEWPORT_HEIGHT = 900;
const EDGE_TOLERANCE_PX = 1;
const TARGET_PROBE = 'var(--spacing-target)';

type Lefts = { zone: number; heading: number; label: number; links: number[]; action: number };

function readLefts(page: Page): Promise<Lefts> {
  return page.evaluate(() => {
    const need = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`missing ${selector}`);
      return node;
    };
    const textLeft = (node: Element) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    };
    return {
      zone: need('main .terminal-panel').getBoundingClientRect().left,
      heading: textLeft(need('main h1')),
      label: textLeft(need('.err-label')),
      links: [...document.querySelectorAll('.err-suggest a')].map(textLeft),
      action: need('.err-actions a').getBoundingClientRect().left,
    };
  });
}

for (const path of ROUTES) {
  for (const width of WIDTHS) {
    test.describe(`${path} at ${width}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await gotoSettled(page, path);
      });

      test('every block starts on the safe zone edge, one alignment', async ({ page }) => {
        const lefts = await readLefts(page);
        const named: [string, number][] = [
          ['404 heading', lefts.heading],
          ['suggestions label', lefts.label],
          ['home action', lefts.action],
          ...lefts.links.map((left, index): [string, number] => [`suggestion ${index}`, left]),
        ];
        expect(lefts.links.length, 'the page offers suggestions').toBeGreaterThan(0);
        for (const [name, left] of named) {
          expect(
            Math.abs(left - lefts.zone),
            `${name} starts ${left}px, the terminal panel and safe zone start ${lefts.zone}px`,
          ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
        }
      });

      test('every link and the action are at least one touch target tall and wide', async ({
        page,
      }) => {
        const boxes = await page.evaluate((probe) => {
          const reference = document.createElement('div');
          reference.style.cssText = `position:absolute;width:${probe};height:${probe}`;
          document.body.append(reference);
          const target = reference.getBoundingClientRect().width;
          reference.remove();
          const controls = [...document.querySelectorAll('.err-suggest a, .err-actions a')].map(
            (control) => {
              const box = control.getBoundingClientRect();
              return {
                name: control.textContent?.trim() ?? '',
                width: box.width,
                height: box.height,
              };
            },
          );
          return { target, controls };
        }, TARGET_PROBE);
        expect(boxes.target).toBeGreaterThan(0);
        for (const control of boxes.controls) {
          expect(control.height, `${control.name} height`).toBeGreaterThanOrEqual(boxes.target);
          expect(control.width, `${control.name} width`).toBeGreaterThanOrEqual(boxes.target);
        }
      });
    });
  }
}
