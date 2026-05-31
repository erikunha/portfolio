#!/usr/bin/env node
// Bans live var(--ds-*) references in component/app source files.
// Comments referencing --ds-* names are acceptable; only function calls are blocked.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'grep',
  [
    '-rn',
    'var(--ds-',
    '--include=*.tsx',
    '--include=*.ts',
    '--include=*.css',
    'components/',
    'app/',
  ],
  { encoding: 'utf8' },
);

const lines = (result.stdout || '')
  .trim()
  .split('\n')
  .filter(
    (l) =>
      l.trim() &&
      !l.includes('_base.css') &&
      !l.includes('base.css') &&
      !l.includes('node_modules') &&
      !l.includes('.next'),
  );

if (lines.length) {
  console.error(`Undefined --ds-* var references found:\n${lines.join('\n')}`);
  process.exit(1);
}
console.log('No undefined --ds-* var references found.');
