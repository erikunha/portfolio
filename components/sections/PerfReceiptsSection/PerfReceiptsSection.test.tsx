// components/sections/PerfReceiptsSection/PerfReceiptsSection.test.tsx
// Behavioral tests: hero receipt carries data-featured attribute instead of a
// concatenated CSS class — the attribute drives the CSS variant selector
// .delta[data-featured] in PerfReceiptsSection.module.css.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

async function renderSection(): Promise<Document> {
  const { PerfReceiptsSection } = await import('./PerfReceiptsSection');
  const html = renderToStaticMarkup(createElement(PerfReceiptsSection));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('PerfReceiptsSection — hero data-featured variant', () => {
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
    // Query delta elements specifically (not all paragraphs) to avoid matching
    // company/note/metric <p> elements that are never delta candidates.
    const nonFeaturedDeltas = doc.querySelectorAll('[class*="delta"]:not([data-featured])');
    expect(nonFeaturedDeltas.length).toBeGreaterThan(0);
  });
});
