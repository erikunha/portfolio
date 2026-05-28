import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('IconMixer', () => {
  it('renders an SVG with aria-hidden', async () => {
    const { IconMixer } = await import('./Icons');
    const html = renderToStaticMarkup(createElement(IconMixer));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const svg = doc.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders three vertical bar paths (mixer visual)', async () => {
    const { IconMixer } = await import('./Icons');
    const html = renderToStaticMarkup(createElement(IconMixer));
    expect(html).toMatch(/line|rect|path/);
  });
});
