#!/usr/bin/env node
// scripts/check-client-naming.mjs
//
// CI gate for audit Standard 2: every file with `'use client'` MUST be
// either named `*.client.{tsx,ts}` OR live inside a directory named
// `client/`. Both patterns make the RSC boundary visible from the file
// tree without opening every file — the audit's "RSC drift visible in
// code review" property.
//
// Runs in WARN-ONLY mode for now (exits 0 even with violations). The flip
// to error mode happens in PR 6b once the bulk rename is complete. See
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

// Warn-only mode: surface violations but exit 0 so the gate ships before
// the bulk rename lands. PR 6b flips this to `process.exit(1)`.
const STRICT = process.env.CHECK_CLIENT_NAMING_STRICT === '1';
if (violations.length === 0) {
  console.log('✓ client-naming: 0 violations — every "use client" file is in /client/ or *.client.*');
  process.exit(0);
}

console.warn(
  `⚠ client-naming: ${violations.length} violation${violations.length === 1 ? '' : 's'} (warn-only):`,
);
for (const v of violations) {
  console.warn(`  ${v}`);
}
console.warn(
  '  Convention (audit Standard 2): "use client" files must end in *.client.{tsx,ts} OR live in a /client/ directory.',
);
console.warn('  Flip to strict mode by setting CHECK_CLIENT_NAMING_STRICT=1.');

if (STRICT) {
  process.exit(1);
}
process.exit(0);
