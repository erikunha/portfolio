import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const semgrepInstalled = spawnSync('semgrep', ['--version']).status === 0;
const run = (args: string[]) =>
  spawnSync('node', ['scripts/run-semgrep.mjs', ...args], { encoding: 'utf8' });

const tmpDirs: string[] = [];
function fixtureTempDir(...fixtures: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'semgrep-fix-'));
  tmpDirs.push(dir);
  for (const f of fixtures) {
    copyFileSync(`${process.cwd()}/tests/fixtures/semgrep/${f}`, join(dir, f));
  }
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe('run-semgrep wrapper', () => {
  it('exits 2 with a clear message when semgrep is not installed', () => {
    const r = spawnSync('node', ['scripts/run-semgrep.mjs', '--sarif', '/tmp/x.sarif'], {
      encoding: 'utf8',
      env: { ...process.env, SEMGREP_BIN: 'definitely-not-a-real-binary-xyz' },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/semgrep.*not.*found|install/i);
  });

  it('exits 2 when --sarif is passed with no path argument', () => {
    const r = run(['--sarif']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--sarif requires a path/i);
  });

  it('honors SEMGREP_BIN exactly (no fallback) and splices well-formed scan args', () => {
    const dir = mkdtempSync(join(tmpdir(), 'semgrep-stub-'));
    tmpDirs.push(dir);
    const out = join(dir, 'argv.json');
    const stub = join(dir, 'fake-semgrep.mjs');
    writeFileSync(
      stub,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('1.97.0'); process.exit(0); }
writeFileSync(process.env.STUB_OUT, JSON.stringify(a));
process.exit(0);
`,
      { mode: 0o755 },
    );
    const r = spawnSync(
      'node',
      ['scripts/run-semgrep.mjs', '--sarif', join(dir, 'o.sarif'), 'lib'],
      {
        encoding: 'utf8',
        env: { ...process.env, SEMGREP_BIN: stub, STUB_OUT: out },
      },
    );
    expect(r.status).toBe(0);
    const argv = JSON.parse(readFileSync(out, 'utf8')) as string[];
    expect(argv[0]).toBe('scan');
    expect(argv).toEqual(
      expect.arrayContaining([
        '--config',
        '.semgrep',
        'p/typescript',
        'p/react',
        'p/nextjs',
        '--sarif',
        '--output',
        '--metrics',
        'off',
      ]),
    );
    expect(argv[argv.length - 1]).toBe('lib');
  });

  it.runIf(semgrepInstalled)('flags the vulnerable fixture and writes well-formed SARIF', () => {
    const dir = fixtureTempDir('vulnerable.ts');
    const sarif = join(dir, 'out.sarif');
    const r = run(['--error', '--sarif', sarif, dir]);
    expect(r.status).toBe(1);
    expect(existsSync(sarif)).toBe(true);
    const doc = JSON.parse(readFileSync(sarif, 'utf8'));
    expect(doc.version).toBe('2.1.0');
    expect(Array.isArray(doc.runs)).toBe(true);
    const results = doc.runs.flatMap((x: { results?: unknown[] }) => x.results ?? []);
    expect(results.length).toBeGreaterThan(0);
  });

  it.runIf(semgrepInstalled)('produces zero findings on the clean fixture', () => {
    const dir = fixtureTempDir('clean.ts');
    const r = run(['--error', join(dir, 'clean.ts')]);
    expect(r.status).toBe(0);
  });
});
