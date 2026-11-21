import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectCssSectionIds,
  collectLiveSectionIds,
  collectOrderedIds,
  collectRenderedSectionIds,
  findOrphanedCssIds,
} from '../gates/check-section-order';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = join(process.cwd(), 'scripts/gates/check-section-order.ts');
const TSX = join(process.cwd(), 'node_modules/.bin/tsx');

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

describe('running the script through a symlinked path', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('still runs main and reports, instead of exiting silently', () => {
    const dir = mkdtempSync(join(tmpdir(), 'section-order-link-'));
    const link = join(dir, 'check-section-order.ts');
    symlinkSync(SCRIPT, link);
    try {
      const out = execFileSync(TSX, [link], { cwd: process.cwd(), encoding: 'utf8' });
      expect(out).toMatch(/\[check-section-order\] OK/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
