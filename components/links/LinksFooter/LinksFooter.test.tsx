import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { linksContent } from '@/content/links';
import { LinksFooter } from './LinksFooter';

describe('LinksFooter', () => {
  it('links the portfolio with the footer campaign tag', () => {
    const { container } = render(<LinksFooter />);
    const link = container.querySelector('a');
    const href = new URL(link?.getAttribute('href') ?? '');
    expect(href.searchParams.get('utm_content')).toBe('portfolio-footer');
    expect(link?.getAttribute('data-outbound')).toBe('portfolio-footer');
  });

  it('hides the arrow glyph from screen readers so the link reads as its label', () => {
    const { container } = render(<LinksFooter />);
    const link = container.querySelector('a');
    const arrow = link?.querySelector('[aria-hidden="true"]');
    expect(arrow?.textContent).toBe('→');
    expect(link?.textContent?.replace('→', '').trim()).toBe(linksContent.siteLabel);
  });

  it('holds no social pills: they sit under the identity', () => {
    const { container } = render(<LinksFooter />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.querySelector('button')).toBeNull();
  });
});
