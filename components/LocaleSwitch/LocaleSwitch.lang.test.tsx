import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_SWITCH_NAME, SITE_LOCALE } from '@/content/site-locale';
import { LocaleSwitch } from './LocaleSwitch';

const HREFS = { en: '/cv', pt: '/pt/cv' } as const;

describe('LocaleSwitch language names (WCAG 3.1.2)', () => {
  it.each(Object.values(SITE_LOCALE))(
    'marks each spoken language name with its own language on the %s page',
    (current) => {
      render(
        <LocaleSwitch
          label="Language"
          current={current}
          hrefs={HREFS}
          names={LANGUAGE_SWITCH_NAME}
        />,
      );
      const links = within(screen.getByRole('navigation', { name: 'Language' })).getAllByRole(
        'link',
      );
      for (const link of links) {
        const candidate = link.getAttribute('hreflang') as keyof typeof LANGUAGE_SWITCH_NAME;
        const name = link.querySelector('.sr-only');
        expect(name?.textContent).toContain(LANGUAGE_SWITCH_NAME[candidate]);
        expect(
          name?.getAttribute('lang'),
          `a screen reader would read "${LANGUAGE_SWITCH_NAME[candidate]}" with the page voice instead of the ${candidate} voice`,
        ).toBe(candidate);
      }
    },
  );
});
