import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from '../lib/is-main.ts';
import {
  resultBaseName,
  runSemgrepJson,
  type Scan,
  type SemgrepResult,
  withScratchCopy,
} from '../lib/semgrep.ts';

export { interpretSemgrepRun, runSemgrepJson } from '../lib/semgrep.ts';

const PROBE_DIR = 'tests/fixtures/semgrep/probes';
const MANIFEST_FILE = 'manifest.json';
const SCRATCH_PREFIX = 'semgrep-fp-';
const SCRATCH_PROBES = 'probes';
const TAG = '[measure-semgrep-fp]';
const RULE_ID_SEPARATOR = '.';
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_INFRA = 2;
const PERCENT = 100;
const PRECISION_DIGITS = 1;

export const EXPECTED_KNOWN_FALSE_POSITIVES = 1;

export type ProbeKind = 'true-positive' | 'known-false-positive' | 'negative';
export type ProbeExpectation = 'finding' | 'quiet';

export interface Probe {
  file: string;
  expect: ProbeExpectation;
  rule: string;
  kind: ProbeKind;
  why: string;
}

export interface Manifest {
  note?: string;
  probes: Probe[];
}

export interface Hit {
  file: string;
  rule: string;
}

export interface Match extends Hit {
  expected: string;
}

export interface Measurement {
  probes: number;
  truePositives: Hit[];
  knownFalsePositives: Hit[];
  falsePositives: Match[];
  falseNegatives: Match[];
  unexpectedRules: Match[];
  unexpectedFiles: string[];
}

export interface ExitDecision {
  code: 0 | 1 | 2;
  level: 'OK' | 'FALSE POSITIVE' | 'RULE REGRESSION' | 'BASELINE MOVED' | 'INFRA';
  message: string;
}

export interface RunOptions {
  runner?: (scanDir: string) => Scan;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  err?: (message: string) => void;
  probeDir?: string;
}

export function loadManifest(dir: string = PROBE_DIR): Manifest {
  return JSON.parse(readFileSync(join(dir, MANIFEST_FILE), 'utf8')) as Manifest;
}

function ruleId(checkId: string | undefined): string {
  return String(checkId ?? '')
    .split(RULE_ID_SEPARATOR)
    .pop() as string;
}

function describeMatches(matches: Match[]): string {
  return matches.map((match) => `${match.file} (${match.rule})`).join(', ');
}

export function classifyProbes(
  results: SemgrepResult[] | undefined,
  manifest: Manifest | undefined,
): Measurement {
  const probes = manifest?.probes ?? [];
  const byFile = new Map<string, string[]>();
  for (const result of results ?? []) {
    const file = resultBaseName(result?.path);
    const rules = byFile.get(file) ?? [];
    rules.push(ruleId(result?.check_id));
    byFile.set(file, rules);
  }

  const truePositives: Hit[] = [];
  const knownFalsePositives: Hit[] = [];
  const falsePositives: Match[] = [];
  const falseNegatives: Match[] = [];
  const unexpectedRules: Match[] = [];

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
    const matched = { file: probe.file, rule: probe.rule };
    if (probe.kind === 'known-false-positive') knownFalsePositives.push(matched);
    else truePositives.push(matched);
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

export function decideExit(measurement: Measurement | null | undefined): ExitDecision {
  if (!measurement) return { code: EXIT_INFRA, level: 'INFRA', message: 'no measurement' };
  if (measurement.falsePositives.length > 0) {
    return {
      code: EXIT_FAILURE,
      level: 'FALSE POSITIVE',
      message: `${measurement.falsePositives.length} probe(s) fired and were declared quiet: ${describeMatches(measurement.falsePositives)}`,
    };
  }
  if (measurement.falseNegatives.length > 0) {
    return {
      code: EXIT_FAILURE,
      level: 'RULE REGRESSION',
      message: `${measurement.falseNegatives.length} probe(s) were declared a finding and stayed quiet: ${describeMatches(measurement.falseNegatives)}`,
    };
  }
  if (measurement.unexpectedRules.length > 0) {
    return {
      code: EXIT_FAILURE,
      level: 'RULE REGRESSION',
      message: `a probe fired a rule the manifest does not name: ${describeMatches(measurement.unexpectedRules)}`,
    };
  }
  if (measurement.unexpectedFiles.length > 0) {
    return {
      code: EXIT_FAILURE,
      level: 'RULE REGRESSION',
      message: `the scan reported a file the manifest does not name: ${measurement.unexpectedFiles.join(', ')}`,
    };
  }
  if (measurement.knownFalsePositives.length !== EXPECTED_KNOWN_FALSE_POSITIVES) {
    return {
      code: EXIT_FAILURE,
      level: 'BASELINE MOVED',
      message: `the known false positives are ${measurement.knownFalsePositives.length}, the decision records ${EXPECTED_KNOWN_FALSE_POSITIVES}`,
    };
  }
  const fired = measurement.truePositives.length + measurement.knownFalsePositives.length;
  const precision = fired === 0 ? 0 : measurement.truePositives.length / fired;
  return {
    code: EXIT_OK,
    level: 'OK',
    message:
      `probes=${measurement.probes} findings=${fired} ` +
      `true-positives=${measurement.truePositives.length} ` +
      `known-false-positives=${measurement.knownFalsePositives.length} ` +
      `false-positives=${measurement.falsePositives.length} ` +
      `false-negatives=${measurement.falseNegatives.length} ` +
      `precision=${(precision * PERCENT).toFixed(PRECISION_DIGITS)}%`,
  };
}

export function run({
  runner = runSemgrepJson,
  exit = process.exit,
  log = console.log,
  err = console.error,
  probeDir = PROBE_DIR,
}: RunOptions = {}): void {
  let code: number = EXIT_OK;
  try {
    const manifest = loadManifest(probeDir);
    const outcome = withScratchCopy(
      SCRATCH_PREFIX,
      [{ from: probeDir, to: SCRATCH_PROBES }],
      (scratchDir) => runner(join(scratchDir, SCRATCH_PROBES)),
    );
    if (!outcome.ok) {
      err(`${TAG} INFRA: ${outcome.reason}`);
      code = EXIT_INFRA;
    } else {
      const decision = decideExit(classifyProbes(outcome.json.results ?? [], manifest));
      if (decision.code === EXIT_OK) log(`${TAG} OK: ${decision.message}`);
      else err(`${TAG} ${decision.level}: ${decision.message}`);
      code = decision.code;
    }
  } catch (e) {
    err(`${TAG} INFRA: ${e instanceof Error ? e.message : String(e)}`);
    code = EXIT_INFRA;
  }
  exit(code);
}

if (isMain(import.meta.url)) run();
