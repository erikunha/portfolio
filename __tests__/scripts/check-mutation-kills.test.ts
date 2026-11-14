import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  assessReport,
  type MutationReport,
  type MutationReportMutant,
  main,
} from '@/scripts/check-mutation-kills.mjs';
import strykerConfig from '@/stryker.config.mjs';

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

describe('assessReport with a score floor', () => {
  const floor = 65;
  const killed = { status: 'Killed', coveredBy: covered, testsCompleted: 1 } as const;
  const survived = { status: 'Survived', coveredBy: covered, testsCompleted: 1 } as const;
  const uncovered = { status: 'NoCoverage' } as const;
  const bucket = (kills: number, survivors: number, noCoverage = 0) =>
    report(
      ...Array.from({ length: kills }, () => killed),
      ...Array.from({ length: survivors }, () => survived),
      ...Array.from({ length: noCoverage }, () => uncovered),
    );

  it('fails when the score is below the floor', () => {
    const verdict = assessReport(bucket(64, 36), { breakThreshold: floor });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('64.0%');
    expect(verdict.reason).toContain(`${floor}%`);
  });

  it('passes when the score equals the floor', () => {
    expect(assessReport(bucket(65, 35), { breakThreshold: floor }).ok).toBe(true);
  });

  it('counts uncovered mutants against the score', () => {
    expect(assessReport(bucket(65, 0, 35), { breakThreshold: floor }).ok).toBe(true);
    expect(assessReport(bucket(65, 0, 36), { breakThreshold: floor }).ok).toBe(false);
  });

  it('excludes errored mutants from the score', () => {
    const verdict = assessReport(
      report(killed, killed, survived, { status: 'RuntimeError' }, { status: 'CompileError' }),
      { breakThreshold: 66 },
    );
    expect(verdict.ok).toBe(true);
  });

  it('applies no floor when none is given', () => {
    expect(assessReport(bucket(1, 99)).ok).toBe(true);
    expect(assessReport(bucket(1, 99), { breakThreshold: null }).ok).toBe(true);
  });

  it('reports a blind runner before the score', () => {
    const verdict = assessReport(
      report({ status: 'Survived', coveredBy: covered, testsCompleted: 0 }),
      { breakThreshold: floor },
    );
    expect(verdict.reason).toContain('without a single test running');
  });

  it('reads the floor from the Stryker configuration', () => {
    expect(strykerConfig.thresholds.break).toBeGreaterThan(0);
  });
});

describe('main with a report path', () => {
  function reportFile(kills: number, survivors: number): string {
    const dir = mkdtempSync(join(tmpdir(), 'mutation-score-'));
    const path = join(dir, 'report.json');
    writeFileSync(path, JSON.stringify(report(...scoredMutants(kills, survivors))));
    return path;
  }

  function scoredMutants(kills: number, survivors: number): MutationReportMutant[] {
    return [
      ...Array.from({ length: kills }, () => ({
        status: 'Killed',
        coveredBy: covered,
        testsCompleted: 1,
      })),
      ...Array.from({ length: survivors }, () => ({
        status: 'Survived',
        coveredBy: covered,
        testsCompleted: 1,
      })),
    ];
  }

  it('exits 1 when the score is under the configured break threshold', () => {
    const err = vi.fn();
    const path = reportFile(1, 99);
    try {
      expect(main([path], { log: vi.fn(), err })).toBe(1);
      expect(err).toHaveBeenCalledWith(expect.stringContaining('below'));
    } finally {
      rmSync(dirname(path), { recursive: true, force: true });
    }
  });

  it('exits 0 when the score meets the configured break threshold', () => {
    const path = reportFile(strykerConfig.thresholds.break, 0);
    try {
      expect(main([path], { log: vi.fn(), err: vi.fn() })).toBe(0);
    } finally {
      rmSync(dirname(path), { recursive: true, force: true });
    }
  });

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
