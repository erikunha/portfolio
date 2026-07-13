import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_SYMLINKS = ['.next', 'node_modules'];
const SYMLINK_TARGET = 'target';
const BUILD_ARTIFACT = 'BUILD_ID';
const NO_GLOBAL_EXCLUDES = ['-c', 'core.excludesFile=/dev/null'];
const EMPTY_INIT_TEMPLATE = '--template=';
const INHERITED_GIT_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_TEMPLATE_DIR',
];
const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;

const hermeticEnv = () => {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_COUNT: '0' };
  for (const key of INHERITED_GIT_VARS) delete env[key];
  return env;
};

const git = (cwd: string, args: string[]) =>
  spawnSync('git', [...NO_GLOBAL_EXCLUDES, ...args], { cwd, env: hermeticEnv() });

const isIgnored = (cwd: string, target: string) =>
  git(cwd, ['check-ignore', '-q', '--', target]).status === GIT_PATH_IGNORED;

const makeSandbox = (shape: 'symlink' | 'directory') => {
  const dir = mkdtempSync(path.join(tmpdir(), `gitignore-${shape}-`));
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
    writeFileSync(path.join(dir, name, BUILD_ARTIFACT), '');
  }
  return dir;
};

const sandboxes: Record<'symlink' | 'directory', string> = { symlink: '', directory: '' };

beforeAll(() => {
  sandboxes.symlink = makeSandbox('symlink');
  sandboxes.directory = makeSandbox('directory');
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
      `The harness symlinks "${name}" into every agent worktree, and this .gitignore does not ignore it.\n\nA trailing slash makes a rule directory-only. Git lstats the path and never follows the link, so a symlink is not a directory and "/${name}/" cannot match it. The worktree then carries a phantom "?? ${name}" that no rule covers and that a "git clean -fd" would delete, severing the link to the main tree. Write "/${name}" instead: the slashless form matches a real directory and a symlink alike.\n\nCompare against the other harness symlink (${siblingsOf(name)}). If that one is green and this is red, a trailing slash is the whole difference. If they are ALL red, the rules were tidied together and the slash has to come off each of them.\n\nThis sandbox is deliberately hermetic: it pins core.excludesFile, inits with an empty template, and scrubs ${INHERITED_GIT_VARS.join('/')} from the environment. Each of those is a second ignore source that can mask a broken rule and turn this gate green while the repo rule is still wrong. GIT_DIR matters most: git exports it into hook processes, and this suite runs from pre-push, so without the scrub check-ignore reads the real repo's .git/info/exclude instead of this sandbox's.`,
    ).toBe(true);
  });

  it.each(
    HARNESS_SYMLINKS,
  )('%s and its contents stay ignored when it is a real directory', (name) => {
    const directoryIgnored = isIgnored(sandboxes.directory, name);
    const contentsIgnored = isIgnored(sandboxes.directory, `${name}/${BUILD_ARTIFACT}`);

    expect(
      directoryIgnored && contentsIgnored,
      `Dropping the trailing slash from "/${name}/" must not stop ignoring the REAL ${name} directory or anything inside it. In the main tree ${name} is a real directory, not a symlink, and it holds build output — if this regresses, build artifacts become committable, which is a far worse failure than the phantom untracked symlink the sibling case guards.\n\nThis is the direction a "fix" to the symlink case can silently break, so it is asserted rather than assumed: directory ignored = ${directoryIgnored}, contents ignored = ${contentsIgnored}. A rule of the form "/${name}/**" would satisfy the contents but not the directory; a rule of the form "${name}" (unanchored) would match at every depth. The slashless root-anchored "/${name}" is the only form that holds all three cases.`,
    ).toBe(true);
  });
});
