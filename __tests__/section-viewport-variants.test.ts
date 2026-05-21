// __tests__/section-viewport-variants.test.ts
// Regression guard (Testing standard): the Projects / GitLog / Guitar / Visa
// sections must emit BOTH viewport variants into server markup.
//
// app/page.tsx is force-static, so headers() is empty server-side and
// getIsMobileForRequest() always resolves to desktop. A section that picks a
// single variant by UA detection therefore ships desktop-only HTML and renders
// EMPTY on mobile (CSS @media hides the desktop variant; the mobile variant was
// never emitted). The fix is to emit both variants and let the width-based CSS
// @media query choose. These tests fail if UA gating is reintroduced.
//
// Module is an async RSC wrapper the sync server renderer cannot resolve; it is
// stubbed to a transparent passthrough so each section's own variant markup is
// the only thing under test. Module's own behavior is covered by
// content-visibility.test.ts.

import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/responsive/Module', () => ({
  Module: (props: { children?: ReactNode }) => props.children,
}));

import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { VisaSection } from '@/components/sections/VisaSection';

// createElement (not JSX) keeps this a `.test.ts` file so the no-source-grep
// meta-check, which only walks `*.test.ts`, continues to cover it.
describe('responsive section viewport variants', () => {
  it('ProjectsSection emits both the desktop and mobile variant', () => {
    const html = renderToStaticMarkup(createElement(ProjectsSection));
    expect(html).toContain('proj-desktop');
    expect(html).toContain('proj-mobile');
  });

  it('GitLogSection emits both the desktop and mobile variant', () => {
    const html = renderToStaticMarkup(createElement(GitLogSection));
    expect(html).toContain('career-desktop');
    expect(html).toContain('career-mobile');
  });

  it('GuitarSection emits both the desktop and mobile variant', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    expect(html).toContain('guitar-desktop');
    expect(html).toContain('guitar-mobile');
  });

  it('VisaSection emits both the desktop and mobile variant', () => {
    const html = renderToStaticMarkup(createElement(VisaSection));
    expect(html).toContain('visa-desktop-pre');
    expect(html).toContain('visa-mobile-pre');
  });
});
