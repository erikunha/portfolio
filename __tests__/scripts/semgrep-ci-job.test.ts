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

  it('pins setuptools <81 so semgrep can import pkg_resources', () => {
    // semgrep 1.97.0 imports pkg_resources at runtime; setuptools >=81 removed
    // it. Without this pin the job fails with ModuleNotFoundError at --version.
    expect(job).toMatch(/pip install[^\n]*["']setuptools<81["'][^\n]*semgrep==1\.97\.0/);
  });

  it('resolves SEMGREP_BIN to an absolute path (PATH-independent invocation)', () => {
    // pip's console-script bin dir is not reliably on the Node child's PATH on
    // hosted runners, and `python -m semgrep` is not a valid entrypoint; the
    // install step must export an absolute SEMGREP_BIN the wrapper uses directly.
    expect(job).toMatch(/echo "SEMGREP_BIN=\$SEMGREP_BIN" >> "\$GITHUB_ENV"/);
    expect(job).toMatch(/sysconfig\.get_path\('scripts'\)/);
  });

  it('SHA-pins every action in the semgrep job (no bare @vN tags)', () => {
    const uses = [...job.matchAll(/uses:\s*([^\s]+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });

  it('guards SARIF upload on the file existing (no misleading second failure)', () => {
    // always() alone uploads even when the scan never wrote SARIF, producing a
    // confusing "Path does not exist" error that masks the real cause.
    expect(job).toMatch(/if:\s*always\(\)\s*&&\s*hashFiles\('semgrep\.sarif'\)\s*!=\s*''/);
  });
});
