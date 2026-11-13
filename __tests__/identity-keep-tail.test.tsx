import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CvPageEn from '@/app/(en)/cv/page';
import SummaryPageEn from '@/app/(en)/summary/page';
import CvPagePt from '@/app/(pt)/pt/cv/page';
import SummaryPagePt from '@/app/(pt)/pt/summary/page';
import { About } from '@/components/sections/About';
import { aboutContent } from '@/content/about';
import { SITE_LOCALE } from '@/content/site-locale';

const TAIL_WORDS = 2;
const SHORT_TAIL_MAX_CHARS = 8;
const PAGES = [
  { name: 'cv', locale: SITE_LOCALE.en, page: CvPageEn },
  { name: 'cv', locale: SITE_LOCALE.pt, page: CvPagePt },
  { name: 'summary', locale: SITE_LOCALE.en, page: SummaryPageEn },
  { name: 'summary', locale: SITE_LOCALE.pt, page: SummaryPagePt },
] as const;

function parse(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'text/html');
}

describe('the role line of the reading views', () => {
  for (const { name, locale, page } of PAGES) {
    it(`${locale} ${name}: the last two words are one unbreakable unit`, () => {
      const role = parse(renderToStaticMarkup(page())).querySelector('.reading-role');
      const tail = role?.querySelector('.keep-together');
      const words = (role?.textContent ?? '').split(' ');
      expect(tail?.textContent).toBe(words.slice(-TAIL_WORDS).join(' '));
    });
  }
});

describe('the About prose', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    it(`${locale}: every bullet keeps its last two words together`, () => {
      const prose = parse(renderToStaticMarkup(<About locale={locale} />));
      const lines = [...prose.querySelectorAll('.ab-prose p')];
      const written = aboutContent[locale].whoami.details;
      expect(lines.length).toBeGreaterThan(written.length);
      for (const line of lines) {
        const words = (line.textContent ?? '').split(' ');
        const last = words.at(-1) ?? '';
        const tail = line.querySelector('.keep-together');
        if (last.length > SHORT_TAIL_MAX_CHARS) {
          expect(tail, `"${line.textContent}" ends on a long word`).toBeNull();
          continue;
        }
        expect(tail, `"${line.textContent}" keeps a tail`).not.toBeNull();
        expect(line.textContent?.endsWith(tail?.textContent ?? '\u0000')).toBe(true);
      }
    });
  }
});
