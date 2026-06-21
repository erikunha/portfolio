#!/usr/bin/env node
// Semgrep fixture self-test. Proves the content-pinned vendored rules in
// .semgrep/ still fire. A clean tree makes the report-only scan find nothing
// whether the rules work or not, so this scans the fixtures (temp copy, since
// .semgrepignore excludes tests/fixtures/) with --config .semgrep ONLY and
// fails if a vendored rule stopped firing. See DECISIONS.md.
// Plain node (no deps) so the CI semgrep job runs it without pnpm install.

// The two vendored rule ids (from .semgrep/owasp-top-ten.yml and .semgrep/
// secrets.yml). Single update site: if a rule file renames its id, sync here
// and the self-test fails loudly until then (which is correct). Match by
// check_id SUFFIX: Semgrep namespaces a local-config rule id by file path.
export const EXPECTED_RULES = ['child-process-shell-injection', 'hardcoded-stripe-secret-key'];

// Pure. Given Semgrep `results[]`, assert each EXPECTED_RULES id fires on
// vulnerable.ts and clean.ts has zero findings. Returns a tagged verdict.
export function assertExpectedFindings(results) {
  const byFile = new Map(); // fixture basename -> check_id[]
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

const FIXTURE_DIR = 'tests/fixtures/semgrep';
const VENDORED_CONFIG = '.semgrep';

// Pure. Interpret a completed spawnSync result into a scan verdict. Kept
// separate from spawning so the failure-classification logic is unit-testable.
// Semgrep exits 1 when it finds matches (our success path), so a non-zero exit
// is NOT treated as infra; instead a populated top-level `errors[]` (which
// semgrep writes on a runtime/parse failure even alongside a non-zero exit) is
// the infra signal, so a crash surfaces as INFRA rather than masquerading as a
// RULE REGRESSION during triage.
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

// Run Semgrep over scanDir with the vendored config only, JSON to stdout.
// SEMGREP_BIN (set by CI to the absolute console-script path) is honored
// exactly; otherwise probe the bare `semgrep` on PATH (local dev). No
// `python -m semgrep` fallback: semgrep ships a console script only.
function runSemgrepJson(scanDir) {
  const cmd = process.env.SEMGREP_BIN || 'semgrep';
  const res = spawnSync(
    cmd,
    ['scan', '--config', VENDORED_CONFIG, '--json', '--metrics', 'off', scanDir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return interpretSemgrepRun(res);
}

// Pure. Map a scan verdict to an exit decision: 2 = infra, 1 = rule
// regression, 0 = healthy. Tagged so run() logs the right channel/level.
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

// Orchestrate the self-test. Dependencies are injected so the temp-dir cleanup
// is verifiable in a unit test. process.exit() does NOT unwind the call stack,
// so it must run AFTER the try/finally; calling it inside would skip the
// rmSync and leak the temp dir on every path.
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
    // A throw inside the try (e.g. a missing fixture file) is an environment
    // failure, not a rule regression. Classify it as INFRA (exit 2) so the
    // documented taxonomy (exit 1 = rule regression, exit 2 = infra) holds
    // rather than the unhandled-throw default of exit 1.
    err(`[check-semgrep-fixture] INFRA: ${e?.message ?? String(e)}`);
    code = 2;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return exit(code);
}

// Run only when invoked directly, not when imported by the unit test.
if (import.meta.url === `file://${process.argv[1]}`) run();
