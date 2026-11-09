import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { heroContent } from '@/content/hero';
import { SITE_LOCALE } from '@/content/site-locale';
import { HeroStats } from './HeroStats';

function getDOM() {
  const html = renderToStaticMarkup(
    createElement(HeroStats, {
      stats: heroContent[SITE_LOCALE.en].stats,
      label: heroContent[SITE_LOCALE.en].statsLabel,
    }),
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroContent[SITE_LOCALE.en].stats entry', () => {
    const items = getDOM().querySelectorAll('[data-testid="hero-stats-item"]');
    expect(items).toHaveLength(heroContent[SITE_LOCALE.en].stats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dd');
    expect(values).toHaveLength(heroContent[SITE_LOCALE.en].stats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dt');
    expect(labels).toHaveLength(heroContent[SITE_LOCALE.en].stats.length);
  });

  it('first stat value matches heroContent[SITE_LOCALE.en].stats[0].value', () => {
    const first = getDOM().querySelector('[data-testid="hero-stats-item"] dd');
    expect(first).not.toBeNull();
    const expectedValue = heroContent[SITE_LOCALE.en].stats[0]?.value;
    expect(expectedValue).toBeDefined();
    expect(first?.textContent).toBe(expectedValue);
  });

  it('uses the caller label for an alternate stats set', () => {
    const html = renderToStaticMarkup(
      createElement(HeroStats, {
        stats: [{ value: '99%', label: 'availability' }],
        label: 'Service reliability',
      }),
    );
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const container = dom.querySelector('[data-testid="hero-stats"]');
    expect(container?.getAttribute('aria-label')).toBe('Service reliability');
    expect(container?.querySelector('dt')?.textContent).toBe('availability');
    expect(container?.querySelector('dd')?.textContent).toBe('99%');
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('[data-testid="hero-stats"]');
    expect(container?.getAttribute('aria-label')).toBe(heroContent[SITE_LOCALE.en].statsLabel);
  });
});
