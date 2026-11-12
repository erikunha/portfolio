import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleSwitch } from './LocaleSwitch';

const HREFS = { en: '/cv', pt: '/pt/cv' } as const;
const NAMES = { en: 'English', pt: 'Português' } as const;

function renderSwitch(current: 'en' | 'pt') {
  render(
    <LocaleSwitch
      label="Language"
      current={current}
      hrefs={HREFS}
      names={NAMES}
      data-lang-switch=""
      className="extra"
    />,
  );
  return within(screen.getByRole('navigation', { name: 'Language' })).getAllByRole('link');
}

describe('LocaleSwitch', () => {
  it.each([
    ['en', ['page', null]],
    ['pt', [null, 'page']],
  ] as const)('marks only the current locale (%s) with aria-current', (current, expected) => {
    const links = renderSwitch(current);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(expected);
  });

  it('links both locales with hreflang and the sr-only full name', () => {
    const links = renderSwitch('en');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/cv', '/pt/cv']);
    expect(links.map((link) => link.getAttribute('hreflang'))).toEqual(['en', 'pt']);
    expect(screen.getByRole('link', { name: /EN\s*English/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /PT\s*Portugu/ })).toBeTruthy();
  });

  it('renders design-system secondary buttons on the small size, which keeps the 44px target and steps down on a fine pointer; the active one is marked by its border and underline', () => {
    const links = renderSwitch('pt');
    expect(links[0]?.className).toContain('bg-transparent');
    expect(links[1]?.className).toContain('bg-transparent');
    for (const link of links) {
      expect(link.className).toContain('min-w-11');
      expect(link.className).toContain('min-h-11');
      expect(link.className).toContain('pointer-fine:min-h-[var(--spacing-target-pointer)]');
      expect(link.className).not.toContain('pointer-fine:min-w-');
    }
  });

  it('has no text separator and forwards nav attributes and className', () => {
    renderSwitch('en');
    const nav = screen.getByRole('navigation', { name: 'Language' });
    expect(nav.textContent).not.toContain('\u00b7');
    expect(nav.hasAttribute('data-lang-switch')).toBe(true);
    expect(nav.className).toContain('extra');
  });
});
