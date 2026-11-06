import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assessReport,
  type MutationReport,
  type MutationReportMutant,
  main,
} from '@/scripts/check-mutation-kills.mjs';

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

function report(...mutants: MutationReportMutant[]): MutationReport {
  return { files: { 'lib/x.ts': { mutants } } };
}

const covered = ['0', '1'];

describe('assessReport', () => {
  it('passes when at least one covered mutant was killed', () => {
    const verdict = assessReport(
      report(
        { status: 'Killed', coveredBy: covered, testsCompleted: 2 },
        { status: 'Survived', coveredBy: covered, testsCompleted: 3 },
      ),
    );
    expect(verdict.ok).toBe(true);
  });

  it('counts a timeout as a kill', () => {
    const verdict = assessReport(
      report({ status: 'Timeout', coveredBy: covered, testsCompleted: 1 }),
    );
    expect(verdict.ok).toBe(true);
  });

  it('fails a covered mutant that survived with zero tests run (the runner filtered every test out)', () => {
    const verdict = assessReport(
      report(
        { status: 'Survived', coveredBy: covered, testsCompleted: 0 },
        { status: 'Survived', coveredBy: covered, testsCompleted: 0 },
        { status: 'NoCoverage' },
      ),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('2 covered mutant(s) survived without a single test running');
  });

  it('fails one blind mutant even when other mutants were killed', () => {
    const verdict = assessReport(
      report(
        { status: 'Killed', coveredBy: covered, testsCompleted: 1 },
        { status: 'Survived', coveredBy: covered, testsCompleted: 0 },
      ),
    );
    expect(verdict.ok).toBe(false);
  });

  it('fails when nothing was killed even though tests ran', () => {
    const verdict = assessReport(
      report({ status: 'Survived', coveredBy: covered, testsCompleted: 4 }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('killed none of 1');
  });

  it('does not blame the runner for a mutant no test covers', () => {
    const verdict = assessReport(
      report(
        { status: 'Killed', coveredBy: covered, testsCompleted: 1 },
        { status: 'NoCoverage' },
        { status: 'Survived', coveredBy: [], testsCompleted: 0 },
      ),
    );
    expect(verdict.ok).toBe(true);
  });

  it('fails a report with no scoreable mutant', () => {
    expect(assessReport(report({ status: 'CompileError' })).ok).toBe(false);
    expect(assessReport({ files: {} }).ok).toBe(false);
  });
});

describe('main with a report path', () => {
  it('fails as an infra error, not a crash, on a missing or unreadable report', () => {
    const err = vi.fn();
    expect(main(['/nonexistent/mutation.json'], { log: vi.fn(), err })).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('INFRA'));
  });
});

describe('mutation workflow wiring', () => {
  it('weekly mutation.yml judges the report with the same assessor', () => {
    expect(read('.github/workflows/mutation.yml')).toContain(
      'node scripts/check-mutation-kills.mjs mutation-report.json',
    );
  });

  it('ci.yml runs the kill canary in the test job when its surface changes or on main', () => {
    const ci = read('.github/workflows/ci.yml');
    const step = ci.indexOf('node scripts/check-mutation-kills.mjs --canary');
    expect(step).toBeGreaterThan(-1);
    const stepStart = ci.lastIndexOf('      - name:', step);
    const stepText = ci.slice(stepStart, step);
    expect(stepText).toContain(
      "if: github.event_name != 'pull_request' || steps.mutation-surface-diff.outputs.changed == 'true'",
    );
    expect(ci.lastIndexOf('\n  test:', step)).toBeGreaterThan(
      ci.lastIndexOf('\n  typecheck:', step),
    );
  });

  it('package.json exposes the canary as check:mutation-canary', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['check:mutation-canary']).toBe(
      'node scripts/check-mutation-kills.mjs --canary',
    );
  });
});
