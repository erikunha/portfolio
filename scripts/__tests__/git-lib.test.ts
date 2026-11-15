import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitText, showAtRef, trackedFiles } from '../lib/git';

let repo = '';

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'git-lib-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(repo, 'a.txt'), 'first\n');
  writeFileSync(join(repo, 'b.md'), 'second\n');
  git('add', 'a.txt', 'b.md');
  git('commit', '-q', '--no-verify', '-m', 'chore(test): one');
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('gitText', () => {
  it('returns trimmed stdout', () => {
    expect(gitText(['log', '-1', '--format=%s'], { cwd: repo })).toBe('chore(test): one');
  });

  it('keeps trailing whitespace when trim is off', () => {
    expect(gitText(['log', '-1', '--format=%s'], { cwd: repo, trim: false })).toBe(
      'chore(test): one\n',
    );
  });

  it('throws with the command and git stderr on failure', () => {
    expect(() => gitText(['cat-file', '-p', 'no-such-ref'], { cwd: repo })).toThrow(
      /git cat-file -p no-such-ref failed: .*no-such-ref/s,
    );
  });
});

describe('trackedFiles', () => {
  it('lists tracked files one per entry', () => {
    expect(trackedFiles(undefined, { cwd: repo })).toEqual(['a.txt', 'b.md']);
  });

  it('narrows by pathspec', () => {
    expect(trackedFiles(['*.md'], { cwd: repo })).toEqual(['b.md']);
  });
});

describe('showAtRef', () => {
  it('returns the file text at the ref', () => {
    expect(showAtRef('HEAD', 'a.txt', { cwd: repo })).toBe('first\n');
  });

  it('returns null when the path is absent at the ref', () => {
    expect(showAtRef('HEAD', 'missing.txt', { cwd: repo })).toBeNull();
  });
});
