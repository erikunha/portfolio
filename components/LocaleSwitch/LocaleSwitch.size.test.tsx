import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleSwitch } from './LocaleSwitch';

const HREFS = { en: '/cv', pt: '/pt/cv' } as const;
const NAMES = { en: 'English', pt: 'Português' } as const;
const EXTRA_CLASSES = 'topbar-action';

function links(props: { size?: 'sm' | 'md' | 'lg'; buttonClassName?: string }) {
  render(<LocaleSwitch label="Language" current="en" hrefs={HREFS} names={NAMES} {...props} />);
  return within(screen.getByRole('navigation', { name: 'Language' })).getAllByRole('link');
}

describe('LocaleSwitch button styling hooks', () => {
  it('keeps the small size and no extra classes by default', () => {
    for (const link of links({})) {
      expect(link.getAttribute('data-size')).toBe('sm');
      expect(link.classList.contains('topbar-action')).toBe(false);
    }
  });

  it('renders each link at the requested size with the extra button classes', () => {
    for (const link of links({ size: 'md', buttonClassName: EXTRA_CLASSES })) {
      expect(link.getAttribute('data-size')).toBe('md');
      expect(link.classList.contains('topbar-action')).toBe(true);
      expect(link.getAttribute('data-variant')).toBe('secondary');
    }
  });

  it('shows the short code as text and keeps the full name as its own language span', () => {
    const [english, portuguese] = links({ size: 'md' });
    expect(english?.firstChild?.textContent).toBe('EN');
    expect(portuguese?.firstChild?.textContent).toBe('PT');
    expect(english?.querySelector('[lang="en"]')?.textContent).toContain('English');
    expect(portuguese?.querySelector('[lang="pt"]')?.textContent).toContain('Portugu');
  });
});
