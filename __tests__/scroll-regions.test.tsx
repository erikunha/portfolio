import { getByRole } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { About } from '@/components/sections/About';
import { SCROLL_REGION_LABELS, SECTION_LABELS } from '@/content/section-labels';

function expectKeyboardScrollRegion(
  element: ReactElement,
  name: string,
  parentName: string,
  selector: string,
) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(element);
  document.body.append(container);
  try {
    const scrollContainer = container.querySelector<HTMLElement>(selector);
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.getAttribute('tabindex')).toBe('0');
    expect(getByRole(container, 'region', { name })).toBe(scrollContainer);
    expect(name).not.toBe(parentName);
  } finally {
    container.remove();
  }
}

describe('Text scroll regions', () => {
  it('makes responsibilities a named keyboard scroll region', () => {
    expectKeyboardScrollRegion(
      createElement(About),
      SCROLL_REGION_LABELS['sec-responsibilities'],
      SECTION_LABELS['sec-readme'],
      '.ab-resp .overflow-x-auto',
    );
  });

  it('makes the README code sample a named keyboard scroll region', () => {
    expectKeyboardScrollRegion(
      createElement(About),
      SCROLL_REGION_LABELS['sec-readme'],
      SECTION_LABELS['sec-readme'],
      '.ab-code-scroll',
    );
  });
});
