#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pkgPath = process.argv[2] ?? 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const BANNED = /^(latest|\*|x|next|canary|beta|alpha)$/i;
const RANGED = /^(\^|~)\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const PRERELEASE_EXACT = /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/;
const TILDE = '~';

const TILDE_REQUIRED = new Set([
  'next',
  '@next/mdx',
  'react',
  'react-dom',
  'zod',
  'typescript',
  '@biomejs/biome',
  '@playwright/test',
  'playwright',
  'shiki',
  'rehype-pretty-code',
]);

const violations = [];
for (const block of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, raw] of Object.entries(pkg[block] ?? {})) {
    if (typeof raw !== 'string') continue;
    const spec = raw.trim();
    if (spec.startsWith('workspace:') || spec.startsWith('file:') || spec.startsWith('link:')) {
      continue;
    }
    if (PRERELEASE_EXACT.test(spec)) continue;
    if (BANNED.test(spec)) {
      violations.push(`  ${block}.${name}: "${raw}" is unbounded`);
    } else if (!RANGED.test(spec)) {
      violations.push(`  ${block}.${name}: "${raw}" is not a ^ or ~ range`);
    } else if (TILDE_REQUIRED.has(name) && !spec.startsWith(TILDE)) {
      violations.push(
        `  ${block}.${name}: "${raw}" must be a ~ range (its minors break this repo)`,
      );
    }
  }
}

if (violations.length === 0) {
  console.log('✓ dep-pinning: 0 violations');
  process.exit(0);
}
console.error(`✗ dep-pinning: ${violations.length} violation(s):`);
for (const v of violations) console.error(v);
console.error(
  '  Convention: ^x.y.z by default, ~x.y.z for the packages in TILDE_REQUIRED, an exact version only for a prerelease build.',
);
process.exit(1);
