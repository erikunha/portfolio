import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

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
    expect(job).toMatch(/pip install[^\n]*semgrep==1\.169\.0/);
  });

  it('installs semgrep with no setuptools constraint (1.169.0 dropped the pkg_resources import that needed it; the constraint only forced a pointless setuptools downgrade)', () => {
    expect(job).not.toMatch(/setuptools/);
  });

  it('resolves SEMGREP_BIN to an absolute path (PATH-independent invocation)', () => {
    expect(job).toMatch(/echo "SEMGREP_BIN=\$SEMGREP_BIN" >> "\$GITHUB_ENV"/);
    expect(job).toMatch(/sysconfig\.get_path\('scripts'\)/);
  });

  it('SHA-pins every action in the semgrep job (no bare @vN tags)', () => {
    const uses = [...job.matchAll(/uses:\s*([^\s]+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });

  it('guards SARIF upload on the file existing (no misleading second failure)', () => {
    expect(job).toMatch(/if:\s*always\(\)\s*&&\s*hashFiles\('semgrep\.sarif'\)\s*!=\s*''/);
  });
});
