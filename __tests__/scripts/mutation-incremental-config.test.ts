import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import strykerConfig from '@/stryker.config.mjs';

const config = strykerConfig as Record<string, unknown>;
const wf = readFileSync(`${process.cwd()}/.github/workflows/mutation.yml`, 'utf8');

describe('stryker incremental config', () => {
  it('enables incremental mode', () => {
    expect(config.incremental).toBe(true);
  });

  it('pins incrementalFile to the repo-root path the cache + gitignore reference', () => {
    expect(config.incrementalFile).toBe('.stryker-incremental.json');
  });
});

describe('mutation.yml caches the incremental file', () => {
  it('has a SHA-pinned actions/cache step (existence guard for the asserts below)', () => {
    expect(wf).toContain('actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0');
  });

  it('caches the incremental file with the evolving-cache key pattern', () => {
    expect(wf).toContain('path: .stryker-incremental.json');
    expect(wf).toMatch(/key:\s*stryker-incremental-\$\{\{\s*github\.run_id\s*\}\}/);
    expect(wf).toMatch(/restore-keys:\s*\|\s*\n\s*stryker-incremental-/);
  });

  it('places the cache step before the mutation run (so the file is restored first)', () => {
    const cacheIdx = wf.indexOf('actions/cache@55cc8345');
    const runIdx = wf.indexOf('name: Run mutation tests');
    expect(cacheIdx).toBeGreaterThanOrEqual(0);
    expect(runIdx).toBeGreaterThan(cacheIdx);
  });
});
