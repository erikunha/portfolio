#!/usr/bin/env tsx
// scripts/review-stamp.ts
//
// Guarded replacement for the old `git rev-parse HEAD > .review-passed`.
// WS4: the stamp is the positive safety assertion that the full review battery
// ran this cycle. The old inline write was a rubber stamp — it proved only that
// the redirect ran, not that any reviewer was dispatched. This script REFUSES to
// write `.review-passed` unless the active session transcript shows all five
// battery agents dispatched since the last commit.
//
// HONEST BOUNDARY (dispatch-not-pass): this proves the five agents were
// DISPATCHED this review cycle. It does NOT prove their Critical/Important
// findings were fixed — that remains the operator's responsibility. CLAUDE.md
// states this explicitly; do not read the stamp as "all findings resolved."
//
// Fail policy: FAIL-CLOSED. If the transcript cannot be resolved (no JSONL under
// the cwd-derived project dir, or a read/parse failure), the script refuses to
// stamp and prints why. Absence of evidence must never become a green light —
// fail-open here would silently restore the rubber stamp this script exists to
// kill. Override the resolution with REVIEW_STAMP_TRANSCRIPT=<abs path> for the
// rare parallel-session misresolve.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { agentsDispatchedSince, lastUserCommitMarker, readTranscript } from './lib/transcript.mjs';

/** The five-agent review battery, as their captured `subagent_type` strings. */
export const BATTERY = [
  'pr-review-toolkit:review-pr',
  'accessibility-tester',
  'security-auditor',
  'performance-engineer',
  'dependency-manager',
] as const;

type TranscriptRecord = Record<string, unknown>;

export interface StampDecision {
  write: boolean;
  missing: string[];
  reason: string;
}

/**
 * Pure decision: given the transcript records (already resolved + parsed) and
 * whether resolution succeeded, decide whether to write the stamp.
 *
 * - transcriptResolved === false  -> refuse, report the whole battery missing
 *   (fail-closed; the caller could not even find the transcript).
 * - else scope to dispatches AFTER the last commit and require the full battery.
 */
export function decideStamp(args: {
  records: TranscriptRecord[];
  transcriptResolved: boolean;
}): StampDecision {
  if (!args.transcriptResolved) {
    return {
      write: false,
      missing: [...BATTERY],
      reason:
        'Could not resolve the session transcript (fail-closed). Set REVIEW_STAMP_TRANSCRIPT=<abs path> to point at it.',
    };
  }
  const boundary = lastUserCommitMarker(args.records);
  const dispatched = new Set<string>(agentsDispatchedSince(args.records, boundary));
  const missing = BATTERY.filter((agent) => !dispatched.has(agent));
  if (missing.length > 0) {
    return {
      write: false,
      missing,
      reason: `Review battery incomplete since last commit. Missing: ${missing.join(', ')}.`,
    };
  }
  return { write: true, missing: [], reason: 'All five battery agents dispatched this cycle.' };
}

/**
 * Resolve the newest session transcript for the current working directory.
 * Heuristic: ~/.claude/projects/<cwd-with-slashes-as-dashes>/<newest>.jsonl by
 * mtime. Honors REVIEW_STAMP_TRANSCRIPT for an explicit override. Returns null
 * when nothing can be resolved (caller fails closed).
 */
function resolveTranscriptPath(): string | null {
  const override = process.env.REVIEW_STAMP_TRANSCRIPT;
  if (override) return existsSync(override) ? override : null;

  const cwd = process.cwd();
  const slug = cwd.replace(/\//g, '-');
  const projectDir = join(homedir(), '.claude', 'projects', slug);
  if (!existsSync(projectDir)) return null;

  let newest: { path: string; mtimeMs: number } | null = null;
  for (const entry of readdirSync(projectDir)) {
    if (!entry.endsWith('.jsonl')) continue;
    const full = join(projectDir, entry);
    const { mtimeMs } = statSync(full);
    if (!newest || mtimeMs > newest.mtimeMs) newest = { path: full, mtimeMs };
  }
  return newest ? newest.path : null;
}

function main(): void {
  const transcriptPath = resolveTranscriptPath();
  const transcriptResolved = transcriptPath !== null;
  const records: TranscriptRecord[] = transcriptPath ? readTranscript(transcriptPath) : [];

  const decision = decideStamp({ records, transcriptResolved });

  if (!decision.write) {
    console.error('✗ review:stamp REFUSED — stamp not written.');
    console.error(`  ${decision.reason}`);
    if (decision.missing.length > 0) {
      console.error('  Dispatch the missing agent(s), then re-run: pnpm review:stamp');
    }
    process.exit(1);
  }

  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync('.review-passed', headSha);

  // The battery includes security-auditor; a passing stamp confirms it ran this
  // cycle, so clear the API-edit marker to prevent the push guard double-blocking.
  const apiMarker = join('.claude', '.api-edit-pending');
  if (existsSync(apiMarker)) rmSync(apiMarker, { force: true });

  console.log(
    `✓ review:stamp written (${headSha}) — all five battery agents dispatched this cycle.`,
  );
  console.log('  Note: this proves DISPATCH, not that findings were fixed. That is on you.');
}

// Run only as a CLI, not when imported by tests. import.meta.url vs argv[1].
const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
