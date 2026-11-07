import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (args: string[]) =>
  spawnSync('pnpm', ['exec', 'tsx', 'scripts/ci-predict.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

describe('ci-predict command line', () => {
  it('explains itself and exits cleanly on --help', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--linux');
  });

  it('refuses an unknown flag instead of ignoring it', () => {
    const result = run(['--lnux']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown argument --lnux');
  });

  it('has nothing to predict when HEAD is the base, instead of failing commitlint on an empty range', () => {
    const result = run(['--list', '--base', 'HEAD']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no commits ahead of');
  });
});
