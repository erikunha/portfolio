import { describe, expect, it } from 'vitest';
import {
  DOCK_HIRE_LABEL,
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
} from '@/content/nav';
import { SITE_LOCALE } from '@/content/site-locale';

const ARROW_GLYPH = '↗';
const WORD_JOINER = '_';
const WORD_GAP = ' ';

function spokenWords(text: string): string {
  return text.replace(ARROW_GLYPH, '').replaceAll(WORD_JOINER, WORD_GAP).trim().toLowerCase();
}

describe.each(Object.values(SITE_LOCALE))('hire action label in name (%s)', (locale) => {
  const visibleLabels = {
    primary: NAV_VOCABULARY[locale].hire,
    topbar: HIRE_SHORT_LABEL[locale],
    dock: DOCK_HIRE_LABEL[locale],
    rail: NAV_VOCABULARY[locale].linkedin,
  };

  it.each(Object.entries(visibleLabels))(
    'the accessible name contains the visible %s label as spoken words (WCAG 2.5.3)',
    (surface, visible) => {
      expect(
        spokenWords(HIRE_ACCESSIBLE_NAME[locale]),
        `voice control says what it reads on the ${surface} surface: "${spokenWords(visible)}"`,
      ).toContain(spokenWords(visible));
    },
  );

  it('opens with the visible words so a voice command and the spoken name agree', () => {
    expect(
      spokenWords(HIRE_ACCESSIBLE_NAME[locale]).startsWith(spokenWords(visibleLabels.primary)),
    ).toBe(true);
  });
});
