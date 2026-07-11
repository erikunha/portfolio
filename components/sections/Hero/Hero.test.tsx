import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';

function renderHeroDom(): Document {
  const html = renderToStaticMarkup(createElement(Hero));
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

const renderHero = () => renderToStaticMarkup(createElement(Hero));

const desktopClass = 'hero-desktop';
const mobileClass = 'hero-mobile';
const bioClass = 'hero-bio';
const bootDesktopClass = 'hero-boot-desktop';
const bootMobileClass = 'hero-boot-mobile';

describe('Hero headings', () => {
  it('renders an h1 element', () => {
    const doc = renderHeroDom();
    expect(doc.querySelectorAll('h1').length).toBeGreaterThan(0);
  });

  it('the desktop h1 lives inside the bio panel', () => {
    const doc = renderHeroDom();
    const desktop = doc.querySelector(`.${desktopClass}`);
    expect(desktop).not.toBeNull();
    const bioHeading = desktop?.querySelector(`.${bioClass} h1`);
    expect(bioHeading).not.toBeNull();
    expect(bioHeading?.textContent).toContain('Erik');
  });

  it('the mobile h1 lives inside the inner wrapper', () => {
    const doc = renderHeroDom();
    const mobile = doc.querySelector(`.${mobileClass}`);
    expect(mobile).not.toBeNull();
    const innerHeading = mobile?.querySelector('h1');
    expect(innerHeading).not.toBeNull();
    expect(innerHeading?.textContent).toContain('Erik');
  });
});

describe('Hero RSC conversion', () => {
  it('renders to static markup with no client runtime', () => {
    const html = renderHero();
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Erik Cunha');
  });

  it('renders both the desktop and mobile hero variants', () => {
    const html = renderHero();
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
    const desktopBootCount = (html.match(new RegExp(`class="${bootDesktopClass}"`, 'g')) ?? [])
      .length;
    const mobileBootCount = (html.match(new RegExp(`class="${bootMobileClass}"`, 'g')) ?? [])
      .length;
    expect(desktopBootCount).toBe(1);
    expect(mobileBootCount).toBe(1);
  });

  it('renders the hire CTA anchors statically (no JS gate)', () => {
    const html = renderHero();
    expect(html).toContain('https://www.linkedin.com/in/erikunha/');
    expect(html).toContain('https://github.com/erikunha');
  });
});
