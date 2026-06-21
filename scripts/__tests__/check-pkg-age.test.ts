// scripts/__tests__/check-pkg-age.test.ts
// Unit test for the supply-chain age gate's lockfile parser. The pure
// parseLockfilePackages() is the load-bearing input to the gate: if a pnpm
// upgrade changes the snapshot-key format and the regex matches nothing, the
// gate would pass vacuously (zero packages checked, exit 0). These tests pin
// that it extracts real entries from a v9-shaped lockfile and returns EMPTY on
// a format change, which the script turns into an infra failure (exit 2).
import { describe, expect, it } from 'vitest';
import { parseLockfilePackages } from '../check-pkg-age.mjs';

// A representative pnpm-lock.yaml v9 `snapshots:`-section excerpt.
const V9_LOCK = `lockfileVersion: '9.0'

snapshots:

  '@biomejs/biome@2.3.1':
    optionalDependencies:
      '@biomejs/cli-darwin-arm64': 2.3.1

  'react@19.2.0': {}

  'react-dom@19.2.0(react@19.2.0)':
    dependencies:
      react: 19.2.0

  'zod@4.4.3': {}
`;

describe('parseLockfilePackages', () => {
  it('extracts name@version entries from a v9 lockfile, stripping peer-dep suffixes', () => {
    const pkgs = parseLockfilePackages(V9_LOCK);
    expect(pkgs.size).toBe(4);
    expect(pkgs.has('@biomejs/biome@2.3.1')).toBe(true);
    expect(pkgs.has('react@19.2.0')).toBe(true);
    // peer-dep suffix "(react@19.2.0)" stripped to the bare version
    expect(pkgs.has('react-dom@19.2.0')).toBe(true);
    expect(pkgs.has('zod@4.4.3')).toBe(true);
  });

  it('returns the parsed entry shape', () => {
    const pkgs = parseLockfilePackages(V9_LOCK);
    expect(pkgs.get('react@19.2.0')).toEqual({ name: 'react', version: '19.2.0' });
  });

  it('returns an EMPTY map when the snapshot-key format changes (gate must fail loudly, not pass)', () => {
    // Hypothetical future format with no `  'name@version':` snapshot keys.
    const changed = `lockfileVersion: '10.0'

packages:
  react:
    version: 19.2.0
  zod:
    version: 4.4.3
`;
    expect(parseLockfilePackages(changed).size).toBe(0);
  });

  it('returns an empty map for an empty string', () => {
    expect(parseLockfilePackages('').size).toBe(0);
  });
});
