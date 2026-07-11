#!/usr/bin/env node

export const EXPECTED_RULES = ['child-process-shell-injection', 'hardcoded-stripe-secret-key'];

export function assertExpectedFindings(results) {
  const byFile = new Map();
  for (const r of results) {
    const base =
      String(r.path ?? '')
        .split('/')
        .pop() ?? '';
    if (!byFile.has(base)) byFile.set(base, []);
    byFile.get(base).push(String(r.check_id ?? ''));
  }
  const vulnIds = byFile.get('vulnerable.ts') ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!vulnIds.some((id) => id.endsWith(rule))) {
      return {
        ok: false,
        reason: `vulnerable.ts did not trigger expected rule "${rule}" (found: ${vulnIds.join(', ') || 'none'})`,
      };
    }
  }
  const cleanIds = byFile.get('clean.ts') ?? [];
  if (cleanIds.length > 0) {
    return {
      ok: false,
      reason: `clean.ts produced ${cleanIds.length} vendored-rule finding(s), expected 0: ${cleanIds.join(', ')}`,
    };
  }
  return { ok: true };
}

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE_DIR = 'tests/fixtures/semgrep';
const VENDORED_CONFIG = '.semgrep';

export function interpretSemgrepRun(res) {
  if (res.error || res.status === null) {
    return {
      ok: false,
      reason: `semgrep failed to run: ${res.error?.message ?? 'no exit status'}`,
    };
  }
  let json;
  try {
    json = JSON.parse(res.stdout);
  } catch (e) {
    return {
      ok: false,
      reason: `unparseable semgrep JSON (stderr: ${res.stderr?.slice(0, 400) ?? ''}): ${e.message}`,
    };
  }
  const errors = json.errors ?? [];
  if (errors.length > 0) {
    const summary = errors
      .slice(0, 3)
      .map((x) => x.message ?? x.type ?? 'unknown')
      .join('; ');
    return { ok: false, reason: `semgrep reported ${errors.length} scan error(s): ${summary}` };
  }
  return { ok: true, json };
}

function runSemgrepJson(scanDir) {
  const cmd = process.env.SEMGREP_BIN || 'semgrep';
  const res = spawnSync(
    cmd,
    ['scan', '--config', VENDORED_CONFIG, '--json', '--metrics', 'off', scanDir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return interpretSemgrepRun(res);
}

export function decideExit(scan) {
  if (!scan.ok) {
    return { code: 2, level: 'INFRA', message: scan.reason };
  }
  const verdict = assertExpectedFindings(scan.json.results ?? []);
  if (!verdict.ok) {
    return { code: 1, level: 'RULE REGRESSION', message: verdict.reason };
  }
  return {
    code: 0,
    level: 'OK',
    message: 'vendored rules fire on vulnerable.ts; clean.ts is quiet.',
  };
}

export function run({
  runner = runSemgrepJson,
  exit = process.exit,
  log = console.log,
  err = console.error,
} = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'semgrep-selftest-'));
  let code = 0;
  try {
    cpSync(join(FIXTURE_DIR, 'vulnerable.ts'), join(tmp, 'vulnerable.ts'));
    cpSync(join(FIXTURE_DIR, 'clean.ts'), join(tmp, 'clean.ts'));
    const decision = decideExit(runner(tmp));
    if (decision.code === 0) log(`[check-semgrep-fixture] OK: ${decision.message}`);
    else err(`[check-semgrep-fixture] ${decision.level}: ${decision.message}`);
    code = decision.code;
  } catch (e) {
    err(`[check-semgrep-fixture] INFRA: ${e?.message ?? String(e)}`);
    code = 2;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return exit(code);
}

if (typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href)
  run();
