import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-dep-pinning.mjs');

function runOn(pkg: object): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'deppin-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  try {
    const out = execFileSync('node', [SCRIPT, join(dir, 'package.json')], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe('check-dep-pinning', () => {
  it('passes when every dependency is caret/tilde major-locked', () => {
    const r = runOn({
      dependencies: { next: '~16.2.6', react: '~19.2.0', clsx: '^2.1.1' },
      devDependencies: {},
    });
    expect(r.code).toBe(0);
  });

  it('fails when a dependency is "latest"', () => {
    const r = runOn({ dependencies: { next: 'latest' }, devDependencies: {} });
    expect(r.code).toBe(1);
    expect(r.out).toContain('next');
  });

  it('fails when a dependency is the "*" wildcard', () => {
    const r = runOn({ dependencies: {}, devDependencies: { typescript: '*' } });
    expect(r.code).toBe(1);
    expect(r.out).toContain('typescript');
  });

  it('fails when a stable dependency is pinned to an exact version', () => {
    const r = runOn({ dependencies: { clsx: '2.1.1' }, devDependencies: {} });
    expect(r.code).toBe(1);
    expect(r.out).toContain('clsx');
  });

  it('allows an exact pin only for a prerelease build, which no range can match', () => {
    const r = runOn({
      dependencies: {},
      devDependencies: { '@typescript/native-preview': '7.0.0-dev.20260707.2' },
    });
    expect(r.code).toBe(0);
  });

  it('requires a tilde range for a package whose minor releases break this repo', () => {
    const r = runOn({ dependencies: { zod: '^4.4.3' }, devDependencies: {} });
    expect(r.code).toBe(1);
    expect(r.out).toContain('zod');
  });
});
