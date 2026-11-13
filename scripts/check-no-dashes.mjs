#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const DASHES = [EM_DASH, EN_DASH];
const BINARY_PROBE_BYTES = 8000;
const NUL = 0;
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

const ALLOWLIST = [
  {
    path: 'AGENTS.md',
    fromLine: '## This is NOT the Next.js you know',
    toLine: '<!-- END:nextjs-agent-rules -->',
    reason:
      '`next dev` writes and re-adds this block on every run, so removing its dashes only recreates an uncommitted change.',
  },
];

const root = path.resolve(process.argv[2] ?? '.');

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: MAX_GIT_OUTPUT_BYTES,
})
  .split('\0')
  .filter(Boolean);

function isBinary(buffer) {
  return buffer.subarray(0, BINARY_PROBE_BYTES).includes(NUL);
}

function allowanceFor(file) {
  return ALLOWLIST.find((entry) => entry.path === file);
}

if (tracked.length === 0) {
  console.error(`✗ no-dashes: no tracked file found under ${root}, nothing was checked.`);
  process.exit(1);
}

const violations = [];
for (const file of tracked) {
  let buffer;
  try {
    buffer = readFileSync(path.join(root, file));
  } catch {
    continue;
  }
  if (isBinary(buffer)) continue;
  const lines = buffer.toString('utf8').split('\n');
  const allowance = allowanceFor(file);
  let inAllowedRegion = false;
  lines.forEach((line, index) => {
    if (allowance !== undefined && line.startsWith(allowance.fromLine)) inAllowedRegion = true;
    if (inAllowedRegion) {
      if (line.startsWith(allowance.toLine)) inAllowedRegion = false;
      return;
    }
    if (DASHES.some((dash) => line.includes(dash))) violations.push(`${file}:${index + 1}`);
  });
}

if (violations.length === 0) {
  console.log(`✓ no-dashes: ${tracked.length} tracked files scanned, 0 violations`);
  process.exit(0);
}

console.error(`✗ no-dashes: ${violations.length} line(s) hold an em or en dash:`);
for (const v of violations) console.error(`  ${v}`);
console.error(
  '  Use a comma, colon, period or parentheses. Dashes are never sentence punctuation.',
);
process.exit(1);
