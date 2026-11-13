import { describe, expect, it } from 'vitest';
import {
  DOCK_HIRE_LABEL,
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
} from '@/content/nav';
import { SITE_LOCALE } from '@/content/site-locale';

const NON_WORD_SYMBOLS = /[_↗]/u;
const WORD_GAP = /\s+/u;
const PLAIN_NAME_PATTERN = /^[\p{L}\p{N}\s()]+$/u;

const EXPECTED_NAME_START = {
  [SITE_LOCALE.en]: 'Hire on LinkedIn',
  [SITE_LOCALE.pt]: 'Contrate no LinkedIn',
} as const;

const firstWord = (text: string) =>
  (text.split(WORD_GAP)[0] ?? '').replace(NON_WORD_SYMBOLS, '').toLowerCase();

describe.each(Object.values(SITE_LOCALE))(
  'hire accessible name uses plain words (%s)',
  (locale) => {
    const name = HIRE_ACCESSIBLE_NAME[locale];

    it('has no underscore and no arrow glyph for a screen reader to speak', () => {
      expect(name).not.toMatch(NON_WORD_SYMBOLS);
      expect(name).toMatch(PLAIN_NAME_PATTERN);
    });

    it('opens with the spoken form of the primary label and discloses the new tab', () => {
      expect(name.startsWith(EXPECTED_NAME_START[locale])).toBe(true);
      expect(name.endsWith(')')).toBe(true);
    });

    it.each([
      ['primary', NAV_VOCABULARY[locale].hire],
      ['topbar', HIRE_SHORT_LABEL[locale]],
      ['dock', DOCK_HIRE_LABEL[locale]],
    ])('starts with the first word of the visible %s label (WCAG 2.5.3)', (_surface, visible) => {
      const firstVisibleWord = firstWord(visible.replaceAll('_', ' '));
      expect(firstVisibleWord.length).toBeGreaterThan(0);
      expect(name.toLowerCase().startsWith(firstVisibleWord)).toBe(true);
    });
  },
);
