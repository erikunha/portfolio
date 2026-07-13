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
const ENV_ALLOWLIST = ['PATH', 'TMPDIR'];
const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;

type Shape = 'symlink' | 'directory';

const hermeticEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_CONFIG_SYSTEM: NULL_DEVICE,
    GIT_CONFIG_NOSYSTEM: '1',
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
const childEnvKeys = () => Object.keys(hermeticEnv()).sort().join(', ');

describe('meta: .gitignore covers the paths the agent-worktree harness symlinks', () => {
  it.each(HARNESS_SYMLINKS)('%s is ignored when materialised as a symlink', (name) => {
    expect(
      isIgnored(sandboxes.symlink, name),
      `The harness symlinks "${name}" into every agent worktree, and this .gitignore does not ignore it.\n\nGit lstats a path and never follows the link, so a symlink is not a directory: a directory-only rule ("/${name}/", with a trailing slash) cannot match it. The worktree then carries a phantom "?? ${name}" that no rule covers and that a "git clean -fd" would delete, severing the link to the main tree. Write "/${name}" instead — slashless, root-anchored — which matches a real directory and a symlink alike.\n\nCompare against the other harness path here (${siblingsOf(name)}). If any of those is green while this is red, the difference is in this rule alone: either it grew a trailing slash, or it went missing.\n\nThis sandbox is deliberately hermetic, because a SECOND ignore source can mask a broken rule and turn this gate GREEN while the rule is still wrong -- the one outcome it exists to prevent. The child git therefore runs on an allowlisted environment (${childEnvKeys()}), so every variable that could point it at another ignore file is absent rather than out-ranked: GIT_DIR (a foreign .git/info/exclude), GIT_TEMPLATE_DIR (a seeded one), the GIT_CONFIG_KEY_n pairs, and HOME / XDG_CONFIG_HOME (~/.config/git/ignore). Each was measured: point any one of them at a file listing "${name}", and a NON-hermetic check reports a broken rule as ignored. core.excludesFile is still pinned to ${NULL_DEVICE} and the init template is empty, but nothing depends on those any more -- removal does not rely on git's config precedence staying what it is today.`,
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
