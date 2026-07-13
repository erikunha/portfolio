import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_SYMLINKS = ['.next', 'node_modules'];
const SYMLINK_TARGET = 'target';
const SENTINEL_FILE = 'sentinel';
const NULL_DEVICE = '/dev/null';
const NO_GLOBAL_EXCLUDES = ['-c', `core.excludesFile=${NULL_DEVICE}`];
const EMPTY_INIT_TEMPLATE = '--template=';
const ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR'];
const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;

type Shape = 'symlink' | 'directory';

const hermeticEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_CONFIG_SYSTEM: NULL_DEVICE,
    GIT_CONFIG_COUNT: '0',
  };
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
};

const git = (cwd: string, args: string[]) =>
  spawnSync('git', [...NO_GLOBAL_EXCLUDES, ...args], { cwd, env: hermeticEnv() });

const isIgnored = (cwd: string, target: string) =>
  git(cwd, ['check-ignore', '-q', '--', target]).status === GIT_PATH_IGNORED;

const sandboxes: Record<Shape, string> = { symlink: '', directory: '' };

const makeSandbox = (shape: Shape) => {
  const dir = mkdtempSync(path.join(tmpdir(), `gitignore-${shape}-`));
  sandboxes[shape] = dir;

  const init = git(dir, ['init', '-q', EMPTY_INIT_TEMPLATE]);
  if (init.status !== GIT_OK) {
    throw new Error(
      `git init failed in the ${shape} sandbox (exit ${init.status}): ${init.stderr}. Every case below would then red for that reason while blaming the .gitignore rule.`,
    );
  }

  copyFileSync(path.join(REPO_ROOT, '.gitignore'), path.join(dir, '.gitignore'));
  mkdirSync(path.join(dir, SYMLINK_TARGET));
  for (const name of HARNESS_SYMLINKS) {
    if (shape === 'symlink') {
      symlinkSync(SYMLINK_TARGET, path.join(dir, name));
      continue;
    }
    mkdirSync(path.join(dir, name));
    writeFileSync(path.join(dir, name, SENTINEL_FILE), '');
  }
};

beforeAll(() => {
  makeSandbox('symlink');
  makeSandbox('directory');
});

afterAll(() => {
  for (const dir of Object.values(sandboxes)) {
    if (dir !== '') rmSync(dir, { recursive: true, force: true });
  }
});

const siblingsOf = (name: string) => HARNESS_SYMLINKS.filter((other) => other !== name).join(', ');

describe('meta: .gitignore covers the paths the agent-worktree harness symlinks', () => {
  it.each(HARNESS_SYMLINKS)('%s is ignored when materialised as a symlink', (name) => {
    expect(
      isIgnored(sandboxes.symlink, name),
      `The harness symlinks "${name}" into every agent worktree, and this .gitignore does not ignore it.\n\nGit lstats a path and never follows the link, so a symlink is not a directory: a directory-only rule ("/${name}/", with a trailing slash) cannot match it. The worktree then carries a phantom "?? ${name}" that no rule covers and that a "git clean -fd" would delete, severing the link to the main tree. Write "/${name}" instead — slashless, root-anchored — which matches a real directory and a symlink alike.\n\nCompare against the other harness symlink (${siblingsOf(name)}). If that one is green and this is red, the difference is in this rule alone: either it grew a trailing slash, or it is missing entirely.\n\nThis sandbox is deliberately hermetic. The child git runs with an ALLOWLISTED environment (${ENV_ALLOWLIST.join(', ')}), with the global and system config files pointed at ${NULL_DEVICE}, with core.excludesFile pinned, and with an empty init template. Every one of those is a second ignore source that could mask a broken rule and turn this gate green while the rule is still wrong. GIT_DIR is the one that bites: git exports it into hook processes and this suite runs from pre-push, so an inherited GIT_DIR makes check-ignore read the REAL repo's .git/info/exclude instead of this sandbox's, and a developer who ever parked "${name}" there would never see this test fail. The allowlist drops it, rather than out-ranking it -- removal does not depend on git's config precedence staying what it is today.`,
    ).toBe(true);
  });

  it.each(
    HARNESS_SYMLINKS,
  )('%s and its contents stay ignored when it is a real directory', (name) => {
    const directoryIgnored = isIgnored(sandboxes.directory, name);
    const contentsIgnored = isIgnored(sandboxes.directory, `${name}/${SENTINEL_FILE}`);

    expect(
      directoryIgnored && contentsIgnored,
      `The rule for "${name}" must keep ignoring the REAL ${name} directory and everything inside it. Measured here: directory ignored = ${directoryIgnored}, contents ignored = ${contentsIgnored}.\n\nIn the main tree ${name} is a real directory, not the symlink the sibling case covers. If this regresses, its contents become committable — build output in the case of .next, the entire dependency tree in the case of node_modules. That is a far worse outcome than the phantom untracked symlink, and it is the direction a well-meaning edit to the symlink case can silently break, so it is asserted rather than assumed.\n\nRoot-anchored and slashless ("/${name}") is the form that satisfies every case in this file: a directory-only "/${name}/" misses the symlink, "/${name}/**" would match the contents but not the directory itself, and an unanchored "${name}" would satisfy all of them but also match at every depth, which is wider than intended.`,
    ).toBe(true);
  });
});
