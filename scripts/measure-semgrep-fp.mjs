#!/usr/bin/env node

/**
 * Measures what the vendored Semgrep rules do, so the false-positive rate the
 * promotion decision needs is a number a gate holds rather than a claim in a
 * document.
 *
 * The decision of 2026-06-19 asks for the false-positive rate on this
 * codebase, measured over at least three representative pull requests, before
 * the scan can block a merge. The rate on the codebase turns out to have an
 * empty denominator: the scan reports nothing on `main` and nothing on the
 * three pull requests measured. This script measures the other half of the
 * question, the precision of the rules themselves, over a probe set that
 * declares what each rule must do with each input.
 *
 * A probe that fires when it is declared quiet is a false positive. A probe
 * that stays quiet when it is declared a finding is a rule regression. The
 * count of known false positives is asserted, so a rule that changes shape
 * without the decision changing fails here.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROBE_DIR = 'tests/fixtures/semgrep/probes';
const VENDORED_CONFIG = '.semgrep';

/**
 * How many false positives the probe set declares today. The decision records
 * this number, and a change here is a change to the rules that the decision
 * has not seen.
 */
export const EXPECTED_KNOWN_FALSE_POSITIVES = 1;

export function loadManifest(dir = PROBE_DIR) {
  const raw = readFileSync(join(dir, 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

function baseName(path) {
  return String(path ?? '')
    .split('/')
    .pop();
}

function ruleId(checkId) {
  const id = String(checkId ?? '');
  const parts = id.split('.');
  return parts[parts.length - 1];
}

/**
 * Compares what the rules did against what each probe declares. Every probe
 * is accounted for: a probe that produced no finding is a false negative when
 * it declared one, and a finding on a probe that declared quiet is a false
 * positive.
 */
export function classifyProbes(results, manifest) {
  const probes = manifest?.probes ?? [];
  const byFile = new Map();
  for (const result of results ?? []) {
    const file = baseName(result?.path);
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(ruleId(result?.check_id));
  }

  const truePositives = [];
  const knownFalsePositives = [];
  const falsePositives = [];
  const falseNegatives = [];
  const unexpectedRules = [];

  for (const probe of probes) {
    const fired = byFile.get(probe.file) ?? [];
    if (probe.expect === 'quiet') {
      for (const rule of fired) {
        falsePositives.push({ file: probe.file, rule, expected: 'quiet' });
      }
      continue;
    }
    if (!fired.includes(probe.rule)) {
      falseNegatives.push({ file: probe.file, rule: probe.rule, expected: 'finding' });
      continue;
    }
    for (const rule of fired) {
      if (rule === probe.rule) continue;
      unexpectedRules.push({ file: probe.file, rule, expected: probe.rule });
    }
    if (probe.kind === 'known-false-positive') {
      knownFalsePositives.push({ file: probe.file, rule: probe.rule });
    } else {
      truePositives.push({ file: probe.file, rule: probe.rule });
    }
  }

  const unexpectedFiles = [...byFile.keys()].filter(
    (file) => !probes.some((probe) => probe.file === file),
  );

  return {
    probes: probes.length,
    truePositives,
    knownFalsePositives,
    falsePositives,
    falseNegatives,
    unexpectedRules,
    unexpectedFiles,
  };
}

/**
 * The verdict. A false positive the probe set does not declare, a missing
 * finding, a rule that fired where another was expected, a file the manifest
 * does not name, and a known false positive count that moved are each a
 * failure: every one of them means the rules changed shape and the recorded
 * decision has not seen it.
 */
export function decideExit(measurement) {
  if (!measurement) return { code: 2, level: 'INFRA', message: 'no measurement' };
  if (measurement.falsePositives.length > 0) {
    return {
      code: 1,
      level: 'FALSE POSITIVE',
      message: `${measurement.falsePositives.length} probe(s) fired and were declared quiet: ${measurement.falsePositives
        .map((f) => `${f.file} (${f.rule})`)
        .join(', ')}`,
    };
  }
  if (measurement.falseNegatives.length > 0) {
    return {
      code: 1,
      level: 'RULE REGRESSION',
      message: `${measurement.falseNegatives.length} probe(s) were declared a finding and stayed quiet: ${measurement.falseNegatives
        .map((f) => `${f.file} (${f.rule})`)
        .join(', ')}`,
    };
  }
  if (measurement.unexpectedRules.length > 0) {
    return {
      code: 1,
      level: 'RULE REGRESSION',
      message: `a probe fired a rule the manifest does not name: ${measurement.unexpectedRules
        .map((f) => `${f.file} (${f.rule})`)
        .join(', ')}`,
    };
  }
  if (measurement.unexpectedFiles.length > 0) {
    return {
      code: 1,
      level: 'RULE REGRESSION',
      message: `the scan reported a file the manifest does not name: ${measurement.unexpectedFiles.join(', ')}`,
    };
  }
  if (measurement.knownFalsePositives.length !== EXPECTED_KNOWN_FALSE_POSITIVES) {
    return {
      code: 1,
      level: 'BASELINE MOVED',
      message: `the known false positives are ${measurement.knownFalsePositives.length}, the decision records ${EXPECTED_KNOWN_FALSE_POSITIVES}`,
    };
  }
  const fired = measurement.truePositives.length + measurement.knownFalsePositives.length;
  const precision = fired === 0 ? 0 : measurement.truePositives.length / fired;
  return {
    code: 0,
    level: 'OK',
    message:
      `probes=${measurement.probes} findings=${fired} ` +
      `true-positives=${measurement.truePositives.length} ` +
      `known-false-positives=${measurement.knownFalsePositives.length} ` +
      `false-positives=${measurement.falsePositives.length} ` +
      `false-negatives=${measurement.falseNegatives.length} ` +
      `precision=${(precision * 100).toFixed(1)}%`,
  };
}

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

export function runSemgrepJson(scanDir) {
  const cmd = process.env.SEMGREP_BIN || 'semgrep';
  const res = spawnSync(
    cmd,
    ['scan', '--config', VENDORED_CONFIG, '--json', '--metrics', 'off', scanDir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return interpretSemgrepRun(res);
}

export function run({
  runner = runSemgrepJson,
  exit = process.exit,
  log = console.log,
  err = console.error,
  probeDir = PROBE_DIR,
} = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'semgrep-fp-'));
  let code = 0;
  try {
    const manifest = loadManifest(probeDir);
    // The repository's .semgrepignore excludes tests/fixtures/, so the probes
    // are copied out before the scan, the same way the fixture self-test does
    // it. Scanning them in place would measure an empty directory.
    cpSync(probeDir, join(tmp, 'probes'), { recursive: true });
    const scan = runner(join(tmp, 'probes'));
    if (!scan.ok) {
      err(`[measure-semgrep-fp] INFRA: ${scan.reason}`);
      code = 2;
    } else {
      const measurement = classifyProbes(scan.json.results ?? [], manifest);
      const decision = decideExit(measurement);
      if (decision.code === 0) log(`[measure-semgrep-fp] OK: ${decision.message}`);
      else err(`[measure-semgrep-fp] ${decision.level}: ${decision.message}`);
      code = decision.code;
    }
  } catch (e) {
    err(`[measure-semgrep-fp] INFRA: ${e?.message ?? String(e)}`);
    code = 2;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return exit(code);
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  run();
