import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import setupRunTmpdir, { RUN_TMPDIR_PREFIX } from '../../tests/global-tmpdir';

describe('every test run writes its temp files under one run-owned directory', () => {
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
    const teardown = setupRunTmpdir();
    const runDir = tmpdir();
    try {
      expect(runDir).not.toBe(outer);
      expect(dirname(runDir)).toBe(outer?.replace(/\/$/, ''));
      const leaked = mkdtempSync(join(runDir, 'leaked-'));
      writeFileSync(join(leaked, 'file.txt'), 'left behind');
    } finally {
      teardown();
    }
    expect(existsSync(runDir)).toBe(false);
    expect(process.env.TMPDIR).toBe(outer);
  });
});
