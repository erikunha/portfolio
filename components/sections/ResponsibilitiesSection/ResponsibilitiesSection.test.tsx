// components/sections/ResponsibilitiesSection/ResponsibilitiesSection.test.tsx
// Behavioral tests: renders responsibilities list, highlight attribute on critical items.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

async function render(): Promise<Document> {
  const { ResponsibilitiesSection } = await import('./ResponsibilitiesSection');
  const html = renderToStaticMarkup(createElement(ResponsibilitiesSection));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('ResponsibilitiesSection — highlight attribute', () => {
  it('adds data-highlight to highlighted responsibility lines', async () => {
    const doc = await render();
    const highlighted = doc.querySelector('[data-highlight]');
    expect(highlighted).not.toBeNull();
  });

  it('non-highlighted items do not carry data-highlight', async () => {
    const doc = await render();
    const all = doc.querySelectorAll('[class*="file"]');
    const withAttr = doc.querySelectorAll('[data-highlight]');
    expect(withAttr.length).toBeGreaterThan(0);
    expect(withAttr.length).toBeLessThan(all.length);
  });
});
