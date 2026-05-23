#!/usr/bin/env node
// Renames legacy CSS custom property names to design-system token names.
// Run once; idempotent on subsequent runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Order matters: longer names first to prevent partial matches.
// e.g. --signal-dim-2 before --signal-dim before --signal
const RENAME_MAP = [
  ['--signal-dim-2', '--ds-color-signal-quiet'],
  ['--signal-faint', '--ds-color-signal-faint'],
  ['--signal-dim', '--ds-color-signal-subtle'],
  ['--signal', '--ds-color-signal'],
  ['--muted-dim', '--ds-color-text-faint'],
  ['--muted', '--ds-color-text-muted'],
  ['--fg', '--ds-color-text-body'],
  ['--highlight-bg', '--ds-color-highlight-bg'],
  ['--highlight-fg', '--ds-color-highlight-fg'],
  ['--border', '--ds-color-border-default'],
  ['--red', '--ds-chrome-close'],
  ['--yellow', '--ds-chrome-minimize'],
  ['--green-light', '--ds-chrome-maximize'],
  ['--shell-bg', '--ds-color-surface-shell'],
  ['--accent-warm', '--ds-color-accent-warm'],
  ['--accent-cool', '--ds-color-accent-cool'],
  ['--error-soft', '--ds-color-feedback-error'],
  ['--bg', '--ds-color-surface-base'],
  ['--pad', '--ds-space-pad'],
  ['--maxw', '--ds-layout-maxw'],
  ['--vrhythm', '--ds-space-rhythm'],
  ['--font-mono-stack', '--ds-font-family-mono'],
  ['--font-display-stack', '--ds-font-family-display'],
  ['--fs-2xs', '--ds-font-size-2xs'],
  ['--fs-xs', '--ds-font-size-xs'],
  ['--fs-sm', '--ds-font-size-sm'],
  ['--fs-base', '--ds-font-size-body'],
  ['--fs-md', '--ds-font-size-md'],
  ['--fs-lg', '--ds-font-size-heading-sm'],
  ['--fs-xl', '--ds-font-size-heading-md'],
  ['--fs-2xl', '--ds-font-size-heading-lg'],
  ['--fs-3xl', '--ds-font-size-heading-xl'],
];

// Build a single regex that matches any occurrence of a legacy token name —
// in CSS declarations, var() calls, string literals, etc. — followed by a
// non-identifier character or end-of-string (prevents partial matches such as
// matching --signal inside --signal-dim).
const escapeRegex = (s) => s.replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&');
const legacyNames = RENAME_MAP.map(([from]) => escapeRegex(from));
const pattern = new RegExp(`(${legacyNames.join('|')})(?=[^-a-zA-Z0-9]|$)`, 'g');

// O(1) lookup map built once; avoids O(n) Array.find per regex match.
const RENAME_MAP_LOOKUP = new Map(RENAME_MAP);

function applyRenames(content) {
  return content.replace(pattern, (match) => RENAME_MAP_LOOKUP.get(match) ?? match);
}

// Process all .module.css files and .tsx files with inline style var() refs
const cssFiles = await Array.fromAsync(
  glob('**/*.module.css', { cwd: ROOT, ignore: ['node_modules/**', '.next/**', '.claude/**'] }),
);
const tsxFiles = [
  'app/not-found.tsx',
  'components/sections/GitLogSection.tsx',
  'components/sections/HottestTakesSection.tsx',
  'components/sections/ResponsibilitiesSection.tsx',
];
const allFiles = [...cssFiles, ...tsxFiles];

let changed = 0;
for (const rel of allFiles) {
  const abs = path.join(ROOT, rel);
  const original = readFileSync(abs, 'utf8');
  const updated = applyRenames(original);
  if (updated !== original) {
    writeFileSync(abs, updated, 'utf8');
    console.log(`  updated: ${rel}`);
    changed++;
  }
}

console.log(`\nMigration complete: ${changed} file(s) updated.`);
