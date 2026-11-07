import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'guard-test-edits.mjs');
const BLOCK_EXIT_CODE = 2;
const MARKER = join('.claude', 'fix-mode');

let root: string;

const touch = (relative: string) => {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'x');
  return file;
};

type Options = { fixMode?: string; marker?: boolean; input?: unknown; raw?: string };

const run = (
  toolName: string,
  toolInput: Record<string, unknown>,
  { fixMode, marker = false, input, raw }: Options = {},
) => {
  if (marker) touch(MARKER);
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: root };
  delete env.FIX_MODE;
  if (fixMode !== undefined) env.FIX_MODE = fixMode;
  return spawnSync('node', [SCRIPT], {
    input: raw ?? JSON.stringify(input ?? { tool_name: toolName, tool_input: toolInput }),
    encoding: 'utf8',
    env,
  });
};

const edit = (relative: string, options: Options = {}) =>
  run('Edit', { file_path: join(root, relative) }, options);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'guard-test-edits-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('guard-test-edits hook', () => {
  it('allows every edit when no fix task is declared', () => {
    touch('lib/a.test.ts');
    expect(edit('lib/a.test.ts').status).toBe(0);
  });

  it.each([
    'lib/a.test.ts',
    'components/B.test.tsx',
    'lib/c.spec.ts',
    'design-system/components/Badge/Badge.e2e.ts',
    'tests/e2e/nav.spec.ts',
    'tests/visual/visual.spec.ts-snapshots/hero.png',
    '__tests__/scripts/guard-merge-main.test.ts',
    'scripts/__tests__/stop-verify.test.mjs',
  ])('blocks an edit to the existing test file %s under FIX_MODE=1', (relative) => {
    touch(relative);
    const result = edit(relative, { fixMode: '1' });
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('guard-test-edits');
    expect(result.stderr).toContain(relative);
  });

  it('blocks when the marker file declares the fix task', () => {
    touch('lib/a.test.ts');
    expect(edit('lib/a.test.ts', { marker: true }).status).toBe(BLOCK_EXIT_CODE);
  });

  it('tells the agent how to proceed and how to lift the mode', () => {
    touch('lib/a.test.ts');
    const { stderr } = edit('lib/a.test.ts', { fixMode: '1' });
    expect(stderr).toContain('new test file');
    expect(stderr).toContain('FIX_MODE');
    expect(stderr).toContain(MARKER);
  });

  it('allows creating a new test file, which is how a fix adds its regression test', () => {
    const file = join(root, 'lib/new.test.ts');
    const result = run('Write', { file_path: file }, { fixMode: '1' });
    expect(result.status).toBe(0);
  });

  it('blocks a Write that overwrites an existing test file', () => {
    const file = touch('lib/a.test.ts');
    expect(run('Write', { file_path: file }, { fixMode: '1' }).status).toBe(BLOCK_EXIT_CODE);
  });

  it('blocks MultiEdit and NotebookEdit on an existing test file', () => {
    const file = touch('lib/a.test.ts');
    expect(run('MultiEdit', { file_path: file }, { fixMode: '1' }).status).toBe(BLOCK_EXIT_CODE);
    const notebook = touch('tests/nb.test.ts');
    expect(run('NotebookEdit', { notebook_path: notebook }, { fixMode: '1' }).status).toBe(
      BLOCK_EXIT_CODE,
    );
  });

  it('resolves a relative path against the project root', () => {
    touch('lib/a.test.ts');
    const result = run('Edit', { file_path: 'lib/a.test.ts' }, { fixMode: '1' });
    expect(result.status).toBe(BLOCK_EXIT_CODE);
  });

  it('allows edits to non-test files under fix mode', () => {
    touch('lib/a.ts');
    touch('lib/testing-utils.ts');
    touch('docs/tests.md');
    expect(edit('lib/a.ts', { fixMode: '1' }).status).toBe(0);
    expect(edit('lib/testing-utils.ts', { fixMode: '1' }).status).toBe(0);
    expect(edit('docs/tests.md', { fixMode: '1' }).status).toBe(0);
  });

  it('only treats FIX_MODE=1 as declared', () => {
    touch('lib/a.test.ts');
    expect(edit('lib/a.test.ts', { fixMode: '0' }).status).toBe(0);
    expect(edit('lib/a.test.ts', { fixMode: '' }).status).toBe(0);
    expect(edit('lib/a.test.ts', { fixMode: 'true' }).status).toBe(0);
  });

  it('ignores a path outside the project root', () => {
    const outside = mkdtempSync(join(tmpdir(), 'guard-test-edits-outside-'));
    try {
      const file = join(outside, 'a.test.ts');
      writeFileSync(file, 'x');
      expect(run('Edit', { file_path: file }, { fixMode: '1' }).status).toBe(0);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('ignores tools that do not edit files', () => {
    touch('lib/a.test.ts');
    expect(run('Bash', { command: 'cat lib/a.test.ts' }, { fixMode: '1' }).status).toBe(0);
    expect(run('Read', { file_path: join(root, 'lib/a.test.ts') }, { fixMode: '1' }).status).toBe(
      0,
    );
  });

  it('does not crash on malformed input', () => {
    expect(run('Edit', {}, { fixMode: '1', raw: 'not json' }).status).toBe(0);
    expect(run('Edit', {}, { fixMode: '1', input: { tool_name: 'Edit' } }).status).toBe(0);
  });
});
