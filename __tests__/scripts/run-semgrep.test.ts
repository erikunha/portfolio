import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const semgrepInstalled = spawnSync('semgrep', ['--version']).status === 0;
const run = (args: string[]) =>
  spawnSync('node', ['scripts/run-semgrep.mjs', ...args], { encoding: 'utf8' });

// The real scan excludes tests/fixtures/ via .semgrepignore, so a scan that
// targets the fixtures in-tree finds nothing. To exercise the vulnerable/clean
// fixtures we COPY them into an OS temp dir OUTSIDE the repo, where the repo's
// .semgrepignore does not apply, and point the wrapper at that dir. The wrapper
// still resolves --config .semgrep relative to its own cwd (the repo root), so
// the vendored rules load normally. Mirrors Unit A's /tmp temp-dir harness.
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
    // Force the not-installed path via an env override the wrapper honors.
    const r = spawnSync('node', ['scripts/run-semgrep.mjs', '--sarif', '/tmp/x.sarif'], {
      encoding: 'utf8',
      env: { ...process.env, SEMGREP_BIN: 'definitely-not-a-real-binary-xyz' },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/semgrep.*not.*found|install/i);
  });

  it.runIf(semgrepInstalled)('flags the vulnerable fixture and writes well-formed SARIF', () => {
    const dir = fixtureTempDir('vulnerable.ts');
    const sarif = join(dir, 'out.sarif');
    const r = run(['--error', '--sarif', sarif, dir]);
    expect(r.status).toBe(1); // findings present under --error
    expect(existsSync(sarif)).toBe(true);
    const doc = JSON.parse(readFileSync(sarif, 'utf8'));
    expect(doc.version).toBe('2.1.0'); // SARIF schema version
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
