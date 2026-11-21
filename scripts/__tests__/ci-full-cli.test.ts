import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOT_RUN, STAGES } from '../ci/ci-full-stages';

const CLI_TIMEOUT_MS = 60_000;
const USAGE_EXIT = 2;
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const run = (args: string[]) =>
  spawnSync('pnpm', ['exec', 'tsx', 'scripts/ci/ci-full.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

describe('ci:full command line', { timeout: CLI_TIMEOUT_MS }, () => {
  it('is what the package script runs', () => {
    expect(pkg.scripts['ci:full']).toBe('tsx scripts/ci/ci-full.ts');
  });

  it('lists every stage in order, then every declared not-run check with its reason, and runs nothing', () => {
    const result = run(['--list']);
    expect(result.status).toBe(0);
    const lines = result.stdout.split('\n');
    const positions = STAGES.map((stage) => lines.findIndex((line) => line.includes(stage.id)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const entry of NOT_RUN) {
      expect(result.stdout).toContain(entry.id);
      expect(result.stdout).toContain(entry.reason);
    }
    expect(result.stdout).toContain('not-run');
  });

  it('says that a listing verified nothing', () => {
    expect(run(['--list']).stdout).toContain('nothing was run');
  });

  it('refuses an unknown flag instead of ignoring it', () => {
    const result = run(['--lnux']);
    expect(result.status).toBe(USAGE_EXIT);
    expect(result.stderr).toContain('unknown argument --lnux');
  });

  it('refuses a resume stage that does not exist and names the stages', () => {
    const result = run(['--from', 'nope']);
    expect(result.status).toBe(USAGE_EXIT);
    expect(result.stderr).toContain('nope');
    expect(result.stderr).toContain(STAGES[0]?.id);
  });

  it('refuses a base that git does not know, before it runs any stage', () => {
    const result = run(['--base', 'refs/heads/definitely-not-a-ref']);
    expect(result.status).toBe(USAGE_EXIT);
    expect(result.stderr).toContain('definitely-not-a-ref');
  });

  it('explains itself on --help and lists the exit codes', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    for (const flag of ['--from', '--list', '--keep-going', '--base']) {
      expect(result.stdout).toContain(flag);
    }
    expect(result.stdout).toContain('Exit code');
  });
});
