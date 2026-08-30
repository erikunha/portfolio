import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { LinksFooter } from './LinksFooter';

const PAGE_URL = 'https://www.erikunha.dev/links';

function links(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a'));
}

function byLabel(container: HTMLElement, label: RegExp): HTMLAnchorElement | undefined {
  return links(container).find((link) => label.test(link.textContent ?? ''));
}

describe('LinksFooter', () => {
  it('tags every outbound pill with the bio campaign so clicks are attributable', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const portfolio = byLabel(container, /portfólio/i);
    expect(portfolio).toBeDefined();

    const href = new URL(portfolio?.getAttribute('href') ?? '');
    expect(href.searchParams.get('utm_source')).toBe('bio');
    expect(href.searchParams.get('utm_content')).toBe('portfolio');
  });

  it('leaves the mailto pill untagged — utm on a mailto is a broken address', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const email = byLabel(container, /e-mail/i);
    expect(email?.getAttribute('href')).toMatch(/^mailto:[^?]+$/);
  });

  it('omits a pill that has no confirmed destination rather than linking nowhere', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    expect(byLabel(container, /instagram/i)).toBeUndefined();
  });

  it('renders a pill as soon as its destination is confirmed', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const tiktok = byLabel(container, /tiktok/i);
    expect(tiktok?.getAttribute('href')).toContain('tiktok.com/@oeriknagringa');
    expect(new URL(tiktok?.getAttribute('href') ?? '').searchParams.get('utm_content')).toBe(
      'tiktok',
    );
  });

  it('opens external pills in a new tab without leaking the opener', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    const github = byLabel(container, /github/i);
    expect(github?.getAttribute('target')).toBe('_blank');
    expect(github?.getAttribute('rel')).toContain('noopener');
  });

  it('renders the English labels on the English route', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.en} url={`${PAGE_URL}/en`} />);
    expect(byLabel(container, /^\s*Portfolio\s*$/)).toBeDefined();
  });

  it('offers the copy-link control alongside the pills', () => {
    const { container } = render(<LinksFooter locale={LINKS_LOCALE.pt} url={PAGE_URL} />);
    expect(container.querySelector('button')).not.toBeNull();
  });
});
