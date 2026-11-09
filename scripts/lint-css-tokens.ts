#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const COLOR_FUNCTION =
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.][^)]*\)|\bcolor\(\s*[a-z][\w-]*\s+[\d.][^)]*\)/gi;
const Z_INDEX_DECLARATION = /z-index:\s*([^;}\n]+)/g;
const Z_TOKEN_DECLARATION = /--z-[\w-]+\s*:\s*[^;}\n]+/g;
const Z_TOKEN_REFERENCE = /^var\(--z-[\w-]+\)$/;
const Z_UTILITY = /(?<![\w-])-?z-(?:\[(?!var\(--z-)[^\]]*\]|\d+|auto)(?![\w-])/g;
const Z_INLINE_STYLE = /\bzIndex:[ \t]*(?![ \t])(?!['"`]var\(--z-[\w-]+\)['"`])[^,}\n]+/g;
const FOCUS_SELECTOR = /:focus(?:-visible|-within)?\b/;
const FOCUS_VISIBLE_SELECTOR = /:focus-visible\b/;
const FOCUS_RING_VALUE = 'var(--focus-ring)';
const FOCUS_OFFSET_VALUES = new Set(['var(--focus-ring-offset)', 'var(--focus-ring-offset-inset)']);
const NO_OUTLINE = 'none';
const FORCED_COLORS_SHEET = 'forced-colors.css';
const THEME_SHEET = 'theme.css';
const TSX_FILE = /\.tsx$/;
const TSX_SKIPPED = /\.(?:test|e2e)\.tsx?$/;
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

export function findRawZIndex(source: string, language: 'css' | 'tsx'): ColorHit[] {
  const code = stripComments(source);
  const hits: ColorHit[] = [];
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (language === 'css') {
      for (const match of line.matchAll(Z_INDEX_DECLARATION)) {
        const value = (match[1] ?? '').trim();
        if (!Z_TOKEN_REFERENCE.test(value) && value !== 'auto') {
          hits.push({ line: i + 1, literal: match[0].trim() });
        }
      }
      for (const match of line.matchAll(Z_TOKEN_DECLARATION)) {
        hits.push({ line: i + 1, literal: match[0].trim() });
      }
    } else {
      for (const match of line.matchAll(Z_UTILITY)) hits.push({ line: i + 1, literal: match[0] });
      for (const match of line.matchAll(Z_INLINE_STYLE)) {
        hits.push({ line: i + 1, literal: match[0].trim() });
      }
    }
  });
  return hits.sort((a, b) => a.line - b.line);
}

export function findRawFocusRing(css: string): ColorHit[] {
  const hits: ColorHit[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (!FOCUS_SELECTOR.test(rule.selector)) return;
    const visibleOnly = FOCUS_VISIBLE_SELECTOR.test(rule.selector);
    rule.each((node) => {
      if (node.type !== 'decl' || !node.prop.startsWith('outline')) return;
      const value = node.value.trim();
      const allowed =
        node.prop === 'outline'
          ? value === NO_OUTLINE || (visibleOnly && value === FOCUS_RING_VALUE)
          : node.prop === 'outline-offset' && visibleOnly && FOCUS_OFFSET_VALUES.has(value);
      if (!allowed) {
        hits.push({ line: node.source?.start?.line ?? 0, literal: `${node.prop}: ${value}` });
      }
    });
  });
  return hits.sort((a, b) => a.line - b.line);
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

export function findTsxFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (TSX_FILE.test(entry.name) && !TSX_SKIPPED.test(entry.name)) {
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

export interface RepoScan {
  colors: RawColorHit[];
  zIndex: RawColorHit[];
  focus: RawColorHit[];
}

export function scanRepo(root: string, cssFiles: string[]): RepoScan {
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const tag = (file: string, hits: ColorHit[]): RawColorHit[] =>
    hits.map((hit) => ({ ...hit, file }));
  const cssTargets = cssFiles.map((f) => `app/css/${f}`);
  const colorTargets = [...cssTargets, ...findTokenFiles(root)];
  return {
    colors: colorTargets.flatMap((file) => tag(file, findRawColors(read(file)))),
    zIndex: [
      ...cssTargets.flatMap((file) => tag(file, findRawZIndex(read(file), 'css'))),
      ...findTsxFiles(root).flatMap((file) => tag(file, findRawZIndex(read(file), 'tsx'))),
    ],
    focus: cssTargets
      .filter((file) => !file.endsWith(FORCED_COLORS_SHEET))
      .flatMap((file) => tag(file, findRawFocusRing(read(file)))),
  };
}

export function listScannedCss(root: string): string[] {
  const cssDir = join(root, 'app/css');
  return existsSync(cssDir)
    ? readdirSync(cssDir).filter((f) => f.endsWith('.css') && f !== THEME_SHEET)
    : [];
}

function report(label: string, hint: string, hits: RawColorHit[]): boolean {
  if (hits.length === 0) return false;
  console.error(`[css-tokens] ${hits.length} ${label}:`);
  for (const v of hits) console.error(`  ✗ ${v.file}:${v.line}: ${v.literal}`);
  console.error(hint);
  return true;
}

function main(): void {
  const root = process.cwd();
  const dirExists = existsSync(join(root, 'app/css'));
  const files = listScannedCss(root);

  const scannable = assertScannable(dirExists, files);
  if (!scannable.ok) {
    console.error(
      `[css-tokens] GATE ERROR: ${scannable.reason}; the token-boundary gate cannot run. Refusing to pass vacuously.`,
    );
    process.exit(2);
  }

  const scan = scanRepo(root, files);
  const { violations, stale } = applyAllowlist(scan.colors, loadAllowlist(root));

  let failed = report(
    `raw color literal(s) outside theme.css and ${ALLOWLIST_PATH}`,
    'Brand colors live in app/css/theme.css; reference them via var(--color-...).',
    violations,
  );
  failed =
    report(
      'z-index value(s) outside the --z-* scale',
      'The stacking scale lives in app/css/theme.css (--z-*); reference it via var(--z-...) or z-(--z-...).',
      scan.zIndex,
    ) || failed;
  failed =
    report(
      'focus ring declaration(s) that bypass the shared ring',
      'A focus rule uses outline: var(--focus-ring) with outline-offset: var(--focus-ring-offset) (or -inset), on :focus-visible only.',
      scan.focus,
    ) || failed;
  if (stale.length > 0) {
    failed = true;
    console.error(`[css-tokens] ${stale.length} stale allowlist entr(ies) in ${ALLOWLIST_PATH}:`);
    for (const e of stale)
      console.error(`  ✗ ${e.file}: ${e.literal} (x${e.count}) no longer matches`);
    console.error('Delete the entry; the exception it recorded is gone.');
  }
  if (failed) process.exit(1);
  console.log(
    '[css-tokens] no raw color literals, z-index values or focus rings outside their tokens.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
