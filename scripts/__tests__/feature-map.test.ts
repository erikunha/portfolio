import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderFeatureMap } from '../codegen/feature-map';
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
  it('counts the tracked files under each prefix of a feature', () => {
    const doc = renderFeatureMap(FIXTURE_FILES);
    expect(doc).toContain('| `lib/ask/` | 2 |');
    expect(doc).toContain('| `__tests__/ask/` | 1 |');
    expect(doc).toContain('| `app/api/contact/` | 1 |');
    expect(doc).toContain('| `app/api/contact-retry/` | 1 |');
    expect(doc).toContain('| `lib/contact/` | 0 |');
  });

  it('is deterministic and names the command that regenerates it', () => {
    const doc = renderFeatureMap(FIXTURE_FILES);
    expect(renderFeatureMap([...FIXTURE_FILES].reverse())).toBe(doc);
    expect(doc).toContain('pnpm docs:feature-map');
    expect(doc).toMatch(/^# Feature map\n/);
  });
});

describe('docs/feature-map.md', () => {
  it('matches the tracked tree, so a move that changes counts needs a regeneration', () => {
    expect(
      readFileSync(MAP_PATH, 'utf8'),
      'run `pnpm docs:feature-map` and commit docs/feature-map.md',
    ).toBe(renderFeatureMap(trackedFiles([], { cwd: ROOT })));
  });
});
