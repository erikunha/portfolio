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
const CONSUMER_FILE = /\.(?:css|tsx?|mdx)$/;
const CONSUMER_SKIPPED = /\.(?:test|e2e|spec)\.tsx?$/;
const THEME_AT_RULE = 'theme';
const CUSTOM_PROPERTY = '--';
const COLOR_UTILITIES = [
  'bg',
  'text',
  'border',
  'border-x',
  'border-y',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'ring',
  'ring-offset',
  'fill',
  'stroke',
  'outline',
  'decoration',
  'accent',
  'caret',
  'shadow',
  'inset-shadow',
  'drop-shadow',
  'from',
  'via',
  'to',
  'divide',
  'placeholder',
  'selection',
];
const SPACING_UTILITIES = [
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'ms',
  'me',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'w',
  'h',
  'size',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'inset',
  'inset-x',
  'inset-y',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'translate-x',
  'translate-y',
  'basis',
  'indent',
  'scroll-m',
  'scroll-p',
];
const NAMESPACE_UTILITIES: Record<string, string[]> = {
  color: COLOR_UTILITIES,
  text: ['text'],
  leading: ['leading'],
  tracking: ['tracking'],
  spacing: SPACING_UTILITIES,
  radius: ['rounded', 'rounded-t', 'rounded-r', 'rounded-b', 'rounded-l', 'rounded-s', 'rounded-e'],
  shadow: ['shadow'],
  font: ['font'],
};
const BREAKPOINT_NAMESPACE = 'breakpoint';

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function themeTokenNames(themeCss: string): string[] {
  const names: string[] = [];
  postcss.parse(themeCss).walkAtRules(THEME_AT_RULE, (rule) => {
    rule.each((node) => {
      if (node.type === 'decl' && node.prop.startsWith(CUSTOM_PROPERTY)) names.push(node.prop);
    });
  });
  return names;
}

function utilityPattern(token: string): RegExp | undefined {
  const body = token.slice(CUSTOM_PROPERTY.length);
  const dash = body.indexOf('-');
  if (dash < 0) return undefined;
  const namespace = body.slice(0, dash);
  const name = escapeRegExp(body.slice(dash + 1));
  if (namespace === BREAKPOINT_NAMESPACE) return new RegExp(`(?<![\\w-])(?:max-|min-)?${name}:`);
  const prefixes = NAMESPACE_UTILITIES[namespace];
  if (!prefixes) return undefined;
  return new RegExp(`(?<![\\w-])-?(?:${prefixes.map(escapeRegExp).join('|')})-${name}(?![\\w-])`);
}

export function findUnusedThemeTokens(themeCss: string, sources: string[]): string[] {
  const haystacks = [themeCss, ...sources].map(stripComments);
  return themeTokenNames(themeCss).filter((token) => {
    const reference = new RegExp(`${escapeRegExp(token)}(?![\\w-])(?!\\s*:)`);
    if (haystacks.some((text) => reference.test(text))) return false;
    const utility = utilityPattern(token);
    return !(utility && haystacks.some((text) => utility.test(text)));
  });
}

export function findConsumerFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (CONSUMER_FILE.test(entry.name) && !CONSUMER_SKIPPED.test(entry.name)) {
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
  const unused = findUnusedThemeTokens(
    readFileSync(join(root, `app/css/${THEME_SHEET}`), 'utf8'),
    findConsumerFiles(root).map((file) => readFileSync(join(root, file), 'utf8')),
  );
  if (unused.length > 0) {
    failed = true;
    console.error(`[css-tokens] ${unused.length} @theme token(s) with no consumer:`);
    for (const token of unused) console.error(`  ✗ app/css/theme.css: ${token}`);
    console.error('Delete the token, or reference it from CSS, TSX, TS or MDX.');
  }
  if (stale.length > 0) {
    failed = true;
    console.error(`[css-tokens] ${stale.length} stale allowlist entr(ies) in ${ALLOWLIST_PATH}:`);
    for (const e of stale)
      console.error(`  ✗ ${e.file}: ${e.literal} (x${e.count}) no longer matches`);
    console.error('Delete the entry; the exception it recorded is gone.');
  }
  if (failed) process.exit(1);
  console.log(
    '[css-tokens] no raw color literals, z-index values or focus rings outside their tokens, and no unused @theme tokens.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
