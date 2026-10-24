import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/responsive/Module', () => ({
  Module: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: () =>
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  }),
}));

import { GitLogContent } from '@/components/sections/GitLogSection';
import { GuitarContent } from '@/components/sections/GuitarSection';
import { ManPageContent } from '@/components/sections/ManPageSection';
import { ProjectsContent } from '@/components/sections/ProjectsSection';
import { VisaContent } from '@/components/sections/VisaSection';

describe('responsive section mobile variants', () => {
  it('GuitarContent emits the mobile variant when UA is mobile', async () => {
    const el = await GuitarContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="guitar-mobile"');
    expect(html).not.toContain('data-testid="guitar-desktop"');
  });

  it('ProjectsContent emits the mobile variant when UA is mobile', async () => {
    const el = await ProjectsContent();
    const html = renderToStaticMarkup(el);
    expect(html).toContain('data-testid="proj-mobile"');
    expect(html).not.toContain('data-testid="proj-desktop"');
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
