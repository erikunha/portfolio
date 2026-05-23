// components/sections/Hero/Hero.test.tsx
// Merged from __tests__/hero-heading.test.ts and __tests__/hero-rsc.test.ts.
// Behavioral tests (CG3): renders the Hero RSC and asserts on produced DOM.
// createElement (not JSX) keeps rendering type-safe without a JSX transform in test env.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';
import styles from './Hero.module.css';

// vitest runs under the jsdom environment — DOMParser turns the
// server-rendered HTML into a real document the assertions can query.
function renderHeroDom(): Document {
  const html = renderToStaticMarkup(createElement(Hero));
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

// createElement (not JSX) keeps this file compilable without per-file JSX pragma.
const renderHero = () => renderToStaticMarkup(createElement(Hero));

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

describe('Hero RSC conversion', () => {
  it('renders to static markup with no client runtime', () => {
    const html = renderHero();
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Erik Henrique Alves Cunha');
  });

  it('renders both the desktop and mobile hero variants', () => {
    const html = renderHero();
    // Both variants are emitted server-side; CSS hides the non-matching one.
    // Class names are scoped by CSS Modules — use module keys for assertions.
    const desktopClass = styles.desktop as string;
    const mobileClass = styles.mobile as string;
    expect(html).toContain(desktopClass);
    expect(html).toContain(mobileClass);
  });

  it('emits an h1 in each variant', () => {
    const html = renderHero();
    const h1Count = (html.match(/<h1/g) ?? []).length;
    expect(h1Count).toBe(2);
  });

  it('mounts the HeroBootAnimation client islands as descendants', () => {
    const html = renderHero();
    // The client island renders its boot mount container into static markup
    // even though its effect logic only runs in the browser.
    // Class names are scoped by CSS Modules — use the module key.
    const bootClass = styles.boot as string;
    const bootCount = (html.match(new RegExp(`class="${bootClass}"`, 'g')) ?? []).length;
    expect(bootCount).toBe(2);
  });

  it('renders the hire CTA anchors statically (no JS gate)', () => {
    const html = renderHero();
    expect(html).toContain('https://www.linkedin.com/in/erikunha/');
    expect(html).toContain('https://github.com/erikunha');
  });
});
