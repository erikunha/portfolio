import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brandByLocale } from '@/content/brand';
import { SITE_LOCALE } from '@/content/site-locale';
import { BrandLink } from './BrandLink';

describe('BrandLink', () => {
  it('is a link home named from content, with no visible text', () => {
    render(<BrandLink locale={SITE_LOCALE.en} />);
    const brand = brandByLocale[SITE_LOCALE.en];
    const link = screen.getByRole('link', { name: brand.accessibleName });
    expect(link.getAttribute('href')).toBe(brand.homeHref);
    expect(link.textContent).toBe('');
  });

  it('is named in Portuguese on a Portuguese page', () => {
    render(<BrandLink locale={SITE_LOCALE.pt} />);
    expect(screen.getByRole('link', { name: 'erikunha.dev, início' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'erikunha.dev, home' })).toBeNull();
  });

  it('hides the icon from assistive technology', () => {
    const { container } = render(<BrandLink locale={SITE_LOCALE.en} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
