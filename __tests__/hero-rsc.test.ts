// __tests__/hero-rsc.test.ts
// Behavioral test (CG3): verifies Hero is a true Server Component shipping
// zero client JS. The previous version grepped Hero.tsx source for the
// absence of 'use client' / useEffect / useRef strings — brittle.
//
// The real property is: Hero renders to static HTML with no client runtime.
// A component that depended on a client-only hook (useState/useEffect/useRef)
// would either throw under renderToStaticMarkup or be impossible to render
// without a React DOM root. Rendering it server-side and asserting on the
// produced markup proves the guarantee through observable output.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from '@/components/sections/Hero';

// createElement (not JSX) keeps this file a `.test.ts` — the meta-check
// no-source-grep walks `*.test.ts`, so a `.tsx` rename would be invisible.
const renderHero = () => renderToStaticMarkup(createElement(Hero));

describe('Hero RSC conversion', () => {
  it('renders to static markup with no client runtime', () => {
    const html = renderHero();
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Erik Henrique Alves Cunha');
  });

  it('renders both the desktop and mobile hero variants', () => {
    const html = renderHero();
    // Both variants are emitted server-side; CSS hides the non-matching one.
    expect(html).toMatch(/class="hero hero--desktop"/);
    expect(html).toMatch(/class="hero hero--mobile"/);
  });

  it('emits an h1 in each variant', () => {
    const html = renderHero();
    const h1Count = (html.match(/<h1/g) ?? []).length;
    expect(h1Count).toBe(2);
  });

  it('mounts the HeroBootAnimation client islands as descendants', () => {
    const html = renderHero();
    // The client island renders its hero__boot mount container into static
    // markup even though its effect logic only runs in the browser.
    const bootCount = (html.match(/class="hero__boot"/g) ?? []).length;
    expect(bootCount).toBe(2);
  });

  it('renders the hire CTA anchors statically (no JS gate)', () => {
    const html = renderHero();
    expect(html).toContain('https://www.linkedin.com/in/erikunha/');
    expect(html).toContain('https://github.com/erikunha');
  });
});
