#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const pkgPath = process.argv[2] ?? 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const BANNED = /^(latest|\*|x|next|canary|beta|alpha)$/i;
const ALLOWED = /^(\^|~)?\d+\.\d+\.\d+/;

const violations = [];
for (const block of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, spec] of Object.entries(pkg[block] ?? {})) {
    if (typeof spec !== 'string') continue;
    if (spec.startsWith('workspace:') || spec.startsWith('file:') || spec.startsWith('link:')) {
      continue;
    }
    if (BANNED.test(spec.trim()) || !ALLOWED.test(spec.trim())) {
      violations.push(`  ${block}.${name}: "${spec}"`);
    }
  }
}

if (violations.length === 0) {
  console.log('✓ dep-pinning: 0 violations — every dependency is major-locked');
  process.exit(0);
}
console.error(`✗ dep-pinning: ${violations.length} unbounded dependency spec(s):`);
for (const v of violations) console.error(v);
console.error('  Convention: pin every dependency to ^x.y.z or ~x.y.z. Never "latest" or "*".');
process.exit(1);
