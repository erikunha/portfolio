import { describe, expect, it } from 'vitest';
import { parseLockfilePackages } from '../check-pkg-age.mjs';

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
    expect(pkgs.has('react-dom@19.2.0')).toBe(true);
    expect(pkgs.has('zod@4.4.3')).toBe(true);
  });

  it('returns the parsed entry shape', () => {
    const pkgs = parseLockfilePackages(V9_LOCK);
    expect(pkgs.get('react@19.2.0')).toEqual({ name: 'react', version: '19.2.0' });
  });

  it('returns an EMPTY map when the snapshot-key format changes (gate must fail loudly, not pass)', () => {
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
