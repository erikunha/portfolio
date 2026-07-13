import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
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
const GIT_PATH_NOT_IGNORED = 1;

type Shape = 'symlink' | 'directory';
type GitResult = SpawnSyncReturns<Buffer>;

const hermeticEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
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

const NOT_FOUND = 'ENOENT';

const describeGitFailure = (result: GitResult) => {
  if (result.error !== undefined) {
    const spawned = `git could not be spawned: ${result.error.message}`;
    return result.error.message.includes(NOT_FOUND)
      ? `${spawned} (the child gets an allowlisted PATH, and git is not reachable on it)`
      : spawned;
  }
  if (result.signal !== null) {
    return `git was killed by ${result.signal} before it could answer`;
  }
  return `git exited ${result.status}: ${String(result.stderr).trim()}`;
};

const gitAnswered = (result: GitResult) =>
  result.error === undefined &&
  result.signal === null &&
  (result.status === GIT_PATH_IGNORED || result.status === GIT_PATH_NOT_IGNORED);

const isIgnored = (cwd: string, target: string) => {
  const result = git(cwd, ['check-ignore', '-q', '--', target]);
  if (!gitAnswered(result)) {
    throw new Error(
      `git check-ignore on "${target}" did not answer ${GIT_PATH_IGNORED} (ignored) or ${GIT_PATH_NOT_IGNORED} (not ignored): ${describeGitFailure(result)}. Nothing was learned about the .gitignore rule here, so do not go and edit it: reporting this as "not ignored" would red the assertion below and send you after a rule that may be fine.`,
    );
  }
  return result.status === GIT_PATH_IGNORED;
};

const sandboxes: Record<Shape, string> = { symlink: '', directory: '' };

const makeSandbox = (shape: Shape) => {
  const dir = mkdtempSync(path.join(tmpdir(), `gitignore-${shape}-`));
  sandboxes[shape] = dir;

  const init = git(dir, ['init', '-q', EMPTY_INIT_TEMPLATE]);
  if (init.status !== GIT_OK) {
    throw new Error(
      `git init failed in the ${shape} sandbox: ${describeGitFailure(init)}. No case below can run against this sandbox.`,
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

const TRACKED_FILE = 'package.json';

const gitResult = (over: Partial<GitResult>): GitResult => ({
  pid: 0,
  output: [],
  stdout: Buffer.from(''),
  stderr: Buffer.from(''),
  status: GIT_PATH_IGNORED,
  signal: null,
  ...over,
});

const FAILURE_SHAPES: Array<[string, GitResult, string]> = [
  [
    'binary missing',
    gitResult({ status: null, error: new Error('spawnSync git ENOENT') }),
    'ENOENT',
  ],
  [
    'permission denied',
    gitResult({ status: null, error: new Error('spawnSync git EACCES') }),
    'EACCES',
  ],
  ['killed by a signal', gitResult({ status: null, signal: 'SIGKILL' }), 'SIGKILL'],
  [
    'git ran and refused',
    gitResult({ status: 128, stderr: Buffer.from('fatal: not a git repository') }),
    'not a git repository',
  ],
];

describe('meta: .gitignore covers the paths the agent-worktree harness symlinks', () => {
  it.each(HARNESS_SYMLINKS)('%s is ignored when materialised as a symlink', (name) => {
    expect(
      isIgnored(sandboxes.symlink, name),
      `The harness symlinks "${name}" into every agent worktree, and this .gitignore does not ignore it.\n\nWrite "/${name}", with no trailing slash. A trailing slash makes a rule directory-only, and git lstats a path without following the link, so a symlink is not a directory and "/${name}/" cannot match it. Measured: "/${name}" matches the symlink, the real directory, and the directory's contents; "/${name}/" misses the symlink; "/${name}/**" misses the symlink and the directory. The sibling case in this file asserts the directory and its contents, so read it before widening this rule.\n\nOther harness paths asserted here: ${siblingsOf(name)}.\n\nThe child git sees exactly these variables: ${childEnvKeys()}. Only ${ENV_ALLOWLIST.join(' and ')} are inherited; the rest are injected here, alongside an empty init template and core.excludesFile=${NULL_DEVICE}. That is deliberate. An ambient ignore source -- a foreign GIT_DIR's info/exclude, a seeded template, a user or system ignore file -- is a SECOND place "${name}" could get ignored, and this gate would then read GREEN while the rule under test is broken. Relax the sandbox and this test can start passing for a reason that has nothing to do with .gitignore.`,
    ).toBe(true);
  });

  it.each(
    HARNESS_SYMLINKS,
  )('%s and its contents stay ignored when it is a real directory', (name) => {
    const directoryIgnored = isIgnored(sandboxes.directory, name);
    const contentsIgnored = isIgnored(sandboxes.directory, `${name}/${SENTINEL_FILE}`);

    expect(
      directoryIgnored && contentsIgnored,
      `The rule for "${name}" must keep ignoring the REAL ${name} directory and everything inside it. In the main tree ${name} is a real directory, not the symlink the sibling case covers. Measured here: directory ignored = ${directoryIgnored}, contents ignored = ${contentsIgnored}.\n\nIf BOTH are false, no rule matches ${name} at all and everything inside it becomes committable. That is the outcome this case exists to prevent, and it is the direction a well-meaning edit to the symlink case can silently break.\n\nIf only the directory is false, the rule matches below ${name} but not ${name} itself -- the "/${name}/**" shape. Nothing becomes committable then, because the contents are still ignored. But that shape does not match a symlink either, so the sibling case above is red too, and that is the one to fix.\n\nMeasured forms: "/${name}" satisfies this case and the symlink case; "/${name}/" misses the symlink; "/${name}/**" misses the symlink and this directory. An unanchored "${name}" satisfies all of them as well -- so nothing in this file holds the leading "/". The anchor is there to stop the rule matching a nested ${name} at any depth, and no test here asserts that.`,
    ).toBe(true);
  });

  it('a tracked file is NOT ignored, so the sandbox can still tell the cases apart', () => {
    expect(
      isIgnored(sandboxes.symlink, TRACKED_FILE),
      `The sandbox reports "${TRACKED_FILE}" as ignored, which means it would report almost anything as ignored -- a .gitignore with a stray "*" does exactly that. Both cases above would then pass while proving nothing, because they only ever ask "is this path ignored?" and the answer had become yes for everything. This is the positive control: it is the assertion that keeps a green run meaningful.`,
    ).toBe(false);
  });
});

describe('meta: the gate says what actually went wrong when git does not answer', () => {
  it.each(FAILURE_SHAPES)('%s is named in the message', (_shape, result, expected) => {
    const described = describeGitFailure(result);

    expect(
      described.includes(expected),
      `describeGitFailure() rendered "${described}", which does not name "${expected}".\n\nThese messages are the only thing a future engineer reads when this gate reds, and NO passing run ever renders them -- which is exactly why they drifted through six review rounds while the suite stayed green. They are asserted here so they cannot drift again.`,
    ).toBe(true);

    expect(
      described.includes('null') || described.includes('undefined'),
      `describeGitFailure() rendered "${described}". A message that says "null" has told the reader nothing: spawnSync reports status=null for BOTH a missing binary and a signal-killed child, and stderr is null in both. Read result.error and result.signal instead.`,
    ).toBe(false);
  });

  it.each(FAILURE_SHAPES)('%s counts as git not having answered', (_shape, result) => {
    expect(
      gitAnswered(result),
      `gitAnswered() accepted a result where git did not answer. Only exit ${GIT_PATH_IGNORED} (ignored) and exit ${GIT_PATH_NOT_IGNORED} (not ignored) are answers. Accepting anything else lets a broken sandbox be read as a verdict on the .gitignore rule -- and if it were read as "ignored", this gate would go GREEN while the rule under test is broken.`,
    ).toBe(false);
  });

  it.each([
    ['ignored', GIT_PATH_IGNORED],
    ['not ignored', GIT_PATH_NOT_IGNORED],
  ])('a real answer (%s) is not mistaken for a failure', (_label, status) => {
    expect(
      gitAnswered(gitResult({ status })),
      `gitAnswered() rejected exit ${status}, which is a genuine answer from git. Rejecting it would make the gate throw on a legitimate result -- the false-positive mirror of the fail-open, and the thing that trains people to disable a gate.`,
    ).toBe(true);
  });
});
