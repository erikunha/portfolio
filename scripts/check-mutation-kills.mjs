#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANARY_FILE, CANARY_REPORT_ENV } from './stryker-canary.config.mjs';

const KILLED = new Set(['Killed', 'Timeout']);
const SCOREABLE = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);
const CANARY_CONFIG = 'scripts/stryker-canary.config.mjs';
const EXIT_OK = 0;
const EXIT_BLIND = 1;
const EXIT_INFRA = 2;

export function assessReport(report) {
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
  return { ok: true, reason: `${killed} of ${scoreable.length} scoreable mutants killed` };
}

export function runCanary() {
  const dir = mkdtempSync(join(tmpdir(), 'stryker-canary-'));
  const reportPath = join(dir, 'report.json');
  try {
    const res = spawnSync('pnpm', ['exec', 'stryker', 'run', CANARY_CONFIG], {
      encoding: 'utf8',
      env: { ...process.env, [CANARY_REPORT_ENV]: reportPath },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (!existsSync(reportPath)) {
      return {
        code: EXIT_INFRA,
        message: `Stryker wrote no report (exit ${res.status}): ${(res.stderr || res.stdout || '').slice(-600)}`,
      };
    }
    const verdict = assessReport(JSON.parse(readFileSync(reportPath, 'utf8')));
    return {
      code: verdict.ok ? EXIT_OK : EXIT_BLIND,
      message: `${CANARY_FILE}: ${verdict.reason}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function main(argv, { log = console.log, err = console.error } = {}) {
  const [arg] = argv;
  let result;
  if (arg === '--canary') {
    result = runCanary();
  } else if (arg) {
    try {
      const verdict = assessReport(JSON.parse(readFileSync(arg, 'utf8')));
      result = { code: verdict.ok ? EXIT_OK : EXIT_BLIND, message: verdict.reason };
    } catch (error) {
      result = { code: EXIT_INFRA, message: `cannot read report ${arg}: ${error.message}` };
    }
  } else {
    result = {
      code: EXIT_INFRA,
      message: 'usage: check-mutation-kills.mjs --canary | <report.json>',
    };
  }
  if (result.code === EXIT_OK) log(`[check-mutation-kills] OK: ${result.message}`);
  else
    err(
      `[check-mutation-kills] ${result.code === EXIT_BLIND ? 'BLIND RUNNER' : 'INFRA'}: ${result.message}`,
    );
  return result.code;
}

if (typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main(process.argv.slice(2)));
