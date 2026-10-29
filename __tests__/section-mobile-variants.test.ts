import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/responsive/Module', () => ({
  Module: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: () =>
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })),
}));

import { GitLogContent } from '@/components/sections/GitLogSection';
import { GuitarContent } from '@/components/sections/GuitarSection';
import { ManPageContent } from '@/components/sections/ManPageSection';
import { ProjectsContent } from '@/components/sections/ProjectsSection';
import { VisaContent } from '@/components/sections/VisaSection';
import { projects } from '@/content/projects';

describe('responsive section mobile variants', () => {
  it('GuitarContent renders one responsive tree for mobile and desktop UAs', async () => {
    const el = await GuitarContent();
    const html = renderToStaticMarkup(el);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.guitar-presentation')).toHaveLength(1);
    expect(
      Array.from(doc.querySelectorAll('[data-testid^="signal-node-"]'), (node) =>
        node.getAttribute('data-testid'),
      ),
    ).toEqual(['signal-node-INPUT', 'signal-node-AMP', 'signal-node-OUT']);
    expect(doc.querySelectorAll('[data-testid^="stat-"]')).toHaveLength(4);
    expect(doc.querySelectorAll('img')).toHaveLength(1);
    expect(html).not.toContain('guitar-mobile');
    expect(html).not.toContain('guitar-desktop');

    await vi.mocked(headers).withImplementation(
      async () => new Headers({ 'user-agent': 'Desktop' }),
      async () => {
        const desktopHtml = renderToStaticMarkup(await GuitarContent());
        expect(html).toBe(desktopHtml);
      },
    );
  });

  it('ProjectsContent emits the shared cards and canonical copy when UA is mobile', async () => {
    const el = await ProjectsContent();
    const html = renderToStaticMarkup(el);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.projects-grid')).toHaveLength(1);
    const cards = Array.from(doc.querySelectorAll('.project-card'));
    expect(cards).toHaveLength(9);
    for (const [index, project] of projects.entries()) {
      expect(cards[index]?.querySelector('.project-name')?.textContent).toContain(project.name);
      expect(cards[index]?.querySelector('.project-desc')?.textContent).toBe(project.description);
    }
  });

  it('GitLogContent renders one responsive log regardless of UA', () => {
    const html = renderToStaticMarkup(GitLogContent());
    expect(html).toContain('data-testid="career-log"');
    expect(html).not.toContain('career-mobile');
    expect(html).not.toContain('career-desktop');
  });

  it('VisaContent renders the same table regardless of UA', async () => {
    const html = renderToStaticMarkup(await VisaContent());
    expect(html).toContain('class="visa-table"');
    expect(html).not.toContain('data-testid="visa-mobile"');
  });

  it('ManPageContent emits the mobile variant when UA is mobile', async () => {
    const el = await ManPageContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="manpage-mobile"');
  });
});
