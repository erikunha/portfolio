import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';

const renderHero = () => renderToStaticMarkup(createElement(Hero));

const desktopClass = 'hero-desktop';
const mobileClass = 'hero-mobile';
const bioClass = 'hero-bio';
const bootDesktopClass = 'hero-boot-desktop';
const bootMobileClass = 'hero-boot-mobile';

describe('Hero headings', () => {
  it('renders exactly one semantic h1 with the name', () => {
    const html = renderHero();
    const h1Count = (html.match(/<h1/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(html).toMatch(/<h1[^>]*class="[^"]*sr-only[^"]*"[^>]*>Erik Cunha<\/h1>/);
  });

  it('renders the visible name in each variant as an aria-hidden non-heading', () => {
    const doc = new DOMParser().parseFromString(renderHero(), 'text/html');
    const desktop = doc.querySelector(`.${desktopClass} .${bioClass} [data-testid="hero-name"]`);
    const mobile = doc.querySelector(`.${mobileClass} [data-testid="hero-name"]`);
    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.tagName.toLowerCase()).not.toBe('h1');
    expect(mobile?.tagName.toLowerCase()).not.toBe('h1');
    expect(desktop?.getAttribute('aria-hidden')).toBe('true');
    expect(mobile?.getAttribute('aria-hidden')).toBe('true');
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
