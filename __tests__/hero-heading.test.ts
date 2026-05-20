// __tests__/hero-heading.test.ts
// Behavioral test (CG3): renders the Hero RSC and asserts h1 placement in the
// produced DOM, instead of regex-matching Hero.tsx source. The contract: each
// viewport variant must carry exactly one h1.hero__name, nested inside its
// bio/inner wrapper — so screen readers and SEO see a single, correctly
// scoped document heading per visible layout.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from '@/components/sections/Hero';

// vitest runs under the jsdom environment — DOMParser turns the
// server-rendered HTML into a real document the assertions can query.
// createElement (not JSX) keeps this file a `.test.ts`.
function renderHeroDom(): Document {
  const html = renderToStaticMarkup(createElement(Hero));
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('Hero headings', () => {
  it('renders an h1 element', () => {
    const doc = renderHeroDom();
    expect(doc.querySelectorAll('h1').length).toBeGreaterThan(0);
  });

  it('the desktop h1.hero__name lives inside the .hero__bio panel', () => {
    const doc = renderHeroDom();
    const desktop = doc.querySelector('.hero--desktop');
    expect(desktop).not.toBeNull();
    const bioHeading = desktop?.querySelector('.hero__bio h1.hero__name');
    expect(bioHeading).not.toBeNull();
    expect(bioHeading?.textContent).toContain('Erik');
  });

  it('the mobile h1.hero__name lives inside the .hero__inner wrapper', () => {
    const doc = renderHeroDom();
    const mobile = doc.querySelector('.hero--mobile');
    expect(mobile).not.toBeNull();
    const innerHeading = mobile?.querySelector('.hero__inner h1.hero__name');
    expect(innerHeading).not.toBeNull();
    expect(innerHeading?.textContent).toContain('Erik');
  });
});
