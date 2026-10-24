import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}));

vi.mock('@/components/responsive/Module', () => ({
  Module: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: () => request.userAgent,
  }),
}));

import { GitLogContent } from '@/components/sections/GitLogSection';
import { GuitarContent } from '@/components/sections/GuitarSection';
import { ManPageContent } from '@/components/sections/ManPageSection';
import { ProjectsContent } from '@/components/sections/ProjectsSection';
import { VisaContent } from '@/components/sections/VisaSection';
import { projects } from '@/content/projects';

describe('responsive section mobile variants', () => {
  it('GuitarContent emits the mobile variant when UA is mobile', async () => {
    const el = await GuitarContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="guitar-mobile"');
    expect(html).not.toContain('data-testid="guitar-desktop"');
  });

  it('ProjectsContent shares the full project summaries across mobile and desktop UAs', async () => {
    const mobileHtml = renderToStaticMarkup(await ProjectsContent());
    const mobileUserAgent = request.userAgent;
    try {
      request.userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      const desktopHtml = renderToStaticMarkup(await ProjectsContent());
      expect(
        mobileHtml,
        'The projects redesign requires one shared summary per project; UA changes must not fork project markup or copy.',
      ).toBe(desktopHtml);
      expect(
        mobileHtml,
        'Projects use one responsive grid, so a separate mobile variant must not return.',
      ).not.toContain('data-testid="proj-mobile"');
      const document = new DOMParser().parseFromString(mobileHtml, 'text/html');
      expect(
        Array.from(document.querySelectorAll('.project-desc'), (summary) => summary.textContent),
        'Every viewport must receive every full canonical project summary without mobile abbreviations.',
      ).toEqual(projects.map((project) => project.description));
    } finally {
      request.userAgent = mobileUserAgent;
    }
  });

  it('GitLogContent keeps all nine full employment records when UA is mobile', async () => {
    const el = await GitLogContent();
    const html = renderToStaticMarkup(el);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('ol')?.children).toHaveLength(9);
    expect(document.body.textContent).toContain(
      'Senior Software Engineer, Frontend & Product (contract via Torc)',
    );
    expect(document.body.textContent).toContain('Jun 2026 - Present');
    expect(document.body.textContent).toContain('Monde Sistemas');
  });

  it('VisaContent emits the mobile variant when UA is mobile', async () => {
    const el = await VisaContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="visa-mobile"');
    expect(html).not.toContain('data-testid="visa-desktop"');
  });

  it('ManPageContent emits the mobile variant when UA is mobile', async () => {
    const el = await ManPageContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="manpage-mobile"');
  });
});
