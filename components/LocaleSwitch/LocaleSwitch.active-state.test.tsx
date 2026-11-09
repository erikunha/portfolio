import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleSwitch } from './LocaleSwitch';

const HREFS = { en: '/cv', pt: '/pt/cv' } as const;
const NAMES = { en: 'English', pt: 'Português' } as const;

function links(current: 'en' | 'pt') {
  render(<LocaleSwitch label="Language" current={current} hrefs={HREFS} names={NAMES} />);
  return within(screen.getByRole('navigation', { name: 'Language' })).getAllByRole('link');
}

describe('LocaleSwitch active state', () => {
  it.each([
    ['en', 0],
    ['pt', 1],
  ] as const)(
    'the active %s link is an outlined, underlined control and never the solid CTA fill',
    (current, activeIndex) => {
      const all = links(current);
      const active = all[activeIndex];
      expect(active?.getAttribute('aria-current')).toBe('page');
      expect(active?.getAttribute('data-variant'), 'the solid fill belongs to the HIRE CTA').toBe(
        'secondary',
      );
      expect(active?.className).not.toContain('bg-primary-500');
      expect(active?.className, 'the active locale needs a mark beyond the border').toContain(
        'underline',
      );
      expect(active?.className).toContain('border-primary-500');
    },
  );

  it('the inactive link keeps the quiet border and no underline mark', () => {
    const inactive = links('en')[1];
    expect(inactive?.hasAttribute('aria-current')).toBe(false);
    expect(inactive?.className).toContain('border-primary-subtle');
    expect(inactive?.className).not.toMatch(/(^|\s)underline(\s|$)/);
  });
});
