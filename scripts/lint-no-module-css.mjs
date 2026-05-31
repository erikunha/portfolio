#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'grep',
  [
    '-r',
    '\\.module\\.css',
    '--include=*.tsx',
    '--include=*.ts',
    'app',
    'components',
    'design-system',
  ],
  { encoding: 'utf8' },
);

// grep exits 1 when no matches found — that is the success case here
if (result.status !== null && result.status !== 0 && result.status !== 1) {
  console.error('grep failed unexpectedly:', result.stderr);
  process.exit(2);
}

const output = (result.stdout ?? '').trim();
if (output) {
  console.error(`CSS module imports found:\n${output}`);
  process.exit(1);
}
console.log('No CSS module imports found.');
