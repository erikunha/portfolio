import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

const jobsSection = ci.slice(ci.indexOf('\njobs:\n') + '\njobs:\n'.length);
const jobNames = [...jobsSection.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1] ?? '');

const gateHeading = '\n  ci-gate:';
const gateStart = ci.indexOf(gateHeading);
const rest = ci.slice(gateStart + gateHeading.length);
const nextJobRel = rest.search(/\n {2}\S/);
const job =
  nextJobRel === -1
    ? ci.slice(gateStart)
    : ci.slice(gateStart, gateStart + gateHeading.length + nextJobRel);

const needsMatch = job.match(/needs:\s*\[([^\]]*)\]/);
const needs = (needsMatch?.[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SELF_REPORTING_JOBS = ['ci-gate'];

describe('ci.yml ci-gate fan-in invariants', () => {
  it('defines a ci-gate job', () => {
    expect(gateStart).toBeGreaterThan(-1);
  });

  it('runs unconditionally (if: always()) so it reports on path-skipped runs', () => {
    expect(job).toMatch(/if:\s*always\(\)/);
  });

  it('is not a matrix job (must report exactly one status context)', () => {
    expect(job).not.toMatch(/matrix:/);
  });

  it('needs exactly every job except the self-reporting set', () => {
    expect(jobNames.length).toBeGreaterThan(SELF_REPORTING_JOBS.length);
    for (const excluded of SELF_REPORTING_JOBS) {
      expect(jobNames).toContain(excluded);
    }
    const expected = jobNames.filter((j) => !SELF_REPORTING_JOBS.includes(j)).sort();
    expect([...needs].sort()).toEqual(expected);
  });

  const gateScript = (() => {
    const body = job.slice(job.indexOf("node -e '") + "node -e '".length);
    return body.slice(0, body.lastIndexOf("'"));
  })();

  function runGate(results: Record<string, string>): number {
    const needsJson = JSON.stringify(
      Object.fromEntries(Object.entries(results).map(([k, result]) => [k, { result }])),
    );
    const out = spawnSync(process.execPath, ['-e', gateScript], {
      env: { PATH: process.env.PATH ?? '', NEEDS_JSON: needsJson },
      encoding: 'utf8',
    });
    return out.status ?? -1;
  }

  const ALL_GREEN = Object.fromEntries(needs.map((n) => [n, 'success']));

  it('passes when every upstream job succeeded', () => {
    expect(runGate(ALL_GREEN)).toBe(0);
  });

  it('passes a path-skipped optional job', () => {
    expect(runGate({ ...ALL_GREEN, performance: 'skipped', 'attest-build': 'skipped' })).toBe(0);
  });

  it.each(['failure', 'cancelled', 'abandoned', 'timed_out', 'neutral'])(
    'blocks an upstream job whose result is %s (an Actions outage reports abandoned)',
    (result) => {
      expect(runGate({ ...ALL_GREEN, typecheck: result })).toBe(1);
    },
  );

  it.each(['detect-changes', 'quality-fast', 'typecheck', 'test', 'build', 'semgrep', 'gitleaks'])(
    'blocks when the always-run job %s did not succeed, even as skipped',
    (core) => {
      expect(runGate({ ...ALL_GREEN, [core]: 'skipped' })).toBe(1);
    },
  );

  it('reads needs via toJSON into env, never interpolated into the script body', () => {
    expect(job).toMatch(/NEEDS_JSON:\s*\$\{\{\s*toJSON\(needs\)\s*\}\}/);
    expect(job).toMatch(/JSON\.parse\(process\.env\.NEEDS_JSON\)/);
    const runBody = job.slice(job.indexOf('node -e'));
    expect(runBody).not.toMatch(/\$\{\{/);
  });
});
