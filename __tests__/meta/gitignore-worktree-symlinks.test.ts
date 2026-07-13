import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_SYMLINKS = ['.next', 'node_modules'];
const SYMLINK_TARGET = 'target';
const GIT_MATCHED = 0;

let sandbox = '';

beforeAll(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'gitignore-symlink-'));
  spawnSync('git', ['init', '-q'], { cwd: sandbox });
  copyFileSync(path.join(REPO_ROOT, '.gitignore'), path.join(sandbox, '.gitignore'));
  mkdirSync(path.join(sandbox, SYMLINK_TARGET));
  for (const name of HARNESS_SYMLINKS) {
    symlinkSync(SYMLINK_TARGET, path.join(sandbox, name));
  }
});

afterAll(() => {
  if (sandbox !== '') rmSync(sandbox, { recursive: true, force: true });
});

const isIgnored = (name: string) =>
  spawnSync('git', ['check-ignore', '-q', name], { cwd: sandbox }).status === GIT_MATCHED;

describe('meta: .gitignore covers the paths the agent-worktree harness symlinks', () => {
  it.each(HARNESS_SYMLINKS)('%s is ignored when materialised as a symlink', (name) => {
    expect(
      isIgnored(name),
      `A trailing slash makes a .gitignore rule directory-only, and the agent-worktree harness materialises this path as a SYMLINK into every worktree, not as a directory. Git does not follow the link to discover it points at a directory, so a "/${name}/" rule misses it and reports it untracked forever.\n\nThat is not cosmetic: it leaves every agent worktree permanently dirty on a file the HARNESS itself created, so the harness never sees a worktree as unchanged and its auto-clean never fires. Sixteen worktrees and 167MB had accumulated when this was found, and the leak grows with every subagent dispatch. It is also why worktree isolation looked too expensive to adopt for the review battery.\n\nThe control is in the same file: node_modules is symlinked by the same harness and IS ignored, because its rule carries no trailing slash. Write "/${name}", not "/${name}/" — the slashless form matches a real directory and a symlink alike.`,
    ).toBe(true);
  });
});
