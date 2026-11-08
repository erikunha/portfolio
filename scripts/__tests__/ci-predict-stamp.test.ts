import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkStamp, fingerprint, readTree, stampText } from '../lib/ci-predict-stamp';

const TREE = { head: 'a'.repeat(40), diff: '', untracked: [] as string[] };

describe('build stamp', () => {
  const stamp = stampText({ fingerprint: fingerprint(TREE), buildId: 'build-1' });

  it('accepts a .next that was built from this exact tree', () => {
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: 'build-1' })).toEqual({
      valid: true,
      reason: '',
    });
  });

  it('refuses a .next with no stamp, such as one a dev server or another tool wrote', () => {
    const result = checkStamp(undefined, { fingerprint: fingerprint(TREE), buildId: 'build-1' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('without --skip-build');
  });

  it('refuses a .next built from another commit', () => {
    const other = fingerprint({ ...TREE, head: 'b'.repeat(40) });
    const result = checkStamp(stamp, { fingerprint: other, buildId: 'build-1' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('another tree');
  });

  it('refuses a .next built before a tracked edit or a new untracked file', () => {
    for (const changed of [
      { ...TREE, diff: '+edit' },
      { ...TREE, untracked: ['new-file.ts'] },
    ]) {
      expect(
        checkStamp(stamp, { fingerprint: fingerprint(changed), buildId: 'build-1' }).valid,
      ).toBe(false);
    }
  });

  it('refuses a .next whose build id changed after the stamp, or that has none', () => {
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: 'build-2' }).valid).toBe(
      false,
    );
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: undefined }).valid).toBe(
      false,
    );
  });

  it('refuses a stamp it cannot read', () => {
    expect(
      checkStamp('{not json', { fingerprint: fingerprint(TREE), buildId: 'build-1' }).valid,
    ).toBe(false);
  });
});

describe('readTree', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function repo(): { dir: string; head: string; git: (...args: string[]) => string } {
    const dir = mkdtempSync(join(tmpdir(), 'ci-predict-stamp-'));
    dirs.push(dir);
    const git = (...args: string[]) =>
      spawnSync(
        'git',
        [
          '-c',
          'user.email=t@t',
          '-c',
          'user.name=t',
          '-c',
          'commit.gpgsign=false',
          '-c',
          'core.hooksPath=/dev/null',
          ...args,
        ],
        { cwd: dir, encoding: 'utf8' },
      ).stdout.trim();
    git('init', '--quiet');
    writeFileSync(join(dir, 'tracked.bin'), Buffer.from([0, 1, 2, 3]));
    writeFileSync(join(dir, 'tracked.ts'), 'export {};\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'init');
    return { dir, head: git('rev-parse', 'HEAD'), git };
  }

  const stamped = (dir: string, head: string) => fingerprint(readTree(dir, head));

  it('is stable while nothing changes', () => {
    const { dir, head } = repo();
    writeFileSync(join(dir, 'new.ts'), 'one');
    expect(stamped(dir, head)).toBe(stamped(dir, head));
  });

  it('changes when an untracked file is edited after the stamp, not only when one appears', () => {
    const { dir, head } = repo();
    writeFileSync(join(dir, 'new.ts'), 'one');
    const before = stamped(dir, head);
    writeFileSync(join(dir, 'new.ts'), 'two');
    expect(stamped(dir, head)).not.toBe(before);
  });

  it('changes when a tracked binary file is edited to different bytes', () => {
    const { dir, head } = repo();
    writeFileSync(join(dir, 'tracked.bin'), Buffer.from([0, 9, 9, 9]));
    const first = stamped(dir, head);
    writeFileSync(join(dir, 'tracked.bin'), Buffer.from([0, 8, 8, 8]));
    expect(stamped(dir, head)).not.toBe(first);
  });

  it('ignores a file that git ignores', () => {
    const { dir, head } = repo();
    writeFileSync(join(dir, '.gitignore'), 'out.log\n');
    const before = stamped(dir, head);
    writeFileSync(join(dir, 'out.log'), 'noise');
    expect(stamped(dir, head)).toBe(before);
  });
});
