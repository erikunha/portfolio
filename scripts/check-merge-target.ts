#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { sanitizeSecrets } from './lib/sanitize-secrets';

const execFileP = promisify(execFile);

export type MergeTargetResult =
  | { ok: true; baseRefName: string }
  | { ok: false; code: 'base_is_main' | 'empty_base' | 'gh_failure'; message: string };

export type GhExec = (args: string[]) => Promise<string>;

export function decideMergeTarget(baseRefName: string): MergeTargetResult {
  const base = baseRefName.trim();
  if (!base) {
    return {
      ok: false,
      code: 'empty_base',
      message: 'the PR base ref is empty; refusing to merge without a base',
    };
  }
  if (base === 'main') {
    return {
      ok: false,
      code: 'base_is_main',
      message:
        'refusing to merge: base is main. Agents squash-merge only PRs whose base is not main; merges into main are owner-only.',
    };
  }
  return { ok: true, baseRefName: base };
}

export async function evaluateMergeTarget(opts: {
  prNumber: number;
  ghExec: GhExec;
}): Promise<MergeTargetResult> {
  let baseRefName: string;
  try {
    baseRefName = (
      await opts.ghExec([
        'pr',
        'view',
        String(opts.prNumber),
        '--json',
        'baseRefName',
        '-q',
        '.baseRefName',
      ])
    ).trim();
  } catch (e) {
    return {
      ok: false,
      code: 'gh_failure',
      message: `gh pr view failed: ${(e as Error).message ?? String(e)}`,
    };
  }
  return decideMergeTarget(baseRefName);
}

async function defaultGhExec(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileP('gh', args, { encoding: 'utf8' });
    return stdout;
  } catch (e) {
    const err = e as Error & { stderr?: string };
    const stderr = typeof err.stderr === 'string' ? err.stderr.trim() : '';
    throw new Error(stderr ? `${err.message}: ${stderr}` : err.message);
  }
}

export async function resolvePrNumber(
  passed: string | undefined,
  ghExec: GhExec = defaultGhExec,
): Promise<number> {
  if (passed) {
    const m = /^#?(\d+)$/.exec(passed.trim()) ?? /\/pull\/(\d+)$/.exec(passed.trim());
    if (m) return Number(m[1]);
    throw new Error(`could not parse PR number from argument: ${passed}`);
  }
  const stdout = (await ghExec(['pr', 'view', '--json', 'number', '-q', '.number'])).trim();
  if (!/^\d+$/.test(stdout)) {
    throw new Error('could not infer PR number from current branch');
  }
  return Number(stdout);
}

async function main() {
  try {
    const prNumber = await resolvePrNumber(process.argv[2]);
    const result = await evaluateMergeTarget({ prNumber, ghExec: defaultGhExec });
    if (!result.ok) {
      process.stderr.write(
        sanitizeSecrets(`MERGE_TARGET_GATE_FAIL code=${result.code} ${result.message}\n`),
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`merge-target gate OK (pr=${prNumber}, base=${result.baseRefName})\n`);
    process.exitCode = 0;
  } catch (e) {
    process.stderr.write(
      sanitizeSecrets(`MERGE_TARGET_GATE_FAIL code=unknown ${(e as Error).message}\n`),
    );
    process.exitCode = 2;
  }
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) void main();
