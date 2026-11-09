import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const MIN_QUARANTINE_MINUTES = 7 * 24 * 60;
const FIRST_RELEASE_AGE_PNPM: readonly [number, number, number] = [10, 16, 0];

// behavioral-test-allow: the artifacts under test ARE the pnpm settings file and the manifest pin; the quarantine runs inside pnpm at install time and has no runtime surface here.
const workspace = parse(readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8')) as {
  minimumReleaseAge?: number;
};
// behavioral-test-allow: same artifact reason as above, the manifest pin is the property.
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  packageManager: string;
  scripts: Record<string, string>;
};

function parseSemver(version: string): number[] {
  return version.split('.').map(Number);
}

function isAtLeast(actual: readonly number[], floor: readonly number[]): boolean {
  for (let i = 0; i < floor.length; i += 1) {
    if (actual[i] !== floor[i]) return (actual[i] ?? 0) > (floor[i] ?? 0);
  }
  return true;
}

describe('npm release quarantine', () => {
  it('pnpm refuses versions younger than seven days at install time', () => {
    expect(workspace.minimumReleaseAge).toBeGreaterThanOrEqual(MIN_QUARANTINE_MINUTES);
  });

  it('the pinned pnpm is new enough to enforce minimumReleaseAge, else the setting is silently ignored', () => {
    const match = /^pnpm@(\d+\.\d+\.\d+)/.exec(manifest.packageManager);
    expect(match).not.toBeNull();
    expect(isAtLeast(parseSemver(match?.[1] ?? '0.0.0'), FIRST_RELEASE_AGE_PNPM)).toBe(true);
  });

  it('the vacuous registry-metadata script is gone', () => {
    expect(manifest.scripts['check:pkg-age']).toBeUndefined();
  });
});
