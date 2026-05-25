#!/usr/bin/env node
// Checks that CLAUDE.md (project-level AI harness) stays within the effective
// attention window. Context files above ~300 lines lose tail content to model
// attention degradation — rules near the bottom stop firing reliably.
//
// Threshold: 250 lines (current ~217 after P3-8 split; process rules live in CLAUDE-process.md).
// When triggered: trim rules that duplicate STANDARDS.md, collapse prose into
// bullet tables, or move process/merge rules to CLAUDE-process.md.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_LINES = 250;
const filePath = resolve('CLAUDE.md');

let content;
try {
  content = readFileSync(filePath, 'utf8');
} catch {
  process.stderr.write(`[harness-size] CLAUDE.md not found at ${filePath}\n`);
  process.exit(1);
}

const lines = content.split('\n').length;

if (lines > MAX_LINES) {
  process.stderr.write(
    `[harness-size] FAIL — CLAUDE.md is ${lines} lines (max ${MAX_LINES}).\n` +
      '  Rules past the threshold degrade silently; the model stops applying them.\n' +
      '  Trim before adding new rules: collapse prose → tables, move decisions → DECISIONS.md.\n',
  );
  process.exit(1);
}

process.stdout.write(`[harness-size] OK (${lines}/${MAX_LINES} lines)\n`);
