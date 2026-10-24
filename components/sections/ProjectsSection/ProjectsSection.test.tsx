import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { projects } from '@/content/projects';
import { ProjectsContent, ProjectsSection } from './ProjectsSection';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => ({ get: () => null })) }));

const renderSection = () =>
  new DOMParser().parseFromString(renderToStaticMarkup(<ProjectsSection />), 'text/html');

describe('ProjectsSection', () => {
  it('server-renders the nine approved cards in order with company, shared summary and stack', () => {
    const doc = renderSection();
    const cards = [...doc.querySelectorAll('.projects-grid > li')];
    expect(cards).toHaveLength(9);
    expect(cards.map((card) => card.querySelector('h3')?.textContent?.trim())).toEqual([
      'ORIGINATION_PLATFORM_UI',
      'PAYMENT_ORCHESTRA',
      'SERVICE_OPS_CONSOLE',
      'COMMERCE_EDGE',
      'AI_AGENT_MESH',
      'EDTECH_OMNI',
      'REACT_GOOGLE_MAPS_API (opens in a new tab)',
      'ERIKUNHA.DEV (opens in a new tab)',
      'LAIBEMAGE (opens in a new tab)',
    ]);
    for (const [index, project] of projects.entries()) {
      const card = cards[index];
      expect(card?.querySelector('.project-co')?.textContent).toContain(project.company);
      expect(card?.querySelectorAll('.project-desc')).toHaveLength(1);
      expect(card?.querySelector('.project-desc')?.textContent).toBe(project.description);
      expect(card?.textContent).toContain(project.stack.join(' / '));
    }
  });

  it('links the three OSS contributions with accessible new-tab disclosure and safe relations', () => {
    const links = [...renderSection().querySelectorAll('.project-name a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
      'https://github.com/erikunha/portfolio',
      'https://github.com/erikunha/LAIbemage',
    ]);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')?.split(' ')).toEqual(
        expect.arrayContaining(['noopener', 'noreferrer']),
      );
      expect(link.textContent).toContain('(opens in a new tab)');
      expect(link.querySelector('.sr-only')).not.toBeNull();
    }
  });

  it('marks the odd final card for a two-column span', () => {
    const cards = renderSection().querySelectorAll('.projects-grid > li');
    expect(cards[cards.length - 1]?.classList.contains('project-card-last')).toBe(true);
    expect(
      [...cards].slice(0, -1).some((card) => card.classList.contains('project-card-last')),
    ).toBe(false);
  });

  it('uses the same server content for either user agent without a mobile copy', async () => {
    const { headers } = await import('next/headers');
    const desktop = renderToStaticMarkup(await ProjectsContent());
    vi.mocked(headers).mockResolvedValueOnce({
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
    } as never);
    const mobile = renderToStaticMarkup(await ProjectsContent());
    expect(mobile).toBe(desktop);
    expect(
      new DOMParser().parseFromString(mobile, 'text/html').querySelectorAll('.project-desc'),
    ).toHaveLength(9);
  });
});
