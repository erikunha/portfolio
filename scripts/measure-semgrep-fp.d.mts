export const EXPECTED_KNOWN_FALSE_POSITIVES: number;

export type ProbeKind = 'true-positive' | 'known-false-positive' | 'negative';
export type ProbeExpectation = 'finding' | 'quiet';

export type Probe = {
  file: string;
  expect: ProbeExpectation;
  rule: string;
  kind: ProbeKind;
  why: string;
};

export type Manifest = {
  note?: string;
  probes: Probe[];
};

export type SemgrepResult = { path?: string; check_id?: string };

export type Match = { file: string; rule: string; expected: string };

export type Measurement = {
  probes: number;
  truePositives: Match[];
  knownFalsePositives: Match[];
  falsePositives: Match[];
  falseNegatives: Match[];
  unexpectedRules: Match[];
  unexpectedFiles: string[];
};

export type ExitDecision = {
  code: 0 | 1 | 2;
  level: 'OK' | 'FALSE POSITIVE' | 'RULE REGRESSION' | 'BASELINE MOVED' | 'INFRA';
  message: string;
};

export type SpawnResult = {
  error?: { message?: string };
  status: number | null;
  stdout: string;
  stderr?: string;
};

export type Scan =
  | { ok: true; json: { results?: SemgrepResult[]; errors?: unknown[] } }
  | { ok: false; reason: string };

export type RunOptions = {
  runner?: (scanDir: string) => Scan;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  err?: (message: string) => void;
  probeDir?: string;
};

export function loadManifest(dir?: string): Manifest;
export function classifyProbes(results: SemgrepResult[], manifest: Manifest): Measurement;
export function decideExit(measurement: Measurement | null | undefined): ExitDecision;
export function interpretSemgrepRun(res: SpawnResult): Scan;
export function runSemgrepJson(scanDir: string): Scan;
export function run(options?: RunOptions): void;
