import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroStats } from '@/components/HeroStats';
import { heroStats } from '@/content/perf-receipts';

function getDOM() {
  const html = renderToStaticMarkup(createElement(HeroStats));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroStats entry', () => {
    const items = getDOM().querySelectorAll('.hero-stats__item');
    expect(items).toHaveLength(heroStats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('.hero-stats__value');
    expect(values).toHaveLength(heroStats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('.hero-stats__label');
    expect(labels).toHaveLength(heroStats.length);
  });

  it('first stat value matches heroStats[0].value', () => {
    const first = getDOM().querySelector('.hero-stats__value');
    expect(first?.textContent).toBe(heroStats[0]?.value);
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('.hero-stats');
    expect(container?.getAttribute('aria-label')).toBe('Impact at scale');
  });
});
