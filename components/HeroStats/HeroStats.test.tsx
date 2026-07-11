import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { heroStats } from '@/content/perf-receipts';
import { HeroStats } from './HeroStats';

function getDOM() {
  const html = renderToStaticMarkup(createElement(HeroStats));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroStats entry', () => {
    const items = getDOM().querySelectorAll('[data-testid="hero-stats-item"]');
    expect(items).toHaveLength(heroStats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dd');
    expect(values).toHaveLength(heroStats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dt');
    expect(labels).toHaveLength(heroStats.length);
  });

  it('first stat value matches heroStats[0].value', () => {
    const first = getDOM().querySelector('[data-testid="hero-stats-item"] dd');
    expect(first).not.toBeNull();
    const expectedValue = heroStats[0]?.value;
    expect(expectedValue).toBeDefined();
    expect(first?.textContent).toBe(expectedValue);
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('[data-testid="hero-stats"]');
    expect(container?.getAttribute('aria-label')).toBe('Impact at scale');
  });
});
