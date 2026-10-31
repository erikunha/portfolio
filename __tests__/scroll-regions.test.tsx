import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getByRole } from '@testing-library/react';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { About } from '@/components/sections/About';
import { SCROLL_REGION_LABELS, SECTION_LABELS } from '@/content/section-labels';

const SCROLL_REGION_DOC = 'docs/08-performance-and-accessibility.md';

const REGION_ENTRY = /^- `(sec-[a-z0-9-]+)`: (.+)$/gm;

const RETIRED_REGION_NAMES = ['Profile manual', 'System health'];

const readRegionDoc = () => readFileSync(join(process.cwd(), SCROLL_REGION_DOC), 'utf8');

const documentedRegions = (): Record<string, string> =>
  Object.fromEntries(
    [...readRegionDoc().matchAll(REGION_ENTRY)].map(([, id, label]) => [
      id as string,
      label as string,
    ]),
  );

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

describe('the scroll regions the accessibility doc names', () => {
  it('documents exactly the regions the code defines', () => {
    const documented = documentedRegions();

    expect(
      Object.keys(documented).length,
      `${SCROLL_REGION_DOC} lists no scroll region as "- \`<id>\`: <accessible name>", so the comparison below holds vacuously. The doc must carry one line per region in content/section-labels.ts.`,
    ).toBeGreaterThan(0);

    expect(
      documented,
      `the scroll regions documented in ${SCROLL_REGION_DOC} are not the ones content/section-labels.ts defines. A region the code dropped must leave the doc, and a new region must enter it, or the doc describes landmarks a screen reader cannot find.`,
    ).toEqual({ ...SCROLL_REGION_LABELS });
  });

  it('names no retired scroll region', () => {
    const source = readRegionDoc();
    const retired = RETIRED_REGION_NAMES.filter((name) => source.includes(name));

    expect(
      retired,
      `${SCROLL_REGION_DOC} names a scroll region that was removed from content/section-labels.ts. The retired names are pinned here the way __tests__/meta/docs-name-real-tokens.test.ts pins retired design tokens, so prose that names a dropped region fails even when the region list itself is correct.`,
    ).toEqual([]);
  });
});
