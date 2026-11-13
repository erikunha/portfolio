import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/responsive/Module', () => ({
  Module: (props: { children?: ReactNode }) => props.children,
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { SITE_LOCALE } from '@/content/site-locale';

describe('responsive section viewport variants', () => {
  it('ProjectsSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ProjectsSection, { locale: SITE_LOCALE.en }));
    expect(html).toContain('data-testid="projects-grid"');
    expect(html).not.toContain('data-testid="proj-mobile"');
  });

  it('GitLogSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(GitLogSection, { locale: SITE_LOCALE.en }));
    expect(html).toContain('career-log');
    expect(html).not.toContain('career-mobile');
  });

  it('GuitarSection static render does not emit mobile markup', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection, { locale: SITE_LOCALE.en }));
    expect(html).not.toContain('data-testid="guitar-mobile"');
  });
});
