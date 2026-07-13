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
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE_DIR = 'tests/fixtures/gitleaks';
const REPO_CONFIG = '.gitleaks.toml';
const REPORT_FILE = 'gitleaks-fixture.json';
const PROBE_FILE = 'config-probe.ts';
const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';

// Assembled at runtime so the literal never appears in this file — otherwise the repo scan
// would flag this script. It is NOT the token .gitleaks.toml allowlists: the whole point of
// the probe below is to scan a secret the repo config does not exempt.
const PROBE_TOKEN = ['ghp', 'Pr0beNotAllowlisted0123456789abcdefg'].join('_');

// GITLEAKS_CONFIG is honoured even with no --config flag, so the default-rules pass below
// would silently become "whatever that env var points at". Strip it rather than assume.
function scannerEnv() {
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  return env;
}

function scan(dir, report, configPath) {
  const args = [
    'dir',
    dir,
    '--no-banner',
    '--redact',
    '--report-format',
    'json',
    '--report-path',
    report,
  ];
  if (configPath !== undefined) args.push('--config', configPath);
  return spawnSync(GITLEAKS_BIN, args, { encoding: 'utf8', env: scannerEnv() });
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'gitleaks-fixture-'));
  try {
    cpSync(join(FIXTURE_DIR, LEAKY_FIXTURE), join(tmp, LEAKY_FIXTURE));
    cpSync(join(FIXTURE_DIR, CLEAN_FIXTURE), join(tmp, CLEAN_FIXTURE));

    // 1. The scanner fires at all. Scanned WITHOUT the repo config, so no allowlist here
    //    can hide the bait from the one check that proves gitleaks works.
    const defaultReport = join(tmp, REPORT_FILE);
    const defaultRun = scan(tmp, defaultReport, undefined);
    const ran = interpretGitleaksRun(defaultRun);
    if (!ran.ok) {
      console.error(`[check-gitleaks-fixture] ${ran.reason}`);
      process.exit(1);
    }
    const verdict = assertExpectedFindings(JSON.parse(readFileSync(defaultReport, 'utf8')));
    if (!verdict.ok) {
      console.error(`[check-gitleaks-fixture] ${verdict.reason}`);
      process.exit(1);
    }

    // 2. The REPO CONFIG still catches secrets. Step 1 cannot see this — it never loads
    //    .gitleaks.toml — so an allowlist widened to `paths = ['''.*''']` would neuter the
    //    real scan while step 1 stayed green and ci-gate went green with it. This scans a
    //    DIFFERENT, non-exempt secret under the repo config. It must still fire.
    const probeDir = mkdtempSync(join(tmpdir(), 'gitleaks-config-probe-'));
    try {
      writeFileSync(join(probeDir, PROBE_FILE), `export const t = '${PROBE_TOKEN}';\n`);
      const probeReport = join(probeDir, REPORT_FILE);
      const probeRun = scan(probeDir, probeReport, resolve(REPO_CONFIG));
      const probeRan = interpretGitleaksRun(probeRun);
      const neutered = `The repo config no longer detects a secret it is supposed to detect. An allowlist widened past the token it was written for — a "paths" entry (which exempts a file from EVERY rule), or an over-broad regex — disables the scanner for the REAL scan while the default-rules check above keeps passing. That is a green gate over no scanning at all.`;

      if (!probeRan.ok) {
        console.error(
          `[check-gitleaks-fixture] under ${REPO_CONFIG}: ${probeRan.reason}\n\n${neutered}`,
        );
        process.exit(1);
      }
      if (!existsSync(probeReport)) {
        console.error(
          `[check-gitleaks-fixture] gitleaks reported leaks under ${REPO_CONFIG} but wrote no report to ${probeReport}.`,
        );
        process.exit(1);
      }
      const probeRules = JSON.parse(readFileSync(probeReport, 'utf8')).map((f) => String(f.RuleID));
      for (const rule of EXPECTED_RULES) {
        if (!probeRules.includes(rule)) {
          console.error(
            `[check-gitleaks-fixture] under ${REPO_CONFIG}, a non-allowlisted secret did NOT trigger "${rule}" (found: ${probeRules.join(', ') || 'none'}).\n\n${neutered}`,
          );
          process.exit(1);
        }
      }
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }

    console.log(
      `[check-gitleaks-fixture] PASS — gitleaks fires on ${LEAKY_FIXTURE} (${EXPECTED_RULES.join(', ')}), stays silent on ${CLEAN_FIXTURE}, and ${REPO_CONFIG} still catches a secret it does not allowlist.`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
