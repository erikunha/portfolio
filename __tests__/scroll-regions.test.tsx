import { getByRole } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManPageDesktop } from '@/components/sections/ManPageSection/ManPageDesktop';
import { ReadmeSection } from '@/components/sections/ReadmeSection/ReadmeSection';
import { ResponsibilitiesSection } from '@/components/sections/ResponsibilitiesSection/ResponsibilitiesSection';
import { SCROLL_REGION_LABELS, SECTION_LABELS } from '@/content/section-labels';

function expectKeyboardScrollRegion(element: ReactElement, name: string, parentName: string) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(element);
  document.body.append(container);
  const scrollContainer = container.querySelector<HTMLElement>('.overflow-x-auto');

  try {
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.getAttribute('tabindex')).toBe('0');
    expect(getByRole(container, 'region', { name })).toBe(scrollContainer);
    expect(name).not.toBe(parentName);
  } finally {
    container.remove();
  }
}

describe('Text scroll regions', () => {
  it('makes the desktop profile manual a named keyboard scroll region', () => {
    expectKeyboardScrollRegion(
      createElement(ManPageDesktop),
      SCROLL_REGION_LABELS['sec-man-page'],
      SECTION_LABELS['sec-man-page'],
    );
  });

  it('makes responsibilities a named keyboard scroll region', () => {
    expectKeyboardScrollRegion(
      createElement(ResponsibilitiesSection),
      SCROLL_REGION_LABELS['sec-responsibilities'],
      SECTION_LABELS['sec-responsibilities'],
    );
  });

  it('makes the README code sample a named keyboard scroll region', () => {
    expectKeyboardScrollRegion(
      createElement(ReadmeSection),
      SCROLL_REGION_LABELS['sec-readme'],
      SECTION_LABELS['sec-readme'],
    );
  });
});
