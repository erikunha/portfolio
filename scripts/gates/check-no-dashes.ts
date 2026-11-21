#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gitText } from '../lib/git';
import { isMain } from '../lib/is-main';

const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const DASHES = [EM_DASH, EN_DASH];
const BINARY_PROBE_BYTES = 8000;
const NUL = 0;
const NUL_SEPARATOR = '\0';
const LINE_BREAK = '\n';
const FAILURE_EXIT = 1;

interface Allowance {
  path: string;
  fromLine: string;
  toLine: string;
  reason: string;
}

const ALLOWLIST: Allowance[] = [
  {
    path: 'AGENTS.md',
    fromLine: '## This is NOT the Next.js you know',
    toLine: '<!-- END:nextjs-agent-rules -->',
    reason:
      '`next dev` writes and re-adds this block on every run, so removing its dashes only recreates an uncommitted change.',
  },
];

function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, BINARY_PROBE_BYTES).includes(NUL);
}

function allowanceFor(file: string): Allowance | undefined {
  return ALLOWLIST.find((entry) => entry.path === file);
}

function scanFile(file: string, buffer: Buffer): number[] {
  const allowance = allowanceFor(file);
  const hits: number[] = [];
  let inAllowedRegion = false;
  buffer
    .toString('utf8')
    .split(LINE_BREAK)
    .forEach((line, index) => {
      if (allowance && line.startsWith(allowance.fromLine)) inAllowedRegion = true;
      if (inAllowedRegion) {
        if (allowance && line.startsWith(allowance.toLine)) inAllowedRegion = false;
        return;
      }
      if (DASHES.some((dash) => line.includes(dash))) hits.push(index + 1);
    });
  return hits;
}

function main(): void {
  const root = path.resolve(process.argv[2] ?? '.');
  const tracked = gitText(['ls-files', '-z'], { cwd: root, trim: false })
    .split(NUL_SEPARATOR)
    .filter(Boolean);

  if (tracked.length === 0) {
    console.error(`✗ no-dashes: no tracked file found under ${root}, nothing was checked.`);
    process.exit(FAILURE_EXIT);
  }

  const violations: string[] = [];
  for (const file of tracked) {
    let buffer: Buffer;
    try {
      buffer = readFileSync(path.join(root, file));
    } catch {
      continue;
    }
    if (isBinary(buffer)) continue;
    for (const line of scanFile(file, buffer)) violations.push(`${file}:${line}`);
  }

  if (violations.length === 0) {
    console.log(`✓ no-dashes: ${tracked.length} tracked files scanned, 0 violations`);
    return;
  }

  console.error(`✗ no-dashes: ${violations.length} line(s) hold an em or en dash:`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    '  Use a comma, colon, period or parentheses. Dashes are never sentence punctuation.',
  );
  process.exit(FAILURE_EXIT);
}

if (isMain(import.meta.url)) main();
