import { expect, test } from '@playwright/test';
import { gotoSettled } from './_helpers/streamed';

const VIEWPORT_HEIGHT = 844;
const WIDTHS = [320, 390, 768, 1280];
const SECTION_SELECTOR = 'main > section[id^="sec-"]';

for (const width of WIDTHS) {
  test(`sections read top to bottom in DOM order at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await gotoSettled(page, '/');
    const { dom, visual } = await page.evaluate((selector) => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
      return {
        dom: sections.map((el) => el.id),
        visual: [...sections].sort((a, b) => top(a) - top(b)).map((el) => el.id),
      };
    }, SECTION_SELECTOR);
    expect(dom.length, 'the home page renders its top-level sections').toBeGreaterThan(0);
    expect(
      visual,
      'WCAG 2.4.3: a CSS order that differs from the DOM makes keyboard and screen reader order contradict the visual order',
    ).toEqual(dom);
  });
}
