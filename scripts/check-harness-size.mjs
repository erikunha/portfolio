#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIMITS = JSON.parse(readFileSync(new URL('./harness-size.json', import.meta.url), 'utf8'));

let failed = false;

for (const [file, { maxLines }] of Object.entries(LIMITS)) {
  const filePath = resolve(file);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    process.stderr.write(`[harness-size] ${file} not found at ${filePath}\n`);
    failed = true;
    continue;
  }

  const lines = content.split('\n').length;

  if (lines > maxLines) {
    process.stderr.write(
      `[harness-size] FAIL: ${file} is ${lines} lines (max ${maxLines}).\n` +
        '  Rules past the threshold degrade silently; the model stops applying them.\n' +
        '  Trim before adding new rules: collapse prose to tables, move decisions to DECISIONS.md,\n' +
        '  move path-specific rules to a path-scoped rule file.\n',
    );
    failed = true;
    continue;
  }

  process.stdout.write(`[harness-size] OK ${file} (${lines}/${maxLines} lines)\n`);
}

process.exit(failed ? 1 : 0);
