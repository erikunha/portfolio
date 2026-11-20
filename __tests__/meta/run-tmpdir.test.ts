import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import setupRunTmpdir, { RUN_TMPDIR_PREFIX } from '../../tests/global-tmpdir';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

describe('every test run writes its temp files under one run-owned directory', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('points os.tmpdir() at the run directory, not the shared system temp folder', () => {
    expect(basename(tmpdir())).toMatch(new RegExp(`^${RUN_TMPDIR_PREFIX}`));
    expect(existsSync(tmpdir())).toBe(true);
  });

  it('hands the same directory to child processes the tests spawn', () => {
    const child = spawnSync('node', ['-e', 'process.stdout.write(require("node:os").tmpdir())'], {
      encoding: 'utf8',
    });
    expect(child.status).toBe(0);
    expect(child.stdout).toBe(tmpdir());
  });

  it('removes the run directory and everything a test left in it at teardown', () => {
    const outer = process.env.TMPDIR;
    const parent = mkdtempSync(join(tmpdir(), 'outer-'));
    process.env.TMPDIR = parent;
    let runDir = '';
    try {
      const teardown = setupRunTmpdir();
      runDir = tmpdir();
      expect(dirname(runDir)).toBe(parent);
      const leaked = mkdtempSync(join(runDir, 'leaked-'));
      writeFileSync(join(leaked, 'file.txt'), 'left behind');
      teardown();
      expect(existsSync(runDir)).toBe(false);
      expect(process.env.TMPDIR).toBe(parent);
    } finally {
      process.env.TMPDIR = outer;
    }
  });

  it('adds no second run directory when it already runs inside one', () => {
    const before = tmpdir();
    const teardown = setupRunTmpdir();
    const prefixSegments = tmpdir()
      .split(sep)
      .filter((segment) => segment.startsWith(RUN_TMPDIR_PREFIX));

    expect(tmpdir()).toBe(before);
    expect(prefixSegments).toHaveLength(1);

    teardown();

    expect(existsSync(before)).toBe(true);
    expect(tmpdir()).toBe(before);
  });
});
