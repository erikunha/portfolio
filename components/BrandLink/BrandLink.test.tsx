import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brand } from '@/content/brand';
import { BrandLink } from './BrandLink';

describe('BrandLink', () => {
  it('is a link home named from content, with no visible text', () => {
    render(<BrandLink />);
    const link = screen.getByRole('link', { name: brand.accessibleName });
    expect(link.getAttribute('href')).toBe(brand.homeHref);
    expect(link.textContent).toBe('');
  });

  it('hides the icon from assistive technology', () => {
    const { container } = render(<BrandLink />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
