import { parse } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia, rulesWithSelector } from '@/__tests__/helpers/css-rules';

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

describe('PerfReceiptsSection: receipt value layout', () => {
  it('keeps a receipt value on one line from 768 up, where the row has room for it', () => {
    // behavioral-test-allow: the receipt row contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const desktopValue = rulesInMedia(stylesheet, /min-width: 768px/, '.receipt-value');
    expect(desktopValue).toHaveLength(1);
    expect(declValue(desktopValue[0], 'white-space')).toBe('nowrap');
    const desktopRow = rulesInMedia(stylesheet, /min-width: 768px/, '.project-receipts li');
    expect(desktopRow).toHaveLength(1);
    expect(declValue(desktopRow[0], 'grid-template-columns')).toContain(
      'var(--receipt-value-width)',
    );
  });

  it('still wraps a receipt value in the narrow two-column row', () => {
    // behavioral-test-allow: the receipt row contract lives in the shipped stylesheet; jsdom has no layout engine
    const stylesheet = parse(readComponentsCss());
    const narrowValue = rulesWithSelector(stylesheet, '.receipt-value')[0];
    expect(declValue(narrowValue, 'overflow-wrap')).toBe('anywhere');
    expect(declValue(narrowValue, 'white-space')).toBeUndefined();
  });
});
