import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { IdentityCard } from './IdentityCard';

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: this IS the jsdom stand-in for next/image, so there is no image pipeline to prefer and no LCP to guard.
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

describe('IdentityCard', () => {
  it('shows a photograph rather than typeset initials', () => {
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    const img = container.querySelector('.links-avatar img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('avatar');
    expect(
      container.textContent,
      'the initials were a stand-in for the photo; leaving both renders the monogram on top of the face',
    ).not.toMatch(/\bEC\b/);
  });

  it('keeps the photo out of the accessibility tree, because the name sits beside it', () => {
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    expect(container.querySelector('.links-avatar img')?.getAttribute('alt')).toBe('');
  });

  it('renders the name and the three identity rows', () => {
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    expect(container.textContent).toContain('Erik Cunha');
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
  });

  it('localises the rows that carry both languages', () => {
    const pt = render(<IdentityCard locale={LINKS_LOCALE.pt} />).container.textContent;
    const en = render(<IdentityCard locale={LINKS_LOCALE.en} />).container.textContent;
    expect(pt).toContain('remoto');
    expect(en).toContain('remote');
    expect(pt).not.toBe(en);
  });

  it('puts the full first tagline in the server HTML, so typing is only an enhancement', () => {
    const html = renderToString(<IdentityCard locale={LINKS_LOCALE.en} />);
    expect(html).toContain('Senior Software Engineer, Frontend &amp; Product');
    const pt = renderToString(<IdentityCard locale={LINKS_LOCALE.pt} />);
    expect(pt).toContain('Engenheiro de Software Sênior, Frontend e Produto');
  });

  it('shows the first tagline at once when reduced motion is preferred', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.en} />);
    vi.advanceTimersByTime(5_000);
    const typed = container.querySelector('.tagline-live [aria-hidden="true"]:not(.boot-cursor)');
    expect(typed?.textContent).toBe('Senior Software Engineer, Frontend & Product');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('reserves the tallest tagline with hidden sizers so cycling never shifts layout', async () => {
    const { profile } = (await import('@/content/links')).linksContent;
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    const sizers = [...container.querySelectorAll('.tagline-sizer')];
    expect(sizers.map((el) => el.textContent)).toEqual([...profile.taglines[LINKS_LOCALE.pt]]);
    for (const el of sizers) expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
