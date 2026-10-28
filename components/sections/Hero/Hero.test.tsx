import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';

const getDOM = () =>
  new DOMParser().parseFromString(renderToStaticMarkup(createElement(Hero)), 'text/html');

describe('Hero identity and static actions', () => {
  it('exposes visible identity headings and approved title in each CSS variant', () => {
    const doc = getDOM();
    for (const hero of doc.querySelectorAll(
      '[data-testid="hero-desktop"], [data-testid="hero-mobile"]',
    )) {
      const name = hero.querySelector('[data-testid="hero-name"]');
      expect(name?.textContent).toBe('Erik Cunha');
      expect(name?.hasAttribute('aria-hidden')).toBe(false);
      expect(name?.classList.contains('sr-only')).toBe(false);
      expect(name?.tagName).toBe('H1');
      expect(hero.textContent).toContain('Senior Software Engineer, Frontend & Product');
      expect(hero.textContent).toContain('React · Next.js · TypeScript · Angular · Node.js · AWS');
      expect(hero.textContent).toContain('Brazil');
      expect(hero.textContent).toContain('UTC-3 · available now');
      expect(hero.textContent).toContain('Raylu');
      expect(hero.textContent).toContain('private-markets fintech · B2B SaaS');
      expect(hero.textContent).toContain('LANG: PT native · EN C1');
    }
    expect(doc.querySelectorAll('[data-testid="hero-name"]')).toHaveLength(2);
    expect(doc.querySelector('h1.sr-only')).toBeNull();
  });

  it('renders hiring, GitHub, text CV and summary links without a JavaScript gate', () => {
    const doc = getDOM();
    for (const actions of doc.querySelectorAll('[data-testid="hero-ctas"]')) {
      expect([...actions.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
        'https://www.linkedin.com/in/erikunha/',
        'https://github.com/erikunha',
        '/cv',
        '/summary',
      ]);
      for (const link of actions.querySelectorAll('a[target="_blank"]')) {
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('aria-label')).toContain('opens in a new tab');
      }
    }
    expect(doc.querySelectorAll('[data-testid="hero-ctas"]')).toHaveLength(2);
  });

  it('shows the four r106 impact statistics in both responsive variants', () => {
    const stats = getDOM().querySelectorAll('[data-testid="hero-stats"]');
    expect(stats).toHaveLength(2);
    for (const group of stats) {
      expect([...group.querySelectorAll('dd')].map((value) => value.textContent)).toEqual([
        '$500B+',
        '8M+',
        '40s→<1s',
        '12-agent',
      ]);
      expect([...group.querySelectorAll('dt')].map((label) => label.textContent)).toEqual([
        'fund assets',
        'e-com MAU',
        'reporting API',
        'platform AI',
      ]);
    }
  });
});
