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

describe('responsive section viewport variants', () => {
  it('ProjectsSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ProjectsSection));
    expect(html).toContain('data-testid="proj-desktop"');
    expect(html).not.toContain('data-testid="proj-mobile"');
  });

  it('GitLogSection emits one semantic employment list at every viewport', () => {
    const html = renderToStaticMarkup(createElement(GitLogSection));
    const document = new DOMParser().parseFromString(html, 'text/html');
    const lists = document.querySelectorAll('ol[aria-label="Employment history"]');
    expect(lists).toHaveLength(1);
    expect(lists[0]?.children).toHaveLength(9);
    expect(document.querySelectorAll('#sec-education')).toHaveLength(1);
  });

  it('GuitarSection static render does not emit mobile markup', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    expect(html).not.toContain('data-testid="guitar-mobile"');
  });

  it('VisaSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(VisaSection));
    expect(html).toContain('data-testid="visa-desktop"');
    expect(html).not.toContain('data-testid="visa-mobile"');
  });

  it('ManPageSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ManPageSection));
    expect(html).toContain('data-testid="manpage-desktop"');
    expect(html).not.toContain('data-testid="manpage-mobile"');
  });
});
