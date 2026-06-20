// __tests__/scripts/mutation-incremental-config.test.ts
// Pins the incremental-cache optimization. The Stryker flags are read from the
// PARSED config object (importing stryker.config.mjs), not a string grep, so a
// commented-out line cannot pass. The workflow cache step is asserted against the
// raw mutation.yml text (the established CI-config-test pattern, see ci-ui-filter).
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
    // Stryker's default is reports/stryker-incremental.json; overriding it makes the
    // config, the actions/cache path, and .gitignore all name the same file.
    expect(config.incrementalFile).toBe('.stryker-incremental.json');
  });
});

describe('mutation.yml caches the incremental file', () => {
  it('has a SHA-pinned actions/cache step (existence guard for the asserts below)', () => {
    expect(wf).toContain('actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5');
  });

  it('caches the incremental file with the evolving-cache key pattern', () => {
    expect(wf).toContain('path: .stryker-incremental.json');
    expect(wf).toContain('key: stryker-incremental-${{ github.run_id }}');
    // restore-keys uses the bare prefix to restore the most recent prior file.
    expect(wf).toMatch(/restore-keys:\s*\|\s*\n\s*stryker-incremental-/);
  });

  it('places the cache step before the mutation run (so the file is restored first)', () => {
    const cacheIdx = wf.indexOf('actions/cache@27d5ce7f');
    const runIdx = wf.indexOf('name: Run mutation tests');
    expect(cacheIdx).toBeGreaterThanOrEqual(0);
    expect(runIdx).toBeGreaterThan(cacheIdx);
  });
});
