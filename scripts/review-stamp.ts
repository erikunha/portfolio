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
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  agentDispatchedAfter,
  agentsDispatchedSince,
  lastUserCommitMarker,
  readTranscript,
} from './lib/transcript.mjs';

/**
 * The five-agent review battery as ROLES, each satisfied by ANY of its accepted
 * `subagent_type` strings. The strings were captured from real session
 * transcripts (2026-06-04). The code-review role is dispatched as EITHER the
 * orchestrator skill's agent (`pr-review-toolkit:review-pr`) OR the reviewer
 * agent directly (`pr-review-toolkit:code-reviewer`) — both appear live, so the
 * role accepts either; pinning a single string here over-blocks the real
 * workflow (the bug this role model fixes).
 */
export const BATTERY_ROLES: ReadonlyArray<{ role: string; accepts: readonly string[] }> = [
  {
    role: 'code-review',
    accepts: ['pr-review-toolkit:review-pr', 'pr-review-toolkit:code-reviewer'],
  },
  { role: 'accessibility', accepts: ['accessibility-tester'] },
  { role: 'security', accepts: ['security-auditor'] },
  { role: 'performance', accepts: ['performance-engineer'] },
  { role: 'dependencies', accepts: ['dependency-manager'] },
];

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
 * - transcriptResolved === false  -> refuse, report every role missing
 *   (fail-closed; the caller could not even find the transcript).
 * - else scope to dispatches AFTER the last commit and require every role to be
 *   satisfied by at least one of its accepted subagent_type strings.
 */
export function decideStamp(args: {
  records: TranscriptRecord[];
  transcriptResolved: boolean;
}): StampDecision {
  if (!args.transcriptResolved) {
    return {
      write: false,
      missing: BATTERY_ROLES.map((r) => r.role),
      reason:
        'Could not resolve the session transcript (fail-closed). Set REVIEW_STAMP_TRANSCRIPT=<abs path> to point at it.',
    };
  }
  const boundary = lastUserCommitMarker(args.records);
  const dispatched = new Set<string>(agentsDispatchedSince(args.records, boundary));
  const missing = BATTERY_ROLES.filter(
    (r) => !r.accepts.some((agent) => dispatched.has(agent)),
  ).map((r) => r.role);
  if (missing.length > 0) {
    return {
      write: false,
      missing,
      reason: `Review battery incomplete since last commit. Missing role(s): ${missing.join(', ')}.`,
    };
  }
  return { write: true, missing: [], reason: 'All five battery roles dispatched this cycle.' };
}

/**
 * Candidate Claude project dirs to search for the session transcript, in
 * priority order. The slug is the absolute path with `/` -> `-`.
 *
 * WORKTREE CAVEAT (verified live 2026-06-04): when the session runs in a git
 * worktree, Claude Code stores the MAIN session transcript under the BASE repo
 * slug (`-...-erik-portifolio/<uuid>.jsonl`), NOT the worktree slug — the
 * worktree-slug dir holds only a `<uuid>/subagents/` subtree. Deriving the slug
 * from cwd alone (the worktree) finds nothing and fails closed forever. So we
 * also derive the main-repo root from the common git dir and search its slug.
 */
function candidateProjectDirs(): string[] {
  const slugDir = (abs: string): string =>
    join(homedir(), '.claude', 'projects', abs.replace(/\//g, '-'));
  const dirs = [slugDir(process.cwd())];
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8' },
    ).trim();
    // <mainRepoRoot>/.git -> <mainRepoRoot>; only adds a distinct base slug
    // when cwd is a worktree (otherwise it equals the cwd slug, deduped below).
    const mainRoot = gitCommonDir.replace(/\/\.git\/?$/, '');
    if (mainRoot) dirs.push(slugDir(mainRoot));
  } catch {
    // No git / not resolvable: the cwd slug stands alone.
  }
  return [...new Set(dirs)];
}

/**
 * Resolve the newest session transcript. Honors REVIEW_STAMP_TRANSCRIPT for an
 * explicit override. Searches each candidate project dir (cwd slug + base-repo
 * slug for worktrees) for the newest top-level `*.jsonl` by mtime. Returns null
 * when nothing can be resolved (caller fails closed).
 */
function resolveTranscriptPath(): string | null {
  const override = process.env.REVIEW_STAMP_TRANSCRIPT;
  if (override) return existsSync(override) ? override : null;

  let newest: { path: string; mtimeMs: number } | null = null;
  for (const projectDir of candidateProjectDirs()) {
    if (!existsSync(projectDir)) continue;
    for (const entry of readdirSync(projectDir)) {
      if (!entry.endsWith('.jsonl')) continue;
      const full = join(projectDir, entry);
      const { mtimeMs } = statSync(full);
      if (!newest || mtimeMs > newest.mtimeMs) newest = { path: full, mtimeMs };
    }
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

  // Clear the API-edit marker ONLY if security-auditor was dispatched AFTER the
  // most recent marker entry (ordering): a stale pre-edit audit must not clear a
  // later edit. The durable .husky/pre-push gate blocks on ANY non-empty marker,
  // so incorrectly clearing it here would silently defeat that gate — hence the
  // strict timestamp check rather than "security-auditor ran at some point."
  const apiMarker = join('.claude', '.api-edit-pending');
  if (existsSync(apiMarker)) {
    const lines = readFileSync(apiMarker, 'utf8').trim().split('\n').filter(Boolean);
    const latestTs = lines.at(-1)?.split('\t')[0] ?? '';
    if (latestTs && agentDispatchedAfter(records, 'security-auditor', latestTs)) {
      rmSync(apiMarker, { force: true });
    }
  }

  console.log(
    `✓ review:stamp written (${headSha}) — all five battery agents dispatched this cycle.`,
  );
  console.log('  Note: this proves DISPATCH, not that findings were fixed. That is on you.');
}

// Run only as a CLI, not when imported by tests. import.meta.url vs argv[1].
const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
