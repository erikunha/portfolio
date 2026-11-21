import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const VENDORED_CONFIG = '.semgrep';

const DEFAULT_SEMGREP_BIN = 'semgrep';
const BYTES_PER_MIB = 1024 * 1024;
const JSON_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB;
const STDERR_EXCERPT_CHARS = 400;
const SCAN_ERROR_SUMMARY_LIMIT = 3;
const PATH_SEPARATOR = '/';
const SCAN_ERROR_SEPARATOR = '; ';

export interface SemgrepResult {
  path?: string | undefined;
  check_id?: string | undefined;
}

export interface SemgrepScanError {
  message?: string;
  type?: string;
}

export interface SemgrepJson {
  results?: SemgrepResult[];
  errors?: SemgrepScanError[];
}

export interface SpawnOutcome {
  error?: { message?: string } | undefined;
  status: number | null;
  stdout: string;
  stderr?: string | undefined;
}

export type Scan = { ok: true; json: SemgrepJson } | { ok: false; reason: string };

export interface ScratchSource {
  from: string;
  to: string;
}

export function semgrepBin(): string {
  return process.env.SEMGREP_BIN || DEFAULT_SEMGREP_BIN;
}

export function interpretSemgrepRun(res: SpawnOutcome): Scan {
  if (res.error || res.status === null) {
    return {
      ok: false,
      reason: `semgrep failed to run: ${res.error?.message ?? 'no exit status'}`,
    };
  }
  let json: SemgrepJson;
  try {
    json = JSON.parse(res.stdout) as SemgrepJson;
  } catch (e) {
    return {
      ok: false,
      reason: `unparseable semgrep JSON (stderr: ${res.stderr?.slice(0, STDERR_EXCERPT_CHARS) ?? ''}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const errors = json.errors ?? [];
  if (errors.length > 0) {
    const summary = errors
      .slice(0, SCAN_ERROR_SUMMARY_LIMIT)
      .map((x) => x.message ?? x.type ?? 'unknown')
      .join(SCAN_ERROR_SEPARATOR);
    return { ok: false, reason: `semgrep reported ${errors.length} scan error(s): ${summary}` };
  }
  return { ok: true, json };
}

export function runSemgrepJson(scanDir: string): Scan {
  const res = spawnSync(
    semgrepBin(),
    ['scan', '--config', VENDORED_CONFIG, '--json', '--metrics', 'off', scanDir],
    { encoding: 'utf8', maxBuffer: JSON_MAX_BUFFER_BYTES },
  );
  return interpretSemgrepRun(res);
}

export function resultBaseName(path: string | undefined): string {
  return String(path ?? '')
    .split(PATH_SEPARATOR)
    .pop() as string;
}

export function withScratchCopy<T>(
  prefix: string,
  sources: ScratchSource[],
  use: (scratchDir: string) => T,
): T {
  const scratchDir = mkdtempSync(join(tmpdir(), prefix));
  try {
    for (const { from, to } of sources) cpSync(from, join(scratchDir, to), { recursive: true });
    return use(scratchDir);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}
