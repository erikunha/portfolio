import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { profile, profileStack } from '@/content/profile';
import { IdentityCard } from './IdentityCard';

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

  it('renders the name and the two identity rows, host and stack', () => {
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    expect(container.textContent).toContain('Erik Cunha');
    expect([...container.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'host',
      'stack',
    ]);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
  });

  it('lists the full profile stack, every item, in profile order', () => {
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.en} />);
    const stack = container.querySelectorAll('dd')[1]?.textContent;
    expect(stack).toBe(profileStack.all.join(' · '));
  });

  it('drops the launch status now that the channel has uploads', () => {
    for (const locale of [LINKS_LOCALE.pt, LINKS_LOCALE.en]) {
      const { container } = render(<IdentityCard locale={locale} />);
      expect(container.textContent).not.toMatch(/chegando|landing soon/);
      expect(container.querySelector('.badge-dot')).toBeNull();
    }
  });

  it('links the current employer in the host row for both locales', () => {
    for (const locale of [LINKS_LOCALE.pt, LINKS_LOCALE.en]) {
      const { container } = render(<IdentityCard locale={locale} />);
      const links = container.querySelectorAll('.links-identity-meta a');
      expect(links).toHaveLength(1);
      expect(links[0]?.getAttribute('href')).toBe(profile.currentEmployer.url);
      expect(links[0]?.getAttribute('target')).toBe('_blank');
      expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(links[0]?.textContent).toContain(profile.currentEmployer.name);
    }
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
    expect(html).toContain('Senior Software Engineer, AI Engineer');
    const pt = renderToString(<IdentityCard locale={LINKS_LOCALE.pt} />);
    expect(pt).toContain('Engenheiro de Software Sênior, Engenheiro de IA');
  });

  it('shows the first tagline at once when the MOTION switch is off', () => {
    vi.useFakeTimers();
    localStorage.setItem('erik.motion', 'off');
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.en} />);
    vi.advanceTimersByTime(5_000);
    const typed = container.querySelector('.tagline-live [aria-hidden="true"]:not(.boot-cursor)');
    expect(typed?.textContent).toBe('Senior Software Engineer, AI Engineer');
    vi.useRealTimers();
    localStorage.removeItem('erik.motion');
  });
  it('reserves the tallest tagline with hidden sizers so cycling never shifts layout', async () => {
    const { profile } = (await import('@/content/links')).linksContent;
    const { container } = render(<IdentityCard locale={LINKS_LOCALE.pt} />);
    const sizers = [...container.querySelectorAll('.tagline-sizer')];
    expect(sizers.map((el) => el.textContent)).toEqual([...profile.taglines[LINKS_LOCALE.pt]]);
    for (const el of sizers) expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
