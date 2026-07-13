#!/usr/bin/env node

export const EXPECTED_RULES = ['github-pat'];
export const LEAKY_FIXTURE = 'leaky.ts';
export const CLEAN_FIXTURE = 'clean.ts';

const NO_LEAKS = 0;
const LEAKS_FOUND = 1;

export function interpretGitleaksRun(res) {
  if (res.error || res.status === null) {
    return {
      ok: false,
      reason: `gitleaks did not run (${res.error?.message ?? 'killed by a signal'}). A scanner that never ran reports zero leaks, which is indistinguishable from a clean tree.`,
    };
  }
  if (res.status !== NO_LEAKS && res.status !== LEAKS_FOUND) {
    return {
      ok: false,
      reason: `gitleaks exited ${res.status}, which is neither ${NO_LEAKS} (no leaks) nor ${LEAKS_FOUND} (leaks found): ${String(res.stderr).trim()}`,
    };
  }
  if (res.status === NO_LEAKS) {
    return {
      ok: false,
      reason: `gitleaks ran and found NOTHING in a fixture that plants a real ${EXPECTED_RULES.join(', ')} secret. The scanner is not firing, so a green secret-scan on the real tree would mean nothing.`,
    };
  }
  return { ok: true };
}

export function assertExpectedFindings(findings) {
  const byFile = new Map();
  for (const finding of findings) {
    const base = String(finding.File ?? '')
      .split('/')
      .pop();
    if (!byFile.has(base)) byFile.set(base, []);
    byFile.get(base).push(String(finding.RuleID ?? ''));
  }

  const leakyRules = byFile.get(LEAKY_FIXTURE) ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!leakyRules.includes(rule)) {
      return {
        ok: false,
        reason: `${LEAKY_FIXTURE} did not trigger the expected rule "${rule}" (found: ${leakyRules.join(', ') || 'none'}). Either the rule was removed from the config, or the planted secret no longer matches it — in both cases the real scan is no longer proven to detect this class.`,
      };
    }
  }

  const cleanRules = byFile.get(CLEAN_FIXTURE) ?? [];
  if (cleanRules.length > 0) {
    return {
      ok: false,
      reason: `${CLEAN_FIXTURE} produced ${cleanRules.length} finding(s), expected 0: ${cleanRules.join(', ')}. A scanner that fires on clean code trains people to ignore it.`,
    };
  }

  return { ok: true };
}

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE_DIR = 'tests/fixtures/gitleaks';
const REPORT_FILE = 'gitleaks-fixture.json';
const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'gitleaks-fixture-'));
  try {
    cpSync(join(FIXTURE_DIR, LEAKY_FIXTURE), join(tmp, LEAKY_FIXTURE));
    cpSync(join(FIXTURE_DIR, CLEAN_FIXTURE), join(tmp, CLEAN_FIXTURE));
    const report = join(tmp, REPORT_FILE);

    const res = spawnSync(
      GITLEAKS_BIN,
      ['dir', tmp, '--no-banner', '--redact', '--report-format', 'json', '--report-path', report],
      { encoding: 'utf8' },
    );

    const ran = interpretGitleaksRun(res);
    if (!ran.ok) {
      console.error(`[check-gitleaks-fixture] ${ran.reason}`);
      process.exit(1);
    }

    const findings = JSON.parse(readFileSync(report, 'utf8'));
    const verdict = assertExpectedFindings(findings);
    if (!verdict.ok) {
      console.error(`[check-gitleaks-fixture] ${verdict.reason}`);
      process.exit(1);
    }

    console.log(
      `[check-gitleaks-fixture] PASS — gitleaks fires on ${LEAKY_FIXTURE} (${EXPECTED_RULES.join(', ')}) and stays silent on ${CLEAN_FIXTURE}.`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
