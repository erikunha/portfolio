// __tests__/hero-heading.test.ts
// Behavioral test (CG3): renders the Hero RSC and asserts h1 placement in the
// produced DOM, instead of regex-matching Hero.tsx source. The contract: each
// viewport variant must carry exactly one h1 with the name class, nested inside
// its bio/inner wrapper — so screen readers and SEO see a single, correctly
// scoped document heading per visible layout.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from '@/components/sections/Hero';
import styles from '@/components/sections/Hero.module.css';

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

  it('the desktop h1 lives inside the bio panel', () => {
    const doc = renderHeroDom();
    // Class names are scoped by CSS Modules — import and use module keys.
    const desktopClass = styles.desktop as string;
    const bioClass = styles.bio as string;
    const nameClass = styles.name as string;
    const desktop = doc.querySelector(`.${desktopClass}`);
    expect(desktop).not.toBeNull();
    const bioHeading = desktop?.querySelector(`.${bioClass} h1.${nameClass}`);
    expect(bioHeading).not.toBeNull();
    expect(bioHeading?.textContent).toContain('Erik');
  });

  it('the mobile h1 lives inside the inner wrapper', () => {
    const doc = renderHeroDom();
    // Class names are scoped by CSS Modules — import and use module keys.
    const mobileClass = styles.mobile as string;
    const innerClass = styles.inner as string;
    const nameClass = styles.name as string;
    const mobile = doc.querySelector(`.${mobileClass}`);
    expect(mobile).not.toBeNull();
    const innerHeading = mobile?.querySelector(`.${innerClass} h1.${nameClass}`);
    expect(innerHeading).not.toBeNull();
    expect(innerHeading?.textContent).toContain('Erik');
  });
});
