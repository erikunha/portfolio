import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import strykerConfig from '../../stryker.config.mjs';
import { isMain } from '../lib/is-main.ts';
// @ts-expect-error Stryker loads this .mjs config directly, so it ships no declaration file
import { CANARY_FILE, CANARY_REPORT_ENV } from './stryker-canary.config.mjs';

export interface MutationReportMutant {
  status: string;
  coveredBy?: string[];
  testsCompleted?: number;
}

export interface MutationReport {
  files?: Record<string, { mutants?: MutationReportMutant[] }>;
}

export interface Assessment {
  ok: boolean;
  reason: string;
}

export interface CanaryResult {
  code: 0 | 1 | 2;
  message: string;
}

export interface MainOptions {
  log?: (message: string) => void;
  err?: (message: string) => void;
}

export interface AssessOptions {
  breakThreshold?: number | null;
}

const KILLED = new Set(['Killed', 'Timeout']);
const SCOREABLE = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);
const PERCENT = 100;
const SCORE_DIGITS = 1;
const CANARY_CONFIG = 'scripts/gates/stryker-canary.config.mjs';
const EXIT_OK = 0;
const EXIT_BLIND = 1;
const EXIT_INFRA = 2;
const BYTES_PER_MIB = 1024 * 1024;
const STRYKER_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB;
const OUTPUT_TAIL_CHARS = 600;
const ARGV_OFFSET = 2;

export function assessReport(
  report: MutationReport | undefined,
  { breakThreshold = null }: AssessOptions = {},
): Assessment {
  const mutants = Object.values(report?.files ?? {}).flatMap((file) => file.mutants ?? []);
  const scoreable = mutants.filter((m) => SCOREABLE.has(m.status));
  if (scoreable.length === 0) {
    return {
      ok: false,
      reason: 'the report has zero scoreable mutants: the runner executed nothing',
    };
  }
  const blind = scoreable.filter(
    (m) => m.status === 'Survived' && (m.coveredBy?.length ?? 0) > 0 && m.testsCompleted === 0,
  );
  if (blind.length > 0) {
    return {
      ok: false,
      reason: `${blind.length} covered mutant(s) survived without a single test running: the runner filtered every test out, so survival proves nothing`,
    };
  }
  const killed = scoreable.filter((m) => KILLED.has(m.status)).length;
  if (killed === 0) {
    return {
      ok: false,
      reason: `Stryker killed none of ${scoreable.length} scoreable mutants: the suite is not observing the mutation`,
    };
  }
  const summary = `${killed} of ${scoreable.length} scoreable mutants killed`;
  if (typeof breakThreshold === 'number') {
    const score = (killed / scoreable.length) * PERCENT;
    if (score < breakThreshold) {
      return {
        ok: false,
        reason: `mutation score ${score.toFixed(SCORE_DIGITS)}% is below the ${breakThreshold}% break threshold (${summary})`,
      };
    }
  }
  return { ok: true, reason: summary };
}

export function runCanary(): CanaryResult {
  const dir = mkdtempSync(join(tmpdir(), 'stryker-canary-'));
  const reportPath = join(dir, 'report.json');
  try {
    const res = spawnSync('pnpm', ['exec', 'stryker', 'run', CANARY_CONFIG], {
      encoding: 'utf8',
      env: { ...process.env, [CANARY_REPORT_ENV]: reportPath },
      maxBuffer: STRYKER_MAX_BUFFER_BYTES,
    });
    if (!existsSync(reportPath)) {
      return {
        code: EXIT_INFRA,
        message: `Stryker wrote no report (exit ${res.status}): ${(res.stderr || res.stdout || '').slice(-OUTPUT_TAIL_CHARS)}`,
      };
    }
    const verdict = assessReport(JSON.parse(readFileSync(reportPath, 'utf8')) as MutationReport);
    return {
      code: verdict.ok ? EXIT_OK : EXIT_BLIND,
      message: `${CANARY_FILE}: ${verdict.reason}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function main(
  argv: string[],
  { log = console.log, err = console.error }: MainOptions = {},
): number {
  const [arg] = argv;
  let result: CanaryResult;
  if (arg === '--canary') {
    result = runCanary();
  } else if (arg) {
    try {
      const verdict = assessReport(JSON.parse(readFileSync(arg, 'utf8')) as MutationReport, {
        breakThreshold: strykerConfig.thresholds?.break,
      });
      result = { code: verdict.ok ? EXIT_OK : EXIT_BLIND, message: verdict.reason };
    } catch (error) {
      result = {
        code: EXIT_INFRA,
        message: `cannot read report ${arg}: ${(error as Error).message}`,
      };
    }
  } else {
    result = {
      code: EXIT_INFRA,
      message: 'usage: check-mutation-kills.ts --canary | <report.json>',
    };
  }
  if (result.code === EXIT_OK) log(`[check-mutation-kills] OK: ${result.message}`);
  else
    err(
      `[check-mutation-kills] ${result.code === EXIT_BLIND ? 'BLIND RUNNER' : 'INFRA'}: ${result.message}`,
    );
  return result.code;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(ARGV_OFFSET)));
