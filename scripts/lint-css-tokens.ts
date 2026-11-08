#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\(\s*[\d.][^)]*\)/gi;
const TOKEN_FILE = /-tokens\.ts$/;
const TEST_FILE = /\.test\.tsx?$/;
const TOKEN_ROOTS = ['app', 'components', 'content', 'design-system', 'lib'];
const SKIPPED_DIRS = new Set(['node_modules', '.next']);
const ALLOWLIST_PATH = 'scripts/lint-css-tokens.allowlist.json';

export interface HexHit {
  line: number;
  hex: string;
}

export interface ColorHit {
  line: number;
  literal: string;
}

export interface RawColorHit extends ColorHit {
  file: string;
}

export interface AllowEntry {
  file: string;
  literal: string;
  count: number;
  reason: string;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

function scan(source: string, pattern: RegExp): ColorHit[] {
  const out: ColorHit[] = [];
  stripComments(source)
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(pattern)) {
        out.push({ line: i + 1, literal: match[0] });
      }
    });
  return out;
}

export function findRawHex(css: string): HexHit[] {
  return scan(css, HEX).map(({ line, literal }) => ({ line, hex: literal }));
}

export function findRawColorFunctions(css: string): ColorHit[] {
  return scan(css, COLOR_FUNCTION);
}

export function findRawColors(source: string): ColorHit[] {
  return [...scan(source, HEX), ...scan(source, COLOR_FUNCTION)].sort((a, b) => a.line - b.line);
}

export function applyAllowlist(
  hits: RawColorHit[],
  entries: AllowEntry[],
): { violations: RawColorHit[]; stale: AllowEntry[] } {
  const remaining = new Map(entries.map((entry) => [`${entry.file}\u0000${entry.literal}`, entry]));
  const used = new Map<string, number>();
  const violations: RawColorHit[] = [];
  for (const hit of hits) {
    const key = `${hit.file}\u0000${hit.literal}`;
    const entry = remaining.get(key);
    const seen = used.get(key) ?? 0;
    if (entry && seen < entry.count) {
      used.set(key, seen + 1);
    } else {
      violations.push(hit);
    }
  }
  const stale = entries.filter(
    (entry) => (used.get(`${entry.file}\u0000${entry.literal}`) ?? 0) < entry.count,
  );
  return { violations, stale };
}

export function findTokenFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (TOKEN_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
        out.push(relative(root, full));
      }
    }
  };
  for (const top of TOKEN_ROOTS) {
    const dir = join(root, top);
    if (existsSync(dir)) walk(dir);
  }
  return out.sort();
}

export function assertScannable(
  dirExists: boolean,
  files: string[],
): { ok: true } | { ok: false; reason: string } {
  if (!dirExists) return { ok: false, reason: 'app/css/ does not exist' };
  if (files.length === 0) {
    return { ok: false, reason: 'app/css/ has no .css files (besides theme.css) to scan' };
  }
  return { ok: true };
}

function loadAllowlist(root: string): AllowEntry[] {
  return JSON.parse(readFileSync(join(root, ALLOWLIST_PATH), 'utf8')) as AllowEntry[];
}

function main(): void {
  const root = process.cwd();
  const cssDir = join(root, 'app/css');
  const dirExists = existsSync(cssDir);
  const files = dirExists
    ? readdirSync(cssDir).filter((f) => f.endsWith('.css') && f !== 'theme.css')
    : [];

  const scannable = assertScannable(dirExists, files);
  if (!scannable.ok) {
    console.error(
      `[css-tokens] GATE ERROR: ${scannable.reason}; the token-boundary gate cannot run. Refusing to pass vacuously.`,
    );
    process.exit(2);
  }

  const targets = [...files.map((f) => `app/css/${f}`), ...findTokenFiles(root)];
  const hits: RawColorHit[] = targets.flatMap((file) =>
    findRawColors(readFileSync(join(root, file), 'utf8')).map((hit) => ({ ...hit, file })),
  );
  const { violations, stale } = applyAllowlist(hits, loadAllowlist(root));

  if (violations.length > 0) {
    console.error(
      `[css-tokens] ${violations.length} raw color literal(s) outside theme.css and ${ALLOWLIST_PATH}:`,
    );
    for (const v of violations) console.error(`  ✗ ${v.file}:${v.line}: ${v.literal}`);
    console.error('Brand colors live in app/css/theme.css; reference them via var(--color-...).');
  }
  if (stale.length > 0) {
    console.error(`[css-tokens] ${stale.length} stale allowlist entr(ies) in ${ALLOWLIST_PATH}:`);
    for (const e of stale)
      console.error(`  ✗ ${e.file}: ${e.literal} (x${e.count}) no longer matches`);
    console.error('Delete the entry; the exception it recorded is gone.');
  }
  if (violations.length > 0 || stale.length > 0) process.exit(1);
  console.log('[css-tokens] no raw color literals outside theme.css and the named allowlist.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
