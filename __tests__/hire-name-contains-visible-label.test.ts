import { describe, expect, it } from 'vitest';
import {
  DOCK_HIRE_LABEL,
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
} from '@/content/nav';
import { SITE_LOCALE } from '@/content/site-locale';

const PUNCTUATION_OR_SYMBOL = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE_RUN = /\s+/g;
const SINGLE_SPACE = ' ';

function withoutPunctuation(text: string): string {
  return text
    .normalize('NFKD')
    .replace(PUNCTUATION_OR_SYMBOL, '')
    .replace(WHITESPACE_RUN, SINGLE_SPACE)
    .trim()
    .toLowerCase();
}

describe.each(Object.values(SITE_LOCALE))(
  'hire accessible name holds the visible label character for character (%s)',
  (locale) => {
    const visibleLabels = {
      primary: NAV_VOCABULARY[locale].hire,
      topbar: HIRE_SHORT_LABEL[locale],
      dock: DOCK_HIRE_LABEL[locale],
      rail: NAV_VOCABULARY[locale].linkedin,
    };

    it.each(Object.entries(visibleLabels))(
      'the %s label survives a checker that drops punctuation without a word gap',
      (surface, visible) => {
        expect(
          withoutPunctuation(HIRE_ACCESSIBLE_NAME[locale]),
          `the ${surface} label "${visible}" must sit inside the name once punctuation is removed`,
        ).toContain(withoutPunctuation(visible));
      },
    );

    it('opens with the exact visible primary label', () => {
      expect(HIRE_ACCESSIBLE_NAME[locale].startsWith(visibleLabels.primary)).toBe(true);
    });
  },
);
