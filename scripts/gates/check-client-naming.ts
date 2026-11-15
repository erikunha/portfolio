import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../lib/walk.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SCAN_DIRS = ['app', 'components', 'lib', 'design-system'];
const NEXT_CLIENT_CONVENTION_FILES = /^app\/((.+\/)?error|global-error)\.tsx$/;
const SKIP_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'out',
  '.vercel',
]);
const TS_FILE = /\.(ts|tsx)$/;
const HEAD_BYTES = 512;
const USE_CLIENT_DIRECTIVE = /^["']use client["'];?/;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /\/\/.*$/;
const CLIENT_SUFFIX = /\.client\.(tsx|ts)$/;
const CLIENT_DIR = /(^|\/)client\//;
const FAILURE_EXIT_CODE = 1;

function isUseClient(file: string): boolean {
  let head: string;
  try {
    head = readFileSync(file, 'utf-8').slice(0, HEAD_BYTES);
  } catch {
    return false;
  }
  const stripped = head
    .replace(BLOCK_COMMENT, '')
    .split('\n')
    .map((line) => line.replace(LINE_COMMENT, '').trim())
    .filter(Boolean)
    .join('\n');
  return USE_CLIENT_DIRECTIVE.test(stripped);
}

function isCompliant(rel: string): boolean {
  return CLIENT_SUFFIX.test(rel) || CLIENT_DIR.test(rel) || NEXT_CLIENT_CONVENTION_FILES.test(rel);
}

function isDirectory(abs: string): boolean {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

const violations: string[] = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!isDirectory(abs)) continue;
  for (const file of listFiles(abs, { include: TS_FILE, skipDirs: SKIP_NAMES })) {
    const rel = path.relative(ROOT, path.join(abs, file)).replace(/\\/g, '/');
    if (!isUseClient(path.join(ROOT, rel))) continue;
    if (isCompliant(rel)) continue;
    violations.push(rel);
  }
}

const LENIENT = process.env.CHECK_CLIENT_NAMING_LENIENT === '1';
if (violations.length === 0) {
  console.log(
    '✓ client-naming: 0 violations, every "use client" file is in /client/ or *.client.*',
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
process.exit(FAILURE_EXIT_CODE);
