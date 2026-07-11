#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'out', '.vercel']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_NAMES.has(entry)) continue;
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isUseClient(file) {
  let head;
  try {
    head = readFileSync(file, 'utf-8').slice(0, 512);
  } catch {
    return false;
  }
  const stripped = head
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
  return /^["']use client["'];?/.test(stripped);
}

function isCompliant(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (/\.client\.(tsx|ts)$/.test(rel)) return true;
  if (/(^|\/)client\//.test(rel)) return true;
  return false;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  try {
    if (!statSync(abs).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    if (!isUseClient(file)) continue;
    if (isCompliant(file)) continue;
    violations.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}

const LENIENT = process.env.CHECK_CLIENT_NAMING_LENIENT === '1';
if (violations.length === 0) {
  console.log(
    '✓ client-naming: 0 violations — every "use client" file is in /client/ or *.client.*',
  );
  process.exit(0);
}

const prefix = LENIENT ? '⚠' : '✗';
const tag = LENIENT ? '(lenient mode)' : '(strict)';
console.error(
  `${prefix} client-naming: ${violations.length} violation${
    violations.length === 1 ? '' : 's'
  } ${tag}:`,
);
for (const v of violations) {
  console.error(`  ${v}`);
}
console.error(
  '  Convention (audit Standard 2): "use client" files must end in *.client.{tsx,ts} OR live in a /client/ directory.',
);
if (LENIENT) {
  console.error('  Downgraded to warn-only via CHECK_CLIENT_NAMING_LENIENT=1.');
  process.exit(0);
}
process.exit(1);
