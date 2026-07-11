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

  it('adds data-cv-defer attribute when defer=true, no cvDefer class', async () => {
    const { container } = render(
      <Module id="test" header="TEST" defer>
        content
      </Module>,
    );
    const details = container.querySelector('details');
    expect(details?.getAttribute('data-cv-defer')).toBe('true');
    expect(details?.className).not.toContain('cvDefer');
  });
});
