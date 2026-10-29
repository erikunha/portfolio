import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

async function renderSection(): Promise<Document> {
  const { PerfReceiptsSection } = await import('./PerfReceiptsSection');
  const html = renderToStaticMarkup(createElement(PerfReceiptsSection));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('PerfReceiptsSection — hero data-featured variant', () => {
  it('renders the six approved non-repeated metrics with company and context', async () => {
    const doc = await renderSection();
    const rows = Array.from(doc.querySelectorAll('li'));
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.querySelector('[data-receipt-metric]')?.textContent)).toEqual([
      'API_LATENCY',
      'BUNDLE_CSS',
      'INITIAL_LOAD',
      'CONVERSION',
      'DESKTOP_BUILD',
      'LCP',
    ]);
    expect(doc.body.textContent).toContain('40s→<1s');
    expect(doc.body.textContent).toContain('2,544→1,308ms');
    for (const row of rows) {
      expect(row.querySelector('.receipt-company')?.textContent).toMatch(/@\s*\S/);
      expect(row.querySelector('.receipt-context')?.textContent?.length).toBeGreaterThan(15);
    }
  });
  it('adds data-featured attribute to the hero delta value', async () => {
    const doc = await renderSection();
    const featured = doc.querySelector('[data-featured]');
    expect(featured).not.toBeNull();
  });

  it('renders exactly one element with data-featured', async () => {
    const doc = await renderSection();
    const featured = doc.querySelectorAll('[data-featured]');
    expect(featured.length).toBe(1);
  });

  it('non-hero delta elements do not carry data-featured', async () => {
    const doc = await renderSection();
    const nonFeaturedDeltas = doc.querySelectorAll('[data-delta]:not([data-featured])');
    expect(nonFeaturedDeltas.length).toBeGreaterThan(0);
  });
});

describe('PerfReceiptsSection — Dock focus target', () => {
  it('lands focus on the receipts heading, which names itself', async () => {
    const doc = await renderSection();
    const target = doc.getElementById('sec-perf-receipts');
    expect(target?.tagName).toBe('H3');
    expect(target?.getAttribute('tabindex')).toBe('-1');
    expect(target?.textContent?.length).toBeGreaterThan(0);
  });
});
