#!/usr/bin/env node
// scripts/check-client-naming.mjs
//
// CI gate for audit Standard 2: every file with `'use client'` MUST be
// either named `*.client.{tsx,ts}` OR live inside a directory named
// `client/`. Both patterns make the RSC boundary visible from the file
// tree without opening every file — the audit's "RSC drift visible in
// code review" property.
//
// Runs in STRICT mode (default): exits 1 on any violation, blocking CI.
// Set CHECK_CLIENT_NAMING_LENIENT=1 to downgrade to warn-only (returns 0
// after listing violations) — for temporary use only when adding a new
// 'use client' file before renaming. See
// docs/audit/2026-05-19-principal-audit.md Theme 4 + Standard 2.
//
// Usage: pnpm check:client-naming
// CI:    runs as part of `pnpm ci` post-lint, post-typecheck.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Scan these directories; everything else (node_modules, .next, etc.) is
// excluded by virtue of not being listed.
const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'out', '.vercel']);

/** @returns {string[]} */
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

/**
 * The first non-empty, non-comment line of a .ts(x) file must be
 * `'use client'` or `"use client"` (with optional semicolon). We detect by
 * reading just the first ~512 bytes and looking for the directive at the
 * top of the file (allowing leading shebang / comments / blank lines).
 *
 * @param {string} file
 * @returns {boolean}
 */
function isUseClient(file) {
  let head;
  try {
    head = readFileSync(file, 'utf-8').slice(0, 512);
  } catch {
    return false;
  }
  // Strip line comments + block comments + blank lines from the head.
  const stripped = head
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
  return /^["']use client["'];?/.test(stripped);
}

/**
 * @param {string} file (absolute or repo-relative)
 * @returns {boolean}
 */
function isCompliant(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // Either: filename ends in `.client.tsx` or `.client.ts`.
  if (/\.client\.(tsx|ts)$/.test(rel)) return true;
  // Or: path contains `/client/` directory segment.
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

// Strict-by-default: exit 1 on any violation so CI red-lights the PR.
// Set CHECK_CLIENT_NAMING_LENIENT=1 to downgrade to warn-only — temporary
// escape hatch for incremental migrations only.
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
