import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

// Bound the slice to the semgrep job block ONLY (up to the next top-level job
// key), so a later job's `continue-on-error: true` cannot satisfy an assertion.
// Match a 2-space-indented sibling key via /\n {2}\S/ — NOT indexOf("\n  "),
// which also matches 4-space-indented body lines (it is a substring of "\n    ")
// and would collapse the slice to just the heading.
const semgrepHeading = '\n  semgrep:';
const semgrepStart = ci.indexOf(semgrepHeading);
const rest = ci.slice(semgrepStart + semgrepHeading.length);
const nextJobRel = rest.search(/\n {2}\S/);
const job =
  nextJobRel === -1
    ? ci.slice(semgrepStart)
    : ci.slice(semgrepStart, semgrepStart + semgrepHeading.length + nextJobRel);

describe('ci.yml semgrep job invariants', () => {
  it('defines a semgrep job', () => {
    expect(ci).toMatch(/^\s{2}semgrep:/m);
  });

  it('ships non-blocking (continue-on-error) until the FP baseline is recorded', () => {
    expect(job).toMatch(/continue-on-error:\s*true/);
  });

  it('grants security-events: write to upload SARIF', () => {
    expect(job).toMatch(/security-events:\s*write/);
  });

  it('pins the Semgrep version exactly', () => {
    expect(job).toMatch(/pip install[^\n]*semgrep==1\.97\.0/);
  });

  it('SHA-pins every action in the semgrep job (no bare @vN tags)', () => {
    const uses = [...job.matchAll(/uses:\s*([^\s]+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });
});
