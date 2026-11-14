import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const ROOT = process.cwd();
const BIOME_BIN = join(ROOT, 'node_modules/.bin/biome');
const CLEAN_SOURCE = 'export const answer = 1;\n';
const UNFORMATTED_SOURCE = 'export   const   other=2\n';

function stagedCheckArgs(): string[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const script = pkg.scripts['check:staged'];
  expect(script, 'package.json must define check:staged for the pre-commit hook').toBeDefined();
  const [binary, ...args] = (script ?? '').split(/\s+/);
  expect(binary).toBe('biome');
  return args;
}

function repoWith(files: Record<string, string>, staged: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-staged-'));
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  writeFileSync(
    join(dir, 'biome.json'),
    JSON.stringify({ vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true } }),
  );
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  execFileSync('git', ['add', ...staged], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function runStagedCheck(dir: string): number {
  return spawnSync(BIOME_BIN, stagedCheckArgs(), { cwd: dir, encoding: 'utf8' }).status ?? -1;
}

describe('check:staged (the pre-commit lint reads only what the commit carries)', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('passes when only an unstaged file in the tree is unformatted', () => {
    const dir = repoWith({ 'clean.ts': CLEAN_SOURCE, 'wip.ts': UNFORMATTED_SOURCE }, ['clean.ts']);
    expect(
      runStagedCheck(dir),
      'another writer’s unstaged work in progress must not block this commit',
    ).toBe(0);
  });

  it('fails when a staged file is unformatted', () => {
    const dir = repoWith({ 'clean.ts': CLEAN_SOURCE, 'wip.ts': UNFORMATTED_SOURCE }, [
      'clean.ts',
      'wip.ts',
    ]);
    expect(runStagedCheck(dir)).not.toBe(0);
  });
});
