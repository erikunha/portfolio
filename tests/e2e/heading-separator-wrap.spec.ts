import { SITE_LOCALE, type SiteLocale } from '../../content/site-locale';
import { WIDTH } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';
import { expect, type Page, test } from './_helpers/test';

const CASES: { path: string; locale: SiteLocale }[] = [
  { path: '/cv', locale: SITE_LOCALE.en },
  { path: '/pt/cv', locale: SITE_LOCALE.pt },
];
const VIEWPORTS = [
  { width: WIDTH.PHONE_NARROW, height: 800 },
  { width: WIDTH.PHONE, height: 844 },
];
const TITLE_SELECTOR = '[aria-labelledby="cv-community"] .reading-entry h3';
const SEPARATOR = '·';

function lineStarts(page: Page): Promise<string[]> {
  return page.locator(TITLE_SELECTOR).evaluate((title) => {
    const range = document.createRange();
    const firstOnLine = new Map<number, string>();
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      if (text.parentElement?.closest('.sr-only')) continue;
      for (let at = 0; at < text.data.length; at += 1) {
        if (/\s/u.test(text.data.charAt(at))) continue;
        range.setStart(text, at);
        range.setEnd(text, at + 1);
        const rect = [...range.getClientRects()].find((box) => box.width > 0);
        if (!rect) continue;
        const top = Math.round(rect.top);
        if (!firstOnLine.has(top)) firstOnLine.set(top, text.data.charAt(at));
      }
    }
    return [...firstOnLine.entries()].sort(([a], [b]) => a - b).map(([, char]) => char);
  });
}

for (const { path } of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${path} at ${viewport.width}: no line of the community title starts with the separator`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, path);
      const starts = await lineStarts(page);
      expect(starts.length).toBeGreaterThan(1);
      expect(starts).not.toContain(SEPARATOR);
    });
  }
}
