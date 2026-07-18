import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV_ALLOWLIST, hermeticEnv, NULL_DEVICE } from '../helpers/hermetic-git';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HARNESS_SYMLINKS = ['.next', 'node_modules'];
const SYMLINK_TARGET = 'target';
const SENTINEL_FILE = 'sentinel';
const EMPTY_INIT_TEMPLATE = '--template=';
const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;
const GIT_PATH_NOT_IGNORED = 1;

type Shape = 'symlink' | 'directory';
type GitResult = SpawnSyncReturns<Buffer>;

const git = (cwd: string, args: string[]) => spawnSync('git', args, { cwd, env: hermeticEnv() });

const NOT_FOUND = 'ENOENT';

const describeGitFailure = (result: GitResult) => {
  if (result.error !== undefined) {
    const spawned = `git could not be spawned: ${result.error.message}`;
    return result.error.message.includes(NOT_FOUND)
      ? `${spawned} (ENOENT means either git is not on the allowlisted PATH, or the sandbox directory is gone)`
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
      `git check-ignore on "${target}" did not answer ${GIT_PATH_IGNORED} (ignored) or ${GIT_PATH_NOT_IGNORED} (not ignored): ${describeGitFailure(result)}. Nothing was learned about the .gitignore rule here, so do not go and edit it. This throws rather than returning a value because BOTH defaults are wrong: reported as "ignored" it would green a case that proves nothing, and reported as "not ignored" it would green the positive control, which expects exactly that.`,
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
const SYMLINK_MODE = '120000';

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
      `The harness symlinks "${name}" into every agent worktree, and this .gitignore does not ignore it.\n\nWrite "/${name}", with no trailing slash. A trailing slash makes a rule directory-only, and git lstats a path without following the link, so a symlink is not a directory and a directory-only rule cannot match it.\n\nEvery rule shape, measured against git (this table is rendered from the same data the matrix in this file asserts, so it cannot drift from what git actually does):\n\n${shapeTable(name)}\n\nOther harness paths asserted here: ${siblingsOf(name)}.\n\nThe child git sees exactly these variables: ${childEnvKeys()}. Only ${ENV_ALLOWLIST.join(' and ')} are inherited from the parent; the rest come from GIT_CONFIG_ISOLATION in __tests__/helpers/hermetic-git.ts (which pins core.excludesFile=${NULL_DEVICE} via GIT_CONFIG_KEY_0, because GIT_CONFIG_GLOBAL=${NULL_DEVICE} does NOT disable ~/.config/git/ignore -- that path is a hardcoded fallback, not a config value), alongside an empty init template set here. Every one of those exists to stop a SECOND ignore source reaching git -- a foreign GIT_DIR's info/exclude, a user or system ignore file, a seeded template. If one did, this gate could read GREEN while the rule under test is broken, which is the one outcome it exists to prevent. Which specific guard closes which specific channel is not asserted anywhere, so this message does not claim it: treat the sandbox as one indivisible thing and do not relax any part of it without gating what you removed.`,
    ).toBe(true);
  });

  it.each(HARNESS_SYMLINKS)(
    '%s and its contents stay ignored when it is a real directory',
    (name) => {
      const directoryIgnored = isIgnored(sandboxes.directory, name);
      const contentsIgnored = isIgnored(sandboxes.directory, `${name}/${SENTINEL_FILE}`);

      expect(
        directoryIgnored && contentsIgnored,
        `The rule for "${name}" must keep ignoring the REAL ${name} directory and everything inside it. In the main tree ${name} is a real directory, not the symlink the sibling case covers. Measured here: directory ignored = ${directoryIgnored}, contents ignored = ${contentsIgnored}.\n\nIf BOTH are false, nothing leaves ${name} ignored and everything inside it becomes committable. Do not read that as "the rule is missing" -- grep first, because a rule can be present and still lose: measured, "/${name}" followed by a negation "!/${name}/" re-includes the directory and stages its contents. Either way this is the outcome the case exists to prevent, and it is the direction a well-meaning edit to the symlink case can silently break.\n\nIf only the directory is false, the rule matches below ${name} but not ${name} itself -- the "/${name}/**" shape. Nothing under the real directory becomes committable then, because its contents are still ignored. The worktree symlink does, though: measured, "/${name}/**" leaves the symlink unignored and "git add" stages it as a symlink blob holding an absolute path to one machine. So the sibling case above is red too, and it is the one to fix.\n\nEvery rule shape, measured against git (rendered from the same data the matrix in this file asserts, so it cannot drift):\n\n${shapeTable(name)}\n\nNote what that table says about the leading "/": an unanchored "${name}" satisfies this case and the symlink case too. The anchor is not what those cases hold. It is there to stop the rule matching a nested ${name} at any depth, which is the only column that tells the two apart.`,
      ).toBe(true);
    },
  );

  it('a tracked file is NOT ignored, so the sandbox can still tell the cases apart', () => {
    expect(
      isIgnored(sandboxes.symlink, TRACKED_FILE),
      `The sandbox reports "${TRACKED_FILE}" as ignored, which means it would report almost anything as ignored -- a .gitignore with a stray "*" does exactly that. Both cases above would then pass while proving nothing, because they only ever ask "is this path ignored?" and the answer had become yes for everything. This is the positive control: it is the assertion that keeps a green run meaningful.`,
    ).toBe(false);
  });
});

const RULE = 'X';
const NESTED_DIR = 'nested';
const NEGATED = `/${RULE}\n!/${RULE}/`;

type Materialisation = 'symlink' | 'directory' | 'nested';

const makeRuleSandbox = (rule: string, as: Materialisation) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gitignore-rule-'));
  const init = git(dir, ['init', '-q', EMPTY_INIT_TEMPLATE]);
  if (init.status !== GIT_OK) {
    throw new Error(`git init failed in the rule sandbox: ${describeGitFailure(init)}.`);
  }
  writeFileSync(path.join(dir, '.gitignore'), `${rule}\n`);
  if (as === 'symlink') {
    mkdirSync(path.join(dir, SYMLINK_TARGET));
    symlinkSync(SYMLINK_TARGET, path.join(dir, RULE));
  } else if (as === 'directory') {
    mkdirSync(path.join(dir, RULE));
    writeFileSync(path.join(dir, RULE, SENTINEL_FILE), '');
  } else {
    mkdirSync(path.join(dir, NESTED_DIR, RULE), { recursive: true });
    writeFileSync(path.join(dir, NESTED_DIR, RULE, SENTINEL_FILE), '');
  }
  return dir;
};

const withRuleSandbox = <T>(rule: string, as: Materialisation, use: (dir: string) => T): T => {
  const dir = makeRuleSandbox(rule, as);
  try {
    return use(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// [rule, symlink, directory, contents, nested] -- every value measured against real git.
// The failure messages are RENDERED from this table (see shapeTable). They are not a second,
// hand-written copy of it: that is what let six false claims ship while the suite stayed green.
const RULE_MATRIX: Array<[string, boolean, boolean, boolean, boolean]> = [
  [`/${RULE}`, true, true, true, false],
  [`/${RULE}/`, false, true, true, false],
  [`/${RULE}/**`, false, false, true, false],
  [RULE, true, true, true, true],
  [NEGATED, true, false, false, false],
];

const asRuleFor = (rule: string, name: string) =>
  rule.split(RULE).join(name).split('\n').join(' + ');
const verb = (ignored: boolean) => (ignored ? 'ignores' : 'MISSES');

const shapeTable = (name: string) =>
  RULE_MATRIX.map(
    ([rule, symlink, directory, contents, nested]) =>
      `  "${asRuleFor(rule, name)}" -> ${verb(symlink)} the symlink, ${verb(directory)} the directory, ${verb(contents)} its contents, ${verb(nested)} a nested ${name}`,
  ).join('\n');

describe('meta: the rule-shape claims the failure messages make are true', () => {
  it.each(RULE_MATRIX)(
    'rule %j -> symlink=%s directory=%s contents=%s nested=%s',
    (rule, symlinkIgnored, directoryIgnored, contentsIgnored, nestedIgnored) => {
      const actual = {
        symlink: withRuleSandbox(rule, 'symlink', (dir) => isIgnored(dir, RULE)),
        directory: withRuleSandbox(rule, 'directory', (dir) => isIgnored(dir, RULE)),
        contents: withRuleSandbox(rule, 'directory', (dir) =>
          isIgnored(dir, `${RULE}/${SENTINEL_FILE}`),
        ),
        nested: withRuleSandbox(rule, 'nested', (dir) => isIgnored(dir, `${NESTED_DIR}/${RULE}`)),
      };

      expect(
        actual,
        'RULE_MATRIX no longer matches what git does. This table is not documentation: the failure messages in this file are RENDERED from it, so an engineer reading a red test is reading these exact values. Six false claims shipped in those messages while the suite stayed green, precisely because the prose was a second, hand-written copy of this data. There is one copy now -- which means a wrong row here becomes a wrong sentence there. If this fails, either git changed, or a row was edited without measuring it.',
      ).toEqual({
        symlink: symlinkIgnored,
        directory: directoryIgnored,
        contents: contentsIgnored,
        nested: nestedIgnored,
      });
    },
  );

  it('a present rule can still lose to a negation, so "no rule matches" is the wrong diagnosis', () => {
    const matchedBy = withRuleSandbox(NEGATED, 'directory', (dir) =>
      String(git(dir, ['check-ignore', '-v', '--no-index', '--', RULE]).stdout),
    );

    expect(
      matchedBy.includes(`!/${RULE}/`),
      `Under "/${RULE}" followed by "!/${RULE}/", git must report the NEGATION as the matching line. The directory-case message tells the reader not to conclude the rule is missing, because a present rule can lose -- and this is the witness for that sentence. Got: ${JSON.stringify(matchedBy)}`,
    ).toBe(true);
  });

  it('under "/X/**" the worktree symlink is stageable, which is why that shape is not harmless', () => {
    const mode = withRuleSandbox(`/${RULE}/**`, 'symlink', (dir) => {
      git(dir, ['add', '-A']);
      return String(git(dir, ['ls-files', '-s', RULE]).stdout)
        .trim()
        .split(/\s+/)[0];
    });

    expect(
      mode,
      `Under "/${RULE}/**" the symlink is left unignored, so "git add" stages it as a symlink blob (mode 120000) holding an absolute path to one machine. The directory-case message says exactly that, and says the contents are still safe -- both halves have to be true, or the message is misdirecting whoever is reading it mid-failure. Got mode: ${JSON.stringify(mode)}`,
    ).toBe(SYMLINK_MODE);
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
