import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Module } from './Module';
import { moduleHeaderId } from './module.constants';

function render(ui: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(ui);
  return container;
}

describe('Module', () => {
  it('renders a section, never a details or summary', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    expect(container.querySelector('section#sec-x')).not.toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('names the section via aria-labelledby pointing at the h2', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    const section = container.querySelector('section');
    const labelledBy = section?.getAttribute('aria-labelledby');

    expect(labelledBy).toBe(moduleHeaderId('sec-x'));
    expect(container.querySelector(`h2#${labelledBy}`)?.textContent).toContain('HEADER');
  });

  it('is programmatically focusable for hash navigation without adding a tab stop', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    expect(container.querySelector('section')?.getAttribute('tabindex')).toBe('-1');
  });

  it('renders body content with no interaction required', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        <p data-testid="child">visible</p>
      </Module>,
    );

    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('visible');
  });

  it('renders unique header ids when the same component renders twice', () => {
    const container = render(
      <>
        <Module id="sec-a" header="A">
          a
        </Module>
        <Module id="sec-b" header="B">
          b
        </Module>
      </>,
    );

    expect(container.querySelector(`h2#${moduleHeaderId('sec-a')}`)).not.toBeNull();
    expect(container.querySelector(`h2#${moduleHeaderId('sec-b')}`)).not.toBeNull();
  });

  it('passes data-variant="green" to bodyContent when variant="green"', () => {
    const container = render(
      <Module id="sec-x" header="H" variant="green">
        body
      </Module>,
    );

    expect(container.querySelector('[data-variant="green"]')).not.toBeNull();
  });

  it('renders no data-variant attribute when variant is not set', () => {
    const container = render(
      <Module id="sec-x" header="H">
        body
      </Module>,
    );

    expect(container.querySelector('[data-variant]')).toBeNull();
  });

  it('adds data-cv-defer attribute and module-deferred class when defer=true', () => {
    const container = render(
      <Module id="sec-x" header="H" defer>
        body
      </Module>,
    );

    const section = container.querySelector('section');
    expect(section?.getAttribute('data-cv-defer')).toBe('true');
    expect(section?.className).toContain('module-deferred');
  });

  it('omits data-cv-defer attribute and module-deferred class when defer is not set', () => {
    const container = render(
      <Module id="sec-x" header="H">
        body
      </Module>,
    );

    const section = container.querySelector('section');
    expect(section?.getAttribute('data-cv-defer')).toBeNull();
    expect(section?.className).not.toContain('module-deferred');
  });
});
