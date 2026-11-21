import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listFiles } from '../lib/walk';

const TS_FILE = /\.ts$/;

describe('listFiles', () => {
  let root: string;

  const touch = (rel: string) => {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '');
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'walk-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns sorted root-relative paths of matching files at every depth', () => {
    touch('z.ts');
    touch('a/b/deep.ts');
    touch('a/top.ts');
    touch('a/readme.md');
    expect(listFiles(root, { include: TS_FILE })).toEqual([
      join('a', 'b', 'deep.ts'),
      join('a', 'top.ts'),
      'z.ts',
    ]);
  });

  it('skips a named directory at any depth', () => {
    touch('keep/ok.ts');
    touch('node_modules/pkg.ts');
    touch('keep/nested/node_modules/pkg.ts');
    expect(listFiles(root, { include: TS_FILE, skipDirs: new Set(['node_modules']) })).toEqual([
      join('keep', 'ok.ts'),
    ]);
  });

  it('accepts a predicate over the file name', () => {
    touch('a.ts');
    touch('a.test.ts');
    expect(
      listFiles(root, { include: (name) => TS_FILE.test(name) && !name.includes('.test.') }),
    ).toEqual(['a.ts']);
  });
});
