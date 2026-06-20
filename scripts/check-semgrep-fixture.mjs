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
  if (res.error || res.status === null) {
    return {
      ok: false,
      reason: `semgrep failed to run: ${res.error?.message ?? 'no exit status'}`,
    };
  }
  try {
    return { ok: true, json: JSON.parse(res.stdout) };
  } catch (e) {
    return {
      ok: false,
      reason: `unparseable semgrep JSON (stderr: ${res.stderr?.slice(0, 400) ?? ''}): ${e.message}`,
    };
  }
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'semgrep-selftest-'));
  try {
    cpSync(join(FIXTURE_DIR, 'vulnerable.ts'), join(tmp, 'vulnerable.ts'));
    cpSync(join(FIXTURE_DIR, 'clean.ts'), join(tmp, 'clean.ts'));

    const scan = runSemgrepJson(tmp);
    if (!scan.ok) {
      console.error(`[check-semgrep-fixture] INFRA: ${scan.reason}`);
      process.exit(2);
    }
    const verdict = assertExpectedFindings(scan.json.results ?? []);
    if (!verdict.ok) {
      console.error(`[check-semgrep-fixture] RULE REGRESSION: ${verdict.reason}`);
      process.exit(1);
    }
    console.log(
      '[check-semgrep-fixture] OK: vendored rules fire on vulnerable.ts; clean.ts is quiet.',
    );
    process.exit(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Run only when invoked directly, not when imported by the unit test.
if (import.meta.url === `file://${process.argv[1]}`) main();
