#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentDispatchedAfter, readTranscript } from './lib/transcript.mjs';
import {
  ARCHIVE_PATH,
  archiveRecords,
  blockingFindings,
  invalidResolutions,
  readLedger,
} from './review-findings';

export const BATTERY_ROLES: ReadonlyArray<{ role: string; accepts: readonly string[] }> = [
  {
    role: 'code-review',
    accepts: ['pr-review-toolkit:review-pr', 'pr-review-toolkit:code-reviewer', 'code-reviewer'],
  },
  { role: 'security', accepts: ['security-auditor'] },
  { role: 'performance', accepts: ['performance-engineer'] },
  { role: 'dependencies', accepts: ['dependency-auditor', 'dependency-manager'] },
];

type TranscriptRecord = Record<string, unknown>;

export interface StampDecision {
  write: boolean;
  missing: string[];
  reason: string;
}

export function decideStamp(args: {
  records: TranscriptRecord[];
  transcriptResolved: boolean;
  headCommitIso: string;
  findings?: { present: boolean; blocking: string[]; invalid: string[] };
}): StampDecision {
  if (!args.transcriptResolved) {
    return {
      write: false,
      missing: BATTERY_ROLES.map((r) => r.role),
      reason:
        'Could not resolve the session transcript (fail-closed). Set REVIEW_STAMP_TRANSCRIPT=<abs path> to point at it.',
    };
  }
  const missing = BATTERY_ROLES.filter(
    (r) =>
      !r.accepts.some((agent) => agentDispatchedAfter(args.records, agent, args.headCommitIso)),
  ).map((r) => r.role);
  if (missing.length > 0) {
    return {
      write: false,
      missing,
      reason: `Review battery incomplete since the HEAD commit. Missing role(s): ${missing.join(', ')}.`,
    };
  }
  if (args.findings) {
    if (!args.findings.present) {
      return {
        write: false,
        missing: [],
        reason:
          'No findings ledger (.review-findings.json). Run battery-synthesis to record the cycle findings, then stamp.',
      };
    }
    if (args.findings.invalid.length > 0) {
      return {
        write: false,
        missing: [],
        reason: `Resolved/justified finding(s) missing a reason: ${args.findings.invalid.join(', ')}.`,
      };
    }
    if (args.findings.blocking.length > 0) {
      return {
        write: false,
        missing: [],
        reason: `Open Critical/Important finding(s) block the stamp: ${args.findings.blocking.join(', ')}.`,
      };
    }
  }
  return {
    write: true,
    missing: [],
    reason: 'All five battery roles dispatched after HEAD; findings resolved or justified.',
  };
}

export function candidateProjectDirs(): string[] {
  const slugDir = (abs: string): string =>
    join(homedir(), '.claude', 'projects', abs.replace(/\//g, '-'));
  const dirs = [slugDir(process.cwd())];
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8' },
    ).trim();
    const mainRoot = gitCommonDir.replace(/\/\.git\/?$/, '');
    if (mainRoot) dirs.push(slugDir(mainRoot));
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  } catch {}
  return [...new Set(dirs)];
}

export function resolveTranscriptPath(): string | null {
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

  const headCommitIso = execFileSync('git', ['log', '-1', '--format=%cI'], {
    encoding: 'utf8',
  }).trim();

  const ledger = readLedger();
  const findings = {
    present: ledger !== null,
    blocking: ledger ? blockingFindings(ledger).map((f) => `${f.id} ${f.title}`) : [],
    invalid: ledger ? invalidResolutions(ledger).map((f) => `${f.id} ${f.title}`) : [],
  };

  const decision = decideStamp({ records, transcriptResolved, headCommitIso, findings });

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

  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const apiMarker = join(repoRoot, '.claude', '.api-edit-pending');
  if (existsSync(apiMarker)) {
    const lines = readFileSync(apiMarker, 'utf8').trim().split('\n').filter(Boolean);
    const latestTs = lines.at(-1)?.split('\t')[0] ?? '';
    if (latestTs && agentDispatchedAfter(records, 'security-auditor', latestTs)) {
      rmSync(apiMarker, { force: true });
    }
  }

  if (ledger && ledger.length > 0) {
    appendFileSync(ARCHIVE_PATH, archiveRecords(ledger, headSha, headCommitIso));
  }

  console.log(
    `✓ review:stamp written (${headSha}); battery dispatched and findings resolved this cycle.`,
  );
  console.log('  Boundary: the stamp cannot know about a finding you never recorded.');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
