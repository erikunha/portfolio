// __tests__/section-viewport-variants.test.ts
// Regression guard (Testing standard): the PPR dual-variant sections must emit
// exactly ONE viewport variant. With cacheComponents: true and Suspense-gated
// async RSCs calling getIsMobile() → headers(), the static Suspense fallback
// (desktop) renders synchronously; mobile content renders only when the async
// RSC resolves server-side for a real request.
//
// Module is an async RSC wrapper the sync server renderer cannot resolve; it is
// stubbed to a transparent passthrough so each section's own variant markup is
// the only thing under test. Module's own behavior is covered by
// content-visibility.test.ts.
//
// next/headers is mocked because getIsMobile() calls it — under test we return
// an empty UA string, so isMobile resolves to false (desktop path). The
// Suspense fallback (desktop) is what renderToStaticMarkup sees anyway, since
// async RSCs are suspended and only the fallback is synchronously renderable.

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
import { VisaSection } from '@/components/sections/VisaSection';

// createElement (not JSX) keeps this a `.test.ts` file so the no-source-grep
// meta-check, which only walks `*.test.ts`, continues to cover it.
describe('responsive section viewport variants', () => {
  it('ProjectsSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ProjectsSection));
    expect(html).toContain('proj-desktop');
    expect(html).not.toContain('proj-mobile');
  });

  it('GitLogSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(GitLogSection));
    expect(html).toContain('career-desktop');
    expect(html).not.toContain('career-mobile');
  });

  it('GuitarSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    expect(html).toContain('guitar-desktop');
    expect(html).not.toContain('guitar-mobile');
  });

  it('VisaSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(VisaSection));
    expect(html).toContain('visa-desktop-pre');
    expect(html).not.toContain('visa-mobile-pre');
  });
});
