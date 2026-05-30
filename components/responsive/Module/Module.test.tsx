// components/responsive/Module/Module.test.tsx
// Behavioral tests for Module — pure Server Component.
// Uses renderToStaticMarkup + DOMParser (same pattern as HeroStats.test.tsx)
// to avoid jsdom hydration overhead for an RSC with no client effects.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Module } from './Module';

function render(element: React.ReactElement) {
  const html = renderToStaticMarkup(element);
  const container = new DOMParser().parseFromString(html, 'text/html').body;
  return { container };
}

describe('Module', () => {
  it('passes data-variant="green" to bodyContent when variant="green"', async () => {
    const { container } = render(
      <Module id="test" header="TEST" variant="green">
        content
      </Module>,
    );
    const el = container.querySelector('[data-variant="green"]');
    expect(el).not.toBeNull();
  });

  it('renders no data-variant attribute when variant is not set', async () => {
    const { container } = render(
      <Module id="test" header="TEST">
        content
      </Module>,
    );
    const el = container.querySelector('[data-variant]');
    expect(el).toBeNull();
  });
});
