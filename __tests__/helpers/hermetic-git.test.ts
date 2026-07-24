import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GIT_CONFIG_ISOLATION, hermeticEnv, inheritedEnvWithIsolatedGit } from './hermetic-git';

const LOCAL_ENV_VARS = execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n');

const ISOLATION_KEYS = Object.keys(GIT_CONFIG_ISOLATION);

const REPO_LOCAL_KEYS = LOCAL_ENV_VARS.filter((key) => !ISOLATION_KEYS.includes(key));

const saved = new Map<string, string | undefined>();

const exportVar = (key: string, value: string) => {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  process.env[key] = value;
};

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe('inheritedEnvWithIsolatedGit: git’s repo-local env cannot reach the child', () => {
  it.each(REPO_LOCAL_KEYS)('%s is stripped even though the parent exports it', (key) => {
    exportVar(key, '/somewhere/else/.git');

    expect(
      inheritedEnvWithIsolatedGit()[key],
      `${key} survived into the child environment. git EXPORTS its repo-local vars into every hook environment and HONOURS them over the cwd, so a child that runs in a temp directory is still operating on THIS repo: it writes the real index and re-enters husky through the real core.hooksPath. This helper spreads process.env, so it is the last place that leak can be stopped, and it must not depend on some caller having cleaned the environment first -- the pre-push hook that does exactly that lives in the MAIN worktree and is resolved through an absolute core.hooksPath, so a linked worktree runs whatever version main happens to be on. Isolating only GIT_CONFIG_* is not enough; ${LOCAL_ENV_VARS.length} variables carry repo identity and git lists them itself via "git rev-parse --local-env-vars".`,
    ).toBeUndefined();
  });

  it('still applies GIT_CONFIG_ISOLATION, which the strip must not remove', () => {
    const env = inheritedEnvWithIsolatedGit();

    expect(
      Object.fromEntries(ISOLATION_KEYS.map((key) => [key, env[key]])),
      'GIT_CONFIG_COUNT is BOTH a repo-local var git reports in --local-env-vars AND a key GIT_CONFIG_ISOLATION sets. Strip before applying isolation, never after, or the isolation deletes itself and the child falls back to the real user and system config.',
    ).toEqual(GIT_CONFIG_ISOLATION);
  });

  it('extra keys still win over the isolation defaults', () => {
    expect(inheritedEnvWithIsolatedGit({ GIT_DIR: 'explicit' }).GIT_DIR).toBe('explicit');
  });

  it('a leaked GIT_DIR does not make a temp repo write the repo it points at', () => {
    const decoy = mkdtempSync(join(tmpdir(), 'hermetic-decoy-'));
    execFileSync('git', ['init', '-b', 'main', decoy], { encoding: 'utf8' });
    exportVar('GIT_DIR', join(decoy, '.git'));

    const dir = mkdtempSync(join(tmpdir(), 'hermetic-'));
    try {
      const git = (...args: string[]) =>
        execFileSync('git', args, {
          cwd: dir,
          encoding: 'utf8',
          env: inheritedEnvWithIsolatedGit(),
        }).trim();

      git('init', '-b', 'main');
      git('config', 'user.email', 't@t.dev');
      git('config', 'user.name', 't');
      writeFileSync(join(dir, 'file'), 'x');
      git('add', '-A');

      expect(
        git('rev-parse', '--absolute-git-dir'),
        `The temp repo resolved to a git dir outside itself, so a commit here writes the LEAKED repo's index instead -- measured at 791 tracked files staged as deleted when this leaked into the real one (5cb8317, 2026-07-19). This is the end-to-end witness for the per-variable cases above: they assert the keys are absent, this asserts the consequence they exist to prevent. GIT_DIR is pointed at a throwaway repo rather than this one on purpose: a red run must not be able to corrupt the index of the checkout it is running in, which is exactly what this bug does to whoever hits it.`,
      ).toContain(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(decoy, { recursive: true, force: true });
    }
  });
});

describe('hermeticEnv: the allowlisted form carries no repo identity either', () => {
  it.each(REPO_LOCAL_KEYS)('%s never appears', (key) => {
    exportVar(key, '/somewhere/else/.git');

    expect(
      hermeticEnv()[key],
      `hermeticEnv() builds from an allowlist rather than from process.env, so ${key} can only appear if the allowlist grew to include it. It must not: this env is handed to git invocations that are asserting what a .gitignore rule does, and a leaked repo identity makes that assertion read a different repository than the one under test.`,
    ).toBeUndefined();
  });
});
