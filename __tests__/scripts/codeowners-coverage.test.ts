import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: the artifact under test IS the CODEOWNERS file; ownership routing has no runtime surface in this repository.
const lines = readFileSync(join(process.cwd(), '.github', 'CODEOWNERS'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));
const patterns = lines.map((line) => line.split(/\s+/)[0] ?? '');

function owns(file: string): boolean {
  return patterns.some((pattern) => {
    const anchored = pattern.replace(/^\//, '');
    return anchored.endsWith('/') ? file.startsWith(anchored) : file === anchored;
  });
}

const CONTROL_SURFACES = [
  '.github/workflows/ci.yml',
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  '.husky/pre-push',
  'scripts/check-dep-pinning.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'biome.json',
  'vercel.json',
  'proxy.ts',
];

describe('CODEOWNERS covers the files that decide what merges and what ships', () => {
  it.each(CONTROL_SURFACES)('%s has an owner', (file) => {
    expect(owns(file)).toBe(true);
  });

  it.each(CONTROL_SURFACES)('%s exists, so the entry cannot outlive a rename', (file) => {
    expect(existsSync(join(process.cwd(), file))).toBe(true);
  });

  it('names an owner on every line', () => {
    expect(lines.filter((line) => line.split(/\s+/).length < 2)).toEqual([]);
  });
});
