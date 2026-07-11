export const EXPECTED_RULES: readonly string[];

export type SemgrepResult = { path?: string; check_id?: string };
export type Verdict = { ok: true } | { ok: false; reason: string };
export type Scan =
  | { ok: true; json: { results?: SemgrepResult[]; errors?: unknown[] } }
  | { ok: false; reason: string };
export type SpawnResult = {
  error?: { message?: string };
  status: number | null;
  stdout: string;
  stderr?: string;
};
export type ExitDecision = {
  code: 0 | 1 | 2;
  level: 'OK' | 'RULE REGRESSION' | 'INFRA';
  message: string;
};
export type RunOptions = {
  runner?: (scanDir: string) => Scan;
  exit?: (code: number) => void;
  log?: (message: string) => void;
  err?: (message: string) => void;
};

export function assertExpectedFindings(results: SemgrepResult[]): Verdict;
export function interpretSemgrepRun(res: SpawnResult): Scan;
export function decideExit(scan: Scan): ExitDecision;
export function run(options?: RunOptions): void;
