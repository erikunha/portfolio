import { describe, expect, it } from 'vitest';
import {
  collectCssSectionIds,
  collectLiveSectionIds,
  collectOrderedIds,
  collectRenderedSectionIds,
  findMissingOrderEntries,
  findOrphanedCssIds,
} from '../check-section-order.mjs';

describe('collectRenderedSectionIds', () => {
  it('reads ids from JSX id attributes only, so a prop or a string literal is not a section', () => {
    const ids = collectRenderedSectionIds([
      '<section id="sec-projects" />',
      '<CredentialsSection id="sec-credentials" communityId="sec-community" />',
      "const DOCK_TARGET_ID = 'sec-perf-receipts';",
    ]);

    expect([...ids]).toEqual(['sec-projects', 'sec-credentials']);
  });
});

describe('collectLiveSectionIds', () => {
  it('reads every sec- id a source mentions, so a section id held in a constant is live', () => {
    const ids = collectLiveSectionIds(["const SECTION_ID = 'sec-guitar';"]);

    expect([...ids]).toEqual(['sec-guitar']);
  });
});

describe('collectOrderedIds', () => {
  it('reads only ids that carry an order declaration', () => {
    const ids = collectOrderedIds('#sec-readme { order: 1; }\n#sec-shell { color: lime; }');

    expect([...ids]).toEqual(['sec-readme']);
  });
});

describe('collectCssSectionIds', () => {
  it('reads every sec- selector, ordered or not', () => {
    const ids = collectCssSectionIds(
      '#sec-readme { order: 1; }\n#sec-man-page-body { min-height: 0; }',
    );

    expect([...ids]).toEqual(['sec-readme', 'sec-man-page-body']);
  });
});

describe('findMissingOrderEntries', () => {
  it('reports a rendered section with no order rule', () => {
    const missing = findMissingOrderEntries(
      new Set(['sec-projects', 'sec-shell']),
      new Set(['sec-shell']),
      new Set(),
    );

    expect(missing).toEqual(['sec-projects']);
  });

  it('exempts a declared nested anchor', () => {
    const missing = findMissingOrderEntries(
      new Set(['sec-perf-receipts']),
      new Set(),
      new Set(['sec-perf-receipts']),
    );

    expect(missing).toEqual([]);
  });
});

describe('findOrphanedCssIds', () => {
  it('reports a CSS rule for a section id no source renders', () => {
    const orphaned = findOrphanedCssIds(
      new Set(['sec-readme', 'sec-man-page', 'sec-sys-health']),
      new Set(['sec-readme']),
    );

    expect(orphaned).toEqual(['sec-man-page', 'sec-sys-health']);
  });

  it('reports nothing when every CSS id is live', () => {
    const orphaned = findOrphanedCssIds(new Set(['sec-readme']), new Set(['sec-readme']));

    expect(orphaned).toEqual([]);
  });
});
