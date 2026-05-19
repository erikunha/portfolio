#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hasAutoGenHeader } from './lib/copilot/auto-gen-header';

const SOURCE_PATTERNS = [/^CLAUDE\.md$/, /^scripts\/copilot-port\.config\.ts$/];

const GENERATED_PATTERNS = [
  /^\.github\/copilot-instructions\.md$/,
  /^\.github\/prompts\//,
  /^\.github\/chatmodes\//,
  /^\.github\/instructions\//,
  /^\.vscode\/mcp\.json$/,
];

export type DriftResult = { ok: true } | { ok: false; reason: string };

export function analyzeDrift(changedFiles: string[]): DriftResult {
  const sourceChanged = changedFiles.find((f) => SOURCE_PATTERNS.some((re) => re.test(f)));
  if (!sourceChanged) return { ok: true };

  const generatedChanged = changedFiles.some((f) => GENERATED_PATTERNS.some((re) => re.test(f)));
  if (generatedChanged) return { ok: true };

  return {
    ok: false,
    reason: `${sourceChanged} changed but no generated files updated. Run \`pnpm sync:copilot\` and commit the regenerated files.`,
  };
}

function readDirSafe(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function listGeneratedFiles(): string[] {
  const files: string[] = [];
  const githubEntries = readDirSafe('.github');
  if (githubEntries.includes('copilot-instructions.md')) {
    files.push('.github/copilot-instructions.md');
  }
  for (const subdir of ['prompts', 'chatmodes', 'instructions']) {
    const entries = readDirSafe(path.join('.github', subdir));
    for (const e of entries) files.push(path.join('.github', subdir, e));
  }
  return files;
}

function verifyAutoGenHeaders(): DriftResult {
  const files = listGeneratedFiles();
  const missing: string[] = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf8');
    if (!hasAutoGenHeader(content)) missing.push(f);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Generated files missing auto-gen header: ${missing.join(', ')}. Did someone hand-edit them?`,
    };
  }
  return { ok: true };
}

function main() {
  const range = process.argv[2];
  if (!range) {
    console.error('Usage: tsx scripts/check-copilot-drift.ts <git-diff-range>');
    process.exit(2);
  }

  // execFileSync avoids shell — no command injection even with attacker-controlled range.
  let changed: string[];
  try {
    const out = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
    changed = out.split('\n').filter(Boolean);
  } catch (e) {
    console.error(`git diff failed: ${(e as Error).message}`);
    process.exit(2);
  }

  const driftResult = analyzeDrift(changed);
  if (!driftResult.ok) {
    console.error(`DRIFT FAIL: ${driftResult.reason}`);
    process.exit(1);
  }

  const headerResult = verifyAutoGenHeaders();
  if (!headerResult.ok) {
    console.error(`HEADER FAIL: ${headerResult.reason}`);
    process.exit(1);
  }

  console.log('Copilot port drift check: OK');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
