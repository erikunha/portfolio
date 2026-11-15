import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  interpretSemgrepRun,
  resultBaseName,
  runSemgrepJson,
  semgrepBin,
  VENDORED_CONFIG,
  withScratchCopy,
} from '../lib/semgrep.ts';

const OK_RESULTS = [{ path: '/t/vulnerable.ts', check_id: 'a.b.rule' }];
const STUB_MODE = 0o755;
const COPY_PREFIX = 'semgrep-lib-copy-';
const scratchRoots: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'semgrep-lib-test-'));
  scratchRoots.push(dir);
  return dir;
}

function copyDirs(): string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith(COPY_PREFIX));
}

afterAll(() => {
  for (const dir of scratchRoots) rmSync(dir, { recursive: true, force: true });
});

describe('interpretSemgrepRun', () => {
  it('reports infra when the process failed to spawn', () => {
    const v = interpretSemgrepRun({ error: { message: 'ENOENT' }, status: null, stdout: '' });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('failed to run');
  });

  it('reports infra when the process was killed without an exit status', () => {
    const v = interpretSemgrepRun({ status: null, stdout: '' });
    expect(v.ok === false && v.reason).toContain('no exit status');
  });

  it('reports infra when stdout is not valid JSON', () => {
    const v = interpretSemgrepRun({ status: 1, stdout: 'not json', stderr: 'boom' });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('unparseable');
    expect(v.ok === false && v.reason).toContain('boom');
  });

  it('reports infra (not a rule regression) when semgrep emits scan errors', () => {
    const stdout = JSON.stringify({ results: [], errors: [{ message: 'parse failure' }] });
    const v = interpretSemgrepRun({ status: 2, stdout });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('scan error');
    expect(v.ok === false && v.reason).toContain('parse failure');
  });

  it('names at most three scan errors and falls back to the error type', () => {
    const errors = [{ type: 'Timeout' }, {}, { message: 'c' }, { message: 'dropped' }];
    const v = interpretSemgrepRun({ status: 2, stdout: JSON.stringify({ errors }) });
    expect(v.ok === false && v.reason).toContain('4 scan error(s): Timeout; unknown; c');
    expect(v.ok === false && v.reason).not.toContain('dropped');
  });

  it('passes through the parsed json on a healthy run (findings present, exit 1, no errors)', () => {
    const json = { results: OK_RESULTS, errors: [] };
    const v = interpretSemgrepRun({ status: 1, stdout: JSON.stringify(json) });
    expect(v.ok).toBe(true);
    expect(v.ok === true && v.json.results).toHaveLength(1);
  });
});

describe('resultBaseName', () => {
  it('keeps the last path segment', () => {
    expect(resultBaseName('/tmp/x/probes/a.ts')).toBe('a.ts');
  });

  it('returns an empty name for a missing path', () => {
    expect(resultBaseName(undefined)).toBe('');
  });
});

describe('semgrepBin', () => {
  const saved = process.env.SEMGREP_BIN;

  afterEach(() => {
    if (saved === undefined) delete process.env.SEMGREP_BIN;
    else process.env.SEMGREP_BIN = saved;
  });

  it('defaults to semgrep on the path', () => {
    delete process.env.SEMGREP_BIN;
    expect(semgrepBin()).toBe('semgrep');
  });

  it('treats an empty override as unset', () => {
    process.env.SEMGREP_BIN = '';
    expect(semgrepBin()).toBe('semgrep');
  });

  it('honors an explicit binary exactly', () => {
    process.env.SEMGREP_BIN = '/opt/semgrep/bin/semgrep';
    expect(semgrepBin()).toBe('/opt/semgrep/bin/semgrep');
  });
});

describe('runSemgrepJson', () => {
  const saved = process.env.SEMGREP_BIN;

  beforeEach(() => {
    const stub = join(scratch(), 'fake-semgrep.mjs');
    writeFileSync(
      stub,
      `#!/usr/bin/env node
const argv = process.argv.slice(2);
process.stdout.write(JSON.stringify({ results: [{ path: 'p', check_id: argv.join(' ') }], errors: [] }));
process.exit(1);
`,
      { mode: STUB_MODE },
    );
    process.env.SEMGREP_BIN = stub;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SEMGREP_BIN;
    else process.env.SEMGREP_BIN = saved;
  });

  it('scans the directory against the vendored rules with JSON output and metrics off', () => {
    const scan = runSemgrepJson('/some/dir');
    expect(scan.ok).toBe(true);
    const argv = scan.ok ? String(scan.json.results?.[0]?.check_id) : '';
    expect(argv).toBe(`scan --config ${VENDORED_CONFIG} --json --metrics off /some/dir`);
  });

  it('reports infra when the binary cannot be spawned', () => {
    process.env.SEMGREP_BIN = join(scratch(), 'missing-binary');
    const scan = runSemgrepJson('/some/dir');
    expect(scan.ok).toBe(false);
    expect(scan.ok === false && scan.reason).toContain('failed to run');
  });
});

describe('withScratchCopy', () => {
  function source(): string {
    const dir = scratch();
    writeFileSync(join(dir, 'a.ts'), 'export const a = 1;\n');
    return dir;
  }

  it('copies each source under its target name and returns what the callback returns', () => {
    const from = source();
    const seen = withScratchCopy(
      COPY_PREFIX,
      [
        { from: join(from, 'a.ts'), to: 'copied.ts' },
        { from, to: 'tree' },
      ],
      (dir) => ({
        file: readFileSync(join(dir, 'copied.ts'), 'utf8'),
        nested: existsSync(join(dir, 'tree', 'a.ts')),
      }),
    );
    expect(seen).toEqual({ file: 'export const a = 1;\n', nested: true });
  });

  it('removes the scratch directory after the callback returns', () => {
    let dir = '';
    withScratchCopy(COPY_PREFIX, [], (scratchDir) => {
      dir = scratchDir;
    });
    expect(dir).not.toBe('');
    expect(existsSync(dir)).toBe(false);
  });

  it('removes the scratch directory when the callback throws', () => {
    let dir = '';
    expect(() =>
      withScratchCopy(COPY_PREFIX, [], (scratchDir) => {
        dir = scratchDir;
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(existsSync(dir)).toBe(false);
  });

  it('removes the scratch directory when a source is missing', () => {
    const before = new Set(copyDirs());
    expect(() =>
      withScratchCopy(COPY_PREFIX, [{ from: join(scratch(), 'absent'), to: 'x' }], () => undefined),
    ).toThrow();
    expect(copyDirs().filter((name) => !before.has(name))).toEqual([]);
  });
});
