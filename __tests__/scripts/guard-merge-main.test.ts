import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'guard-merge-main.mjs');
const BLOCK_EXIT_CODE = 2;

let dir: string;

const stubGh = (stdout: string, exitCode: number) => {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const file = join(bin, 'gh');
  writeFileSync(
    file,
    `#!/bin/sh\necho "$@" >> "${join(dir, 'calls')}"\nprintf '%s' "${stdout}"\nexit ${exitCode}\n`,
  );
  chmodSync(file, 0o755);
};

const run = (command: string) =>
  spawnSync('node', [SCRIPT], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, 'bin')}${delimiter}${process.env.PATH}` },
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guard-merge-main-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('guard-merge-main hook', () => {
  it('blocks a merge whose PR targets main', () => {
    stubGh('main', 0);
    const result = run('gh pr merge 369 --squash');
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('targets main');
  });

  it('allows a merge whose PR targets an integration branch', () => {
    stubGh('feat/terminal-redesign', 0);
    expect(run('gh pr merge 369 --squash --delete-branch').status).toBe(0);
  });

  it('fails closed when the base cannot be determined', () => {
    stubGh('', 1);
    const result = run('gh pr merge 369');
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('could not be determined');
  });

  it('fails closed when gh is not installed', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ tool_input: { command: 'gh pr merge 1' } }),
      encoding: 'utf8',
      env: { ...process.env, PATH: join(dir, 'empty') },
    });
    expect(result.status).toBe(BLOCK_EXIT_CODE);
  });

  it('checks the merge inside a compound command', () => {
    stubGh('main', 0);
    expect(run('pnpm ci:local && gh pr merge 7 --squash').status).toBe(BLOCK_EXIT_CODE);
  });

  it('passes the selector and repo to gh and skips flag values', () => {
    stubGh('feat/x', 0);
    run('gh pr merge --body "ready" -R owner/repo https://github.com/owner/repo/pull/9');
    const calls = spawnSync('cat', [join(dir, 'calls')], { encoding: 'utf8' }).stdout;
    expect(calls).toContain('pr view https://github.com/owner/repo/pull/9 --repo owner/repo');
  });

  it('ignores commands that are not a PR merge without calling gh', () => {
    stubGh('main', 0);
    expect(run('gh pr view 369').status).toBe(0);
    expect(run('git status').status).toBe(0);
    expect(spawnSync('test', ['-e', join(dir, 'calls')]).status).not.toBe(0);
  });
});
