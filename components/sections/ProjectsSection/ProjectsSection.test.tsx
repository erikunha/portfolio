import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { gitLog } from '@/content/git-log';
import { projects } from '@/content/projects';
import { ProjectSchema } from '@/content/schemas';
import { ProjectsContent, ProjectsSection } from './ProjectsSection';

const { getIsMobile } = vi.hoisted(() => ({ getIsMobile: vi.fn() }));
vi.mock('@/lib/ua', () => ({ getIsMobile }));

describe('Projects', () => {
  it('rejects missing companies and OSS entries without valid links', () => {
    const oss = projects.find((project) => project.kind === 'oss');
    expect(oss).toBeDefined();
    expect(ProjectSchema.safeParse({ ...oss, company: '' }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...oss, url: undefined }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...oss, url: 'not-a-url' }).success).toBe(false);
  });

  it('renders without a per-request user-agent read', async () => {
    getIsMobile.mockClear();
    await ProjectsContent();
    expect(getIsMobile).not.toHaveBeenCalled();
  });

  it('renders nine cards with a company and the three accessible OSS links', async () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(await ProjectsContent()),
      'text/html',
    );
    const cards = Array.from(doc.querySelectorAll('.project-card'));
    expect(cards).toHaveLength(9);
    for (const card of cards) {
      const coNode = card.querySelector('.project-co')?.cloneNode(true) as HTMLElement;
      for (const hidden of coNode.querySelectorAll('.sr-only')) hidden.remove();
      const co = coNode.textContent ?? '';
      const isOss = card.querySelector('.project-name a') !== null;
      expect(
        co,
        'professional cards read "@ COMPANY_NAME" with underscores as in r106; open-source cards leave the label blank',
      ).toMatch(isOss ? /^$/ : /^@ [A-Z0-9]+(?:_[A-Z0-9]+)*$/);
      expect(card.querySelector('h3')).not.toBeNull();
    }
    const links = Array.from(doc.querySelectorAll('.project-card .project-name a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
      'https://github.com/erikunha/portfolio',
      'https://github.com/erikunha/LAIbemage',
    ]);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.textContent).toContain('(opens in a new tab)');
    }
  });

  it('links each professional company label to the matching employer site', async () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(await ProjectsContent()),
      'text/html',
    );
    const cards = Array.from(doc.querySelectorAll('.project-card'));
    cards.forEach((card, index) => {
      const project = projects[index];
      const link = card.querySelector('.project-co a');
      if (project?.kind === 'oss') {
        expect(link, `${project.name} is open source and has no employer`).toBeNull();
        return;
      }
      const employer = gitLog.find((entry) => entry.company.startsWith(project?.company ?? ''));
      expect(employer, `${project?.company} must be an employer in the career log`).toBeDefined();
      expect(link?.getAttribute('href')).toBe(employer?.companyUrl);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link?.textContent).toContain('(opens in a new tab)');
    });
  });

  it('renders one set of canonical card content for the responsive layout', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(<ProjectsSection />),
      'text/html',
    );
    expect(doc.querySelectorAll('.projects-grid')).toHaveLength(1);
    for (const project of projects) {
      expect(doc.body.textContent).toContain(project.description);
    }
    expect(doc.body.textContent).toContain('SERVICE_OPS_CONSOLE');
    expect(doc.body.textContent).not.toContain('CARE_OPS');
  });

  it('attaches six receipts to Projects without a standalone receipts section', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(<ProjectsSection />),
      'text/html',
    );
    expect(doc.querySelector('#sec-projects .project-receipts h3')?.textContent).toBe(
      'PERF_RECEIPTS --HARD-NUMBERS',
    );
    expect(doc.querySelectorAll('#sec-projects .project-receipts li')).toHaveLength(6);
    expect(doc.querySelector('#sec-perf-receipts')).not.toBeNull();
    expect(doc.querySelectorAll('section')).toHaveLength(1);
    expect(doc.querySelectorAll('.project-card')).toHaveLength(9);
  });
});
