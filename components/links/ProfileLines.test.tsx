import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { ProfileLines } from './ProfileLines';

function links(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a'));
}

function byLabel(container: HTMLElement, label: RegExp): HTMLAnchorElement | undefined {
  return links(container).find((link) => label.test(link.textContent ?? ''));
}

describe('ProfileLines', () => {
  it('is a labelled section with its own heading', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    const section = container.querySelector('section[data-col="profiles"]');
    expect(section).not.toBeNull();
    const heading = section?.querySelector('h2');
    expect(heading?.textContent).toBe('perfis');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('names the section in the page language', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.en} />);
    expect(container.querySelector('h2')?.textContent).toBe('profiles');
  });

  it('tags every outbound row with the bio campaign so clicks are attributable', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    const portfolio = byLabel(container, /portfólio/i);
    expect(portfolio).toBeDefined();

    const href = new URL(portfolio?.getAttribute('href') ?? '');
    expect(href.searchParams.get('utm_source')).toBe('bio');
    expect(href.searchParams.get('utm_content')).toBe('portfolio');
  });

  it('omits a profile that has no confirmed destination rather than linking nowhere', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    expect(byLabel(container, /instagram/i)).toBeUndefined();
  });

  it('renders a profile as soon as its destination is confirmed', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    const tiktok = byLabel(container, /tiktok/i);
    expect(tiktok?.getAttribute('href')).toContain('tiktok.com/@oeriknagringa');
    expect(new URL(tiktok?.getAttribute('href') ?? '').searchParams.get('utm_content')).toBe(
      'tiktok',
    );
  });

  it('keeps the e-mail out of the profiles: it belongs to the contact section', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    expect(byLabel(container, /e-mail/i)).toBeUndefined();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('shows the host of each destination at the right edge of its row, without the tracking query', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    const github = byLabel(container, /github/i);
    expect(github?.querySelector('.links-line-host')?.textContent).toBe('github.com/erikunha');
  });

  it('opens rows in a new tab without leaking the opener', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    const github = byLabel(container, /github/i);
    expect(github?.getAttribute('target')).toBe('_blank');
    expect(github?.getAttribute('rel')).toContain('noopener');
  });

  it('hides the glyph and the arrow from screen readers so a row reads as label, host and hint', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.en} />);
    const github = byLabel(container, /github/i);
    expect(github?.querySelector('.links-line-glyph')?.getAttribute('aria-hidden')).toBe('true');
    expect(github?.querySelector('.links-line-arrow')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the English labels on the English route', () => {
    const { container } = render(<ProfileLines locale={LINKS_LOCALE.en} />);
    expect(container.querySelector('.links-line-label')?.textContent).toBe('Portfolio');
  });

  it('announces that every row opens a new tab, in the page language', () => {
    const en = render(<ProfileLines locale={LINKS_LOCALE.en} />);
    expect(byLabel(en.container, /github/i)?.textContent).toMatch(/opens in a new tab/i);
    const pt = render(<ProfileLines locale={LINKS_LOCALE.pt} />);
    expect(byLabel(pt.container, /github/i)?.textContent).toMatch(/abre em uma nova guia/i);
  });
});
