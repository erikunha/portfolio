import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyPrefixes, renderFeatureMap } from '../codegen/feature-map';
import { trackedFiles } from '../lib/git';

const ROOT = join(import.meta.dirname, '../..');
const MAP_PATH = join(ROOT, 'docs/feature-map.md');

const FIXTURE_FILES = [
  'lib/ask/a.ts',
  'lib/ask/b.ts',
  '__tests__/ask/a.test.ts',
  'app/api/contact/route.ts',
  'app/api/contact-retry/route.ts',
  'unrelated/file.ts',
];

describe('renderFeatureMap', () => {
  it('lists each feature with its path prefixes and no file counts, so adding a file needs no regeneration', () => {
    const doc = renderFeatureMap();
    expect(doc).toContain('| `lib/ask/` |');
    expect(doc).toContain('| `lib/contact/` |');
    expect(doc).not.toMatch(/\| \d+ \|/);
  });

  it('is deterministic and names the command that regenerates it', () => {
    expect(renderFeatureMap()).toBe(renderFeatureMap());
    expect(renderFeatureMap()).toContain('pnpm docs:feature-map');
    expect(renderFeatureMap()).toMatch(/^# Feature map\n/);
  });
});

describe('emptyPrefixes', () => {
  it('reports a declared prefix that no tracked file sits under', () => {
    expect(emptyPrefixes(FIXTURE_FILES)).toContain('lib/contact/');
    expect(emptyPrefixes(FIXTURE_FILES)).not.toContain('lib/ask/');
  });
});

describe('docs/feature-map.md', () => {
  it('matches the generator output', () => {
    expect(
      readFileSync(MAP_PATH, 'utf8'),
      'run `pnpm docs:feature-map` and commit docs/feature-map.md',
    ).toBe(renderFeatureMap());
  });

  it('names only prefixes that exist in the tracked tree, so a move that empties one fails', () => {
    expect(
      emptyPrefixes(trackedFiles([], { cwd: ROOT })),
      'a feature prefix in scripts/codegen/feature-map.ts matches no tracked file: fix the table',
    ).toEqual([]);
  });
});
