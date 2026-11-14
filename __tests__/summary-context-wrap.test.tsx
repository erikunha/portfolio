import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SummaryPageEn from '@/app/(en)/summary/page';
import SummaryPagePt from '@/app/(pt)/pt/summary/page';
import { summaryDocument } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';

const NO_BREAK_SPACE = ' ';
const PAGES = [
  { locale: SITE_LOCALE.en, page: SummaryPageEn },
  { locale: SITE_LOCALE.pt, page: SummaryPagePt },
] as const;

function contextLine(markup: string): string {
  const host = document.createElement('div');
  host.innerHTML = markup;
  const company = host.querySelector('.reading-meta .company-link');
  const line = company?.closest('.reading-meta')?.textContent;
  if (!line) throw new Error('the summary renders no context line');
  return line;
}

describe('the summary context line', () => {
  for (const { locale, page } of PAGES) {
    it(`${locale}: keeps the last two words together so a number never sits apart from its unit`, () => {
      const written = summaryDocument[locale].context;
      const lastWord = written.slice(written.lastIndexOf(' ') + 1);
      const line = contextLine(renderToStaticMarkup(page()));

      expect(line.endsWith(lastWord)).toBe(true);
      expect(line.at(-(lastWord.length + 1))).toBe(NO_BREAK_SPACE);
    });
  }
});
