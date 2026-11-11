import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hermeticEnv } from '../helpers/hermetic-git';

// Why this gate exists: the .gitignore is the only thing standing between a
// developer running `git add .` and a credential committed to a PUBLIC
// repository. The rule itself is convention; this file is the measurement.
// A .gitignore that silently stops matching is invisible -- `git status` just
// stops listing the file, and the next person concludes there is nothing
// there to worry about. So the two properties that matter are asserted here:
//
//   1. every plausible env/credential path is ignored (the rule still works)
//   2. no env/credential path is tracked, and none was EVER tracked (no leak
//      ever slipped through, and the history stays clean)
//
// Property 2 is the one gitleaks cannot cover. The gitleaks job in ci.yml
// scans history for secret PATTERNS; a committed `.env.production` whose
// values are low-entropy (a DEPLOY_SALT, a hostname, a stale token) matches no
// pattern and ships. The path-level assertion closes that hole.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const GIT_OK = 0;
const GIT_PATH_IGNORED = 0;
const GIT_PATH_NOT_IGNORED = 1;

// The dot family (`.env`, `.env.production`) and the suffix family
// (`production.env`) are TWO different shapes. `.env*` matches the first and
// NOT the second -- a single wildcard family would leave `production.env`
// stageable. Both are listed because the point of the test is that a rule
// change cannot quietly drop one family.
const ENV_PATHS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.preview',
  '.env.test',
  '.env.development',
  '.env.production.local',
  '.env.staging.local',
  '.env.example.local',
  'production.env',
  'staging.env',
  'app.env',
  'config/production.env',
  'config/.env.production',
];

const CREDENTIAL_PATHS = [
  'server.pem',
  'private.key',
  'cert.p12',
  'cert.pfx',
  'credentials.json',
  'config/service-credentials.json',
];

// The single tracked exception. It has to stay stageable: if the negation
// stops working, the file that documents every variable the project reads
// becomes un-addable, and the next contributor ships without a template.
const EXAMPLE_PATHS = ['.env.example'];

// The positive control. A sandbox that reports "ignored" for everything would
// turn every assertion above into a tautology -- including the ones that
// prove the rules work. This is what keeps a green run meaningful.
const TRACKED_FILE = 'package.json';

const git = (cwd: string, args: string[]) => spawnSync('git', args, { cwd, env: hermeticEnv() });

const gitText = (cwd: string, args: string[]): string => {
  const result = git(cwd, args);
  if (result.status !== GIT_OK) {
    throw new Error(
      `git ${args.join(' ')} exited ${String(result.status)} in ${cwd}: ${String(result.stderr).trim()}`,
    );
  }
  return result.stdout.toString();
};

const isIgnored = (cwd: string, target: string): boolean => {
  const result = git(cwd, ['check-ignore', '-q', '--', target]);
  if (result.status !== GIT_PATH_IGNORED && result.status !== GIT_PATH_NOT_IGNORED) {
    throw new Error(
      `git check-ignore on "${target}" did not answer ${GIT_PATH_IGNORED} (ignored) or ${GIT_PATH_NOT_IGNORED} (not ignored): status=${String(result.status)} stderr=${String(result.stderr).trim()}. Nothing was learned about the .gitignore rule here, so do not go and edit it. Both defaults are wrong: reported as "ignored" it would green a case that proves nothing, and reported as "not ignored" it would green the positive control, which expects exactly that.`,
    );
  }
  return result.status === GIT_PATH_IGNORED;
};

let sandbox = '';

beforeAll(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'gitignore-env-'));
  git(sandbox, ['init', '-q', '--template=']);
  copyFileSync(path.join(REPO_ROOT, '.gitignore'), path.join(sandbox, '.gitignore'));
  // The parent directories of the nested paths, so check-ignore is asked about
  // a path inside a real directory rather than one that cannot exist.
  for (const dir of ['config']) mkdirSync(path.join(sandbox, dir), { recursive: true });
});

afterAll(() => {
  if (sandbox !== '') rmSync(sandbox, { recursive: true, force: true });
});

const basename = (p: string): string => p.split('/').pop() ?? p;

// The predicate the history and index assertions share. `.env.example` is
// excluded by name because it is the tracked exception: it is a template with
// placeholder values, and the repository intends to keep it.
const isSecretBearingPath = (p: string): boolean => {
  const name = basename(p);
  if (name === '.env.example') return false;
  if (name.startsWith('.env')) return true;
  if (name.endsWith('.env')) return true;
  if (/\.(pem|key|p12|pfx)$/.test(name)) return true;
  if (/^credentials.*\.json$/.test(name)) return true;
  return false;
};

describe('meta: the .gitignore ignores every env and credential path', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it.each(ENV_PATHS)('%s is ignored', (path) => {
    expect(
      isIgnored(sandbox, path),
      `The .gitignore does not ignore "${path}".\n\nThis repository is PUBLIC. A local environment file committed here is a credential published to the internet, and the history scan that would normally catch it does not: gitleaks matches secret PATTERNS, and a low-entropy value (a DEPLOY_SALT, an internal hostname, a stale token) matches none. The path-level rule is the only thing standing in the way.\n\nBoth families are asserted on purpose: the dot family (".env", ".env.production") and the suffix family ("production.env"). A single wildcard covers only one of them, so a rule that looks comprehensive in review can still leave one shape stageable.\n\nIf you are adding a rule here, add its case to ENV_PATHS in this file too -- a rule with no case is a rule that can rot unnoticed.`,
    ).toBe(true);
  });

  it.each(CREDENTIAL_PATHS)('%s is ignored', (path) => {
    expect(
      isIgnored(sandbox, path),
      `The .gitignore does not ignore "${path}".\n\nA private key, a keystore or a service-credential file is never a repository artifact. This one has no exception and no example file: there is no legitimate version of it to track, so any commit of one is a leak, not a mistake in the rule.\n\nIf you are adding a rule here, add its case to CREDENTIAL_PATHS in this file too.`,
    ).toBe(true);
  });

  it.each(EXAMPLE_PATHS)('%s stays stageable, because it is the tracked exception', (path) => {
    expect(
      isIgnored(sandbox, path),
      `The .gitignore ignores "${path}", which is the one file of its family that the repository is supposed to track. It documents every variable the project reads, with placeholder values. If the negation stops working, the file becomes impossible to add, and the next contributor ships without a template.\n\nThe negation must come AFTER the wildcard that swallows it: git applies the last matching rule, so "!.env.example" placed above ".env*" loses to it.`,
    ).toBe(false);
  });

  it('a tracked file is NOT ignored, so the cases above can prove something', () => {
    expect(
      isIgnored(sandbox, TRACKED_FILE),
      `The sandbox reports "${TRACKED_FILE}" as ignored, which means it would report almost anything as ignored -- a .gitignore with a stray "*" does exactly that. Every case above would then pass while proving nothing, because they only ever ask "is this path ignored?" and the answer had become yes for everything. This is the positive control: it is the assertion that keeps a green run meaningful.`,
    ).toBe(false);
  });
});

describe('meta: no env or credential file is tracked, and none ever was', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('the repository is checked out with its full history, or the history assertion below is a no-op', () => {
    const shallow = gitText(REPO_ROOT, ['rev-parse', '--is-shallow-repository']).trim();

    expect(
      shallow,
      `The checkout is a SHALLOW clone (fetch-depth: 1). The history assertion in this file can only see the commits that were fetched, so it would report "no env file was ever committed" from a history it never read -- a green run that proves nothing.\n\nThe fix is in .github/workflows/ci.yml: every "actions/checkout" step needs "fetch-depth: 0". The gitleaks job already sets it, with the comment "gitleaks scans history, not just the tip"; this gate scans history for the same reason and needs the same thing.`,
    ).toBe('false');
  });

  it('no env or credential file is tracked right now', () => {
    const tracked = gitText(REPO_ROOT, ['ls-files'])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .filter(isSecretBearingPath);

    expect(
      tracked,
      `These tracked paths are env or credential files:\n${tracked.map((p) => `  ${p}`).join('\n')}\n\nThey are committed to a public repository. If any of them holds a real value, that value is published and rotating the credential does NOT remove it from the history -- the fix is a rewrite, and the rotation comes first.\n\nUntracking a file is the easy half; the hard half is that the value was already published.`,
    ).toEqual([]);
  });

  it('no env or credential file was EVER committed, in any branch of the history', () => {
    // Every object ever reachable from every ref, with its path. This is the
    // assertion that says the leak never happened -- as opposed to saying it
    // is not happening right now.
    const objects = gitText(REPO_ROOT, ['rev-list', '--all', '--objects'])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    const leaked = objects
      .map((line) => line.split(' ').slice(1).join(' '))
      .filter((path) => path !== '' && isSecretBearingPath(path));

    expect(
      [...new Set(leaked)],
      `These paths were committed at some point in this repository's history:\n${[...new Set(leaked)].map((p) => `  ${p}`).join('\n')}\n\nA path that was committed and later deleted is still in the history, and still on GitHub, and still readable by anyone who clones. Removing it from the tip does not remove it from there.\n\nIf the file holds a real credential, rotate that credential FIRST -- the rewrite below only hides it, and it is not enough on its own. Then rewrite the history (git filter-repo) and force-push.\n\nIf the file was committed with placeholder values only, there is nothing to rotate; remove it from the history and add the case to this file so the path stays out.`,
    ).toEqual([]);
  });
});
