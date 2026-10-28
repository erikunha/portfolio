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
import { ManPageSection } from '@/components/sections/ManPageSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { VisaSection } from '@/components/sections/VisaSection';
import { careerScrollLabel } from '@/content/git-log';
import { SECTION_LABELS } from '@/content/section-labels';

describe('responsive section viewport variants', () => {
  it('ProjectsSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ProjectsSection));
    expect(html).toContain('data-testid="proj-desktop"');
    expect(html).not.toContain('data-testid="proj-mobile"');
  });

  it('GitLogSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(GitLogSection));
    expect(html).toContain('career-desktop');
    expect(html).not.toContain('career-mobile');
  });

  it('GitLogSection scroll container is not a second region named like its module', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(GitLogSection));
    const scroller = host.querySelector('[data-testid="career-desktop"]');
    expect(scroller?.tagName).toBe('DIV');
    expect(scroller?.getAttribute('role')).toBe('group');
    expect(scroller?.getAttribute('tabindex')).toBe('0');
    expect(scroller?.getAttribute('aria-label')).toBe(careerScrollLabel);
    expect(careerScrollLabel).not.toBe(SECTION_LABELS['sec-git-log']);
  });

  it('GuitarSection static render does not emit mobile markup', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    expect(html).not.toContain('data-testid="guitar-mobile"');
  });

  it('VisaSection renders one responsive authorization table', () => {
    const html = renderToStaticMarkup(createElement(VisaSection));
    expect(html).toContain('class="visa-table"');
    expect(html).not.toContain('data-testid="visa-mobile"');
    expect(html).not.toContain('data-testid="visa-desktop"');
  });

  it('ManPageSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ManPageSection));
    expect(html).toContain('data-testid="manpage-desktop"');
    expect(html).not.toContain('data-testid="manpage-mobile"');
  });
});
