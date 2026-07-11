#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentDispatchedAfter, readTranscript } from './lib/transcript.mjs';
import { BATTERY_ROLES, candidateProjectDirs, resolveTranscriptPath } from './review-stamp';

export interface RoleStatus {
  role: string;
  detected: boolean;
}

export function summarizeRoles(
  records: Array<Record<string, unknown>>,
  headCommitIso: string,
): RoleStatus[] {
  return BATTERY_ROLES.map((r) => ({
    role: r.role,
    detected: r.accepts.some((agent) => agentDispatchedAfter(records, agent, headCommitIso)),
  }));
}

function headCommitIso(): string {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
  } catch {
    return '(no git / no commit)';
  }
}

function main(): void {
  console.log('transcript:doctor');
  console.log(
    `  override (REVIEW_STAMP_TRANSCRIPT): ${process.env.REVIEW_STAMP_TRANSCRIPT ?? '(unset)'}`,
  );

  console.log('  candidate project dirs:');
  for (const dir of candidateProjectDirs()) {
    console.log(`    ${existsSync(dir) ? '✓' : '✗'} ${dir}`);
  }

  const path = resolveTranscriptPath();
  if (!path) {
    console.log('  resolved transcript: NONE — gates fail-closed here.');
    console.log('  Fix: set REVIEW_STAMP_TRANSCRIPT=<abs path to the session .jsonl>.');
    return;
  }
  console.log(`  resolved transcript: ${path}`);

  const records = readTranscript(path);
  console.log(`  records parsed: ${records.length}`);
  const headIso = headCommitIso();
  console.log(`  HEAD commit time: ${headIso}`);
  console.log('  battery roles detected after HEAD:');
  for (const { role, detected } of summarizeRoles(records, headIso)) {
    console.log(`    ${detected ? '✓' : '✗'} ${role}`);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
