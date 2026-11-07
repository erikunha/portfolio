import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'stop-verify.mjs');
const BLOCK_EXIT_CODE = 2;

let project: string;

const stub = (name: string, exitCode: number) => {
  const bin = join(project, 'node_modules', '.bin');
  mkdirSync(bin, { recursive: true });
  const file = join(bin, name);
  writeFileSync(file, `#!/bin/sh\necho "${name} stub output"\nexit ${exitCode}\n`);
  chmodSync(file, 0o755);
};

const git = (...args: string[]) => spawnSync('git', args, { cwd: project, encoding: 'utf8' });

const hookEnv = (extra: Record<string, string>): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: project };
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  return { ...env, ...extra };
};

const runHook = (input: object, env: Record<string, string> = {}) =>
  spawnSync('node', [SCRIPT], {
    cwd: project,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: hookEnv(env),
  });

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'stop-verify-'));
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  writeFileSync(join(project, 'changed.ts'), 'export const a = 1;\n');
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('stop-verify hook', () => {
  it('blocks the turn end with exit 2 when biome fails on a changed file', () => {
    stub('biome', 1);
    stub('tsgo', 0);
    const result = runHook({});
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('biome check on the changed files failed');
  });

  it('blocks the turn end with exit 2 when the typecheck fails after a TypeScript change', () => {
    stub('biome', 0);
    stub('tsgo', 1);
    const result = runHook({});
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('typecheck failed');
  });

  it('passes when both checks pass', () => {
    stub('biome', 0);
    stub('tsgo', 0);
    expect(runHook({}).status).toBe(0);
  });

  it('does not loop: a hook already continuing the turn passes', () => {
    stub('biome', 1);
    expect(runHook({ stop_hook_active: true }).status).toBe(0);
  });

  it('does nothing in CI, where the reviewer holds credentials and no dependencies', () => {
    stub('biome', 1);
    expect(runHook({}, { CI: 'true' }).status).toBe(0);
  });

  it('does nothing when dependencies are not installed', () => {
    expect(runHook({}).status).toBe(0);
  });

  it('does nothing when no file changed', () => {
    stub('biome', 1);
    rmSync(join(project, 'changed.ts'));
    expect(runHook({}).status).toBe(0);
  });
});
