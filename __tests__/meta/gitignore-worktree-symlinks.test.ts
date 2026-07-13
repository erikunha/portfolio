import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_SYMLINKS = ['.next', 'node_modules'];
const SYMLINK_TARGET = 'target';
const NO_GLOBAL_EXCLUDES = ['-c', 'core.excludesFile=/dev/null'];
const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;

let sandbox = '';

const git = (args: string[]) =>
  spawnSync('git', [...NO_GLOBAL_EXCLUDES, ...args], { cwd: sandbox });

beforeAll(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'gitignore-symlink-'));
  const init = git(['init', '-q']);
  if (init.status !== GIT_OK) {
    throw new Error(
      `git init failed in the sandbox (exit ${init.status}): ${init.stderr}. Without this, check-ignore exits non-zero for the wrong reason and every case below reds while blaming the trailing slash.`,
    );
  }
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
  git(['check-ignore', '-q', '--', name]).status === GIT_PATH_IGNORED;

describe('meta: .gitignore covers the paths the agent-worktree harness symlinks', () => {
  it.each(HARNESS_SYMLINKS)('%s is ignored when materialised as a symlink', (name) => {
    expect(
      isIgnored(name),
      `A trailing slash makes a .gitignore rule directory-only. The agent-worktree harness materialises this path as a SYMLINK into every worktree, not as a directory, and git does not follow the link to discover what it points at — so a "/${name}/" rule never matches it and every agent sees a phantom "?? ${name}" it did not create and no rule covers. A git clean -fd in that worktree would then delete the symlink, severing its link to the main tree.\n\nThe control is in the same file: node_modules is symlinked by the same harness and IS ignored, because its rule carries no trailing slash. If node_modules is green here and this case is red, the trailing slash is the whole difference.\n\nWrite "/${name}", not "/${name}/" — the slashless form matches a real directory and a symlink alike, so the main tree keeps ignoring its real ${name} directory.\n\nThis sandbox pins core.excludesFile=/dev/null deliberately: without it the check inherits the machine's global gitignore, and since ".next" is a common entry there, a broken rule would be masked by the developer's own config and pass green.`,
    ).toBe(true);
  });
});
