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

const SELF_REPORTING_JOBS = ['dependency-review', 'semgrep', 'ci-gate'];

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

  it('blocks on failure and cancelled upstream results only (skipped passes)', () => {
    expect(job).toMatch(/BAD_RESULTS = new Set\(\["failure", "cancelled"\]\)/);
  });

  it('reads needs via toJSON into env, never interpolated into the script body', () => {
    expect(job).toMatch(/NEEDS_JSON:\s*\$\{\{\s*toJSON\(needs\)\s*\}\}/);
    expect(job).toMatch(/JSON\.parse\(process\.env\.NEEDS_JSON\)/);
    const runBody = job.slice(job.indexOf('node -e'));
    expect(runBody).not.toMatch(/\$\{\{/);
  });
});
