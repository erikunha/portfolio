import { join } from 'node:path';
import { isMain } from '../lib/is-main.ts';
import {
  resultBaseName,
  runSemgrepJson,
  type Scan,
  type SemgrepResult,
  withScratchCopy,
} from '../lib/semgrep.ts';

export const EXPECTED_RULES: readonly string[] = [
  'child-process-shell-injection',
  'hardcoded-anthropic-api-key',
];

const FIXTURE_DIR = 'tests/fixtures/semgrep';
const VULNERABLE_FIXTURE = 'vulnerable.ts';
const CLEAN_FIXTURE = 'clean.ts';
const SCRATCH_PREFIX = 'semgrep-selftest-';
const TAG = '[check-semgrep-fixture]';
const EXIT_OK = 0;
const EXIT_REGRESSION = 1;
const EXIT_INFRA = 2;

export type Verdict = { ok: true } | { ok: false; reason: string };

export interface ExitDecision {
  code: 0 | 1 | 2;
  level: 'OK' | 'RULE REGRESSION' | 'INFRA';
  message: string;
}

export interface RunOptions {
  runner?: (scanDir: string) => Scan;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  err?: (message: string) => void;
}

export function assertExpectedFindings(results: SemgrepResult[]): Verdict {
  const byFile = new Map<string, string[]>();
  for (const result of results) {
    const base = resultBaseName(result.path);
    const ids = byFile.get(base) ?? [];
    ids.push(String(result.check_id ?? ''));
    byFile.set(base, ids);
  }
  const vulnIds = byFile.get(VULNERABLE_FIXTURE) ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!vulnIds.some((id) => id.endsWith(rule))) {
      return {
        ok: false,
        reason: `${VULNERABLE_FIXTURE} did not trigger expected rule "${rule}" (found: ${vulnIds.join(', ') || 'none'})`,
      };
    }
  }
  const cleanIds = byFile.get(CLEAN_FIXTURE) ?? [];
  if (cleanIds.length > 0) {
    return {
      ok: false,
      reason: `${CLEAN_FIXTURE} produced ${cleanIds.length} vendored-rule finding(s), expected 0: ${cleanIds.join(', ')}`,
    };
  }
  return { ok: true };
}

export function decideExit(scan: Scan): ExitDecision {
  if (!scan.ok) {
    return { code: EXIT_INFRA, level: 'INFRA', message: scan.reason };
  }
  const verdict = assertExpectedFindings(scan.json.results ?? []);
  if (!verdict.ok) {
    return { code: EXIT_REGRESSION, level: 'RULE REGRESSION', message: verdict.reason };
  }
  return {
    code: EXIT_OK,
    level: 'OK',
    message: `vendored rules fire on ${VULNERABLE_FIXTURE}; ${CLEAN_FIXTURE} is quiet.`,
  };
}

export function run({
  runner = runSemgrepJson,
  exit = process.exit,
  log = console.log,
  err = console.error,
}: RunOptions = {}): void {
  let code: number = EXIT_OK;
  try {
    const decision = withScratchCopy(
      SCRATCH_PREFIX,
      [VULNERABLE_FIXTURE, CLEAN_FIXTURE].map((file) => ({
        from: join(FIXTURE_DIR, file),
        to: file,
      })),
      (scratchDir) => decideExit(runner(scratchDir)),
    );
    if (decision.code === EXIT_OK) log(`${TAG} OK: ${decision.message}`);
    else err(`${TAG} ${decision.level}: ${decision.message}`);
    code = decision.code;
  } catch (e) {
    err(`${TAG} INFRA: ${e instanceof Error ? e.message : String(e)}`);
    code = EXIT_INFRA;
  }
  exit(code);
}

if (isMain(import.meta.url)) run();
