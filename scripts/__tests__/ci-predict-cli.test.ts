import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const DRY_RUN_TIMEOUT_MS = 180_000;
const CLI_TIMEOUT_MS = 60_000;
const hasParentCommit =
  spawnSync('git', ['rev-parse', '--verify', 'HEAD~1'], { stdio: 'ignore' }).status === 0;

const run = (args: string[]) =>
  spawnSync('pnpm', ['exec', 'tsx', 'scripts/ci-predict.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

describe('ci-predict command line', { timeout: CLI_TIMEOUT_MS }, () => {
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

  it('lists the exit codes so a caller can tell a dry run from a pass', () => {
    const result = run(['--help']);
    expect(result.stdout).toContain('dry run');
    expect(result.stdout).toContain('Exit code');
  });

  it.skipIf(!hasParentCommit)(
    'a dry run says DRY RUN and exits 2, and never claims that no failure was found',
    () => {
      const result = run(['--list', '--base', 'HEAD~1']);
      expect(result.stdout).toContain('DRY RUN');
      expect(result.stdout).not.toContain('no failure found');
      expect(result.status).toBe(2);
    },
    DRY_RUN_TIMEOUT_MS,
  );

  it('verifies nothing when HEAD is the base: exit 3, never the 0 that means verified', () => {
    const result = run(['--list', '--base', 'HEAD']);
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('no commits ahead of');
    expect(result.stdout).toContain('NOT VERIFIED');
  });

  it('documents the empty range exit code in its usage text', () => {
    expect(run(['--help']).stdout).toMatch(/no commits ahead[^\n]*3|3[^\n]*no commits ahead/);
  });
});
