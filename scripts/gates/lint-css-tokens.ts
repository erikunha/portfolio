#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { isMain } from '../lib/is-main';
import { listFiles } from '../lib/walk';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const COLOR_FUNCTION =
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.][^)]*\)|\bcolor\(\s*[a-z][\w-]*\s+[\d.][^)]*\)/gi;
const TAILWIND_BLACK_WHITE =
  /(?<![\w-])(?:[^\s'"`:]+:)*(?:bg|text|border)-(?:black|white)(?:\/\d+)?(?![\w-])/g;
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
const CSS_DIRECTORY = 'app/css';
const TSX_FILE = /\.tsx$/;
const TSX_SKIPPED = /\.(?:test|e2e)\.tsx?$/;
const TOKEN_FILE = /-tokens\.ts$/;
const TEST_FILE = /\.test\.tsx?$/;
const TOKEN_ROOTS = ['app', 'components', 'content', 'design-system', 'lib'];
const SKIPPED_DIRS = new Set(['node_modules', '.next']);
const ALLOWLIST_PATH = 'scripts/gates/lint-css-tokens.allowlist.json';
const CONSUMER_FILE = /\.(?:css|tsx?|mdx)$/;
const CONSUMER_SKIPPED = /\.(?:test|e2e|spec)\.tsx?$/;
const THEME_AT_RULE = 'theme';
const CUSTOM_PROPERTY = '--';
const NAMESPACE_WILDCARD = '-*';
const NAMESPACE_RESET_VALUE = 'initial';
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
const COLOR_VARIABLE_PREFIX = '--color-';
const ROLE_TOKENS = [
  'surface',
  'surface-raised',
  'border',
  'border-strong',
  'accent',
  'on-accent',
  'text',
  'text-muted',
  'focus',
  'warning',
  'danger',
  'scrim',
];
const COLOR_ALIAS = /^var\((--color-[\w-]+)\)$/;
const ORDINAL_HUES: Record<string, string> = {
  primary: 'signal',
  secondary: 'carbon',
  tertiary: 'sage',
  quinary: 'gold',
  senary: 'coral',
};
const ORDINAL_STEP = '(?:\\d+|subtle|border|faint|quiet)';
const GLOW_STOP = 'glow-(\\d+)';
const REMOVED_GREEN_TOKEN = `${COLOR_VARIABLE_PREFIX}green`;
const GREEN_ROLE = `${COLOR_VARIABLE_PREFIX}accent`;
const SIGNAL_HUE = 'signal';
const BREAKPOINT_NAMESPACE = 'breakpoint';
const TOKEN_EQUAL_NAMESPACES = ['tracking', 'radius', 'shadow', 'leading', 'text', 'spacing'];
const SUBPROPERTY_SEPARATOR = '--';
const ARBITRARY_CLASS = /(?<![\w-])([a-z][a-z-]*)-\[([^\]\s'"`]+)\]/g;
const WHITESPACE = /\s+/g;

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

export interface TokenEqualHit extends ColorHit {
  utility: string;
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

export function findRawTsxColors(source: string): ColorHit[] {
  return [...findRawColors(source), ...scan(source, TAILWIND_BLACK_WHITE)].sort(
    (a, b) => a.line - b.line,
  );
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

function listUnderTokenRoots(root: string, include: (name: string) => boolean): string[] {
  return TOKEN_ROOTS.filter((top) => existsSync(join(root, top)))
    .flatMap((top) =>
      listFiles(join(root, top), { include, skipDirs: SKIPPED_DIRS }).map((rel) => join(top, rel)),
    )
    .sort();
}

export function findTokenFiles(root: string): string[] {
  return listUnderTokenRoots(root, (name) => TOKEN_FILE.test(name) && !TEST_FILE.test(name));
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
  return listUnderTokenRoots(root, (name) => TSX_FILE.test(name) && !TSX_SKIPPED.test(name));
}

export interface RepoScan {
  colors: RawColorHit[];
  zIndex: RawColorHit[];
  focus: RawColorHit[];
  tokenEqual: RawColorHit[];
  primitives: RawColorHit[];
  ordinals: RawColorHit[];
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

function normalizeValue(value: string): string {
  return value.replace(WHITESPACE, '').toLowerCase();
}

function tokenUtilities(themeCss: string): Map<string, string> {
  const byPrefixAndValue = new Map<string, string>();
  postcss.parse(themeCss).walkAtRules(THEME_AT_RULE, (rule) => {
    rule.each((node) => {
      if (node.type !== 'decl' || !node.prop.startsWith(CUSTOM_PROPERTY)) return;
      const body = node.prop.slice(CUSTOM_PROPERTY.length);
      const dash = body.indexOf('-');
      if (dash < 0 || body.includes(SUBPROPERTY_SEPARATOR)) return;
      const namespace = body.slice(0, dash);
      if (!TOKEN_EQUAL_NAMESPACES.includes(namespace)) return;
      const name = body.slice(dash + 1);
      for (const prefix of NAMESPACE_UTILITIES[namespace] ?? []) {
        const key = `${prefix}\u0000${normalizeValue(node.value)}`;
        if (!byPrefixAndValue.has(key)) byPrefixAndValue.set(key, `${prefix}-${name}`);
      }
    });
  });
  return byPrefixAndValue;
}

export function findTokenEqualArbitraryValues(themeCss: string, source: string): TokenEqualHit[] {
  const utilities = tokenUtilities(themeCss);
  const hits: TokenEqualHit[] = [];
  stripComments(source)
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(ARBITRARY_CLASS)) {
        const value = normalizeValue((match[2] ?? '').replace(/_/g, ' '));
        const utility = utilities.get(`${match[1]}\u0000${value}`);
        if (utility) hits.push({ line: i + 1, literal: match[0], utility });
      }
    });
  return hits;
}

export function rolePrimitives(themeCss: string): Map<string, string[]> {
  const byPrimitive = new Map<string, string[]>();
  postcss.parse(themeCss).walkDecls((decl) => {
    const role = ROLE_TOKENS.find((name) => decl.prop === `${COLOR_VARIABLE_PREFIX}${name}`);
    const target = COLOR_ALIAS.exec(decl.value.trim())?.[1];
    if (!role || !target) return;
    const primitive = target.slice(COLOR_VARIABLE_PREFIX.length);
    byPrimitive.set(primitive, [...(byPrimitive.get(primitive) ?? []), role]);
  });
  return byPrimitive;
}

export function findPrimitiveColorUses(themeCss: string, source: string): ColorHit[] {
  const roles = rolePrimitives(themeCss);
  if (roles.size === 0) return [];
  const names = [...roles.keys()].map(escapeRegExp).join('|');
  const utilities = COLOR_UTILITIES.map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `${escapeRegExp(COLOR_VARIABLE_PREFIX)}(${names})(?![\\w-])|(?<![\\w-])(?:${utilities})-(${names})(?![\\w-])`,
    'g',
  );
  const hits: ColorHit[] = [];
  stripComments(source)
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(pattern)) {
        const primitive = match[1] ?? match[2] ?? '';
        const use = (roles.get(primitive) ?? [])
          .map((role) => `${COLOR_VARIABLE_PREFIX}${role}`)
          .join(' or ');
        hits.push({ line: i + 1, literal: `${match[0]} (use ${use})` });
      }
    });
  return hits;
}

function ordinalPrefix(): string {
  const utilities = COLOR_UTILITIES.map(escapeRegExp).join('|');
  return `(?<![\\w-])((?:${utilities})-|${escapeRegExp(COLOR_VARIABLE_PREFIX)})`;
}

export function findOrdinalPaletteNames(source: string): ColorHit[] {
  const families = Object.keys(ORDINAL_HUES).join('|');
  const prefix = ordinalPrefix();
  const ramp = new RegExp(`${prefix}(${families})-(${ORDINAL_STEP})(?![\\w-])`, 'g');
  const glow = new RegExp(`${prefix}${GLOW_STOP}(?![\\w-])`, 'g');
  const green = new RegExp(`(?<![\\w-])${escapeRegExp(REMOVED_GREEN_TOKEN)}(?![\\w-])`, 'g');
  const hits: ColorHit[] = [];
  stripComments(source)
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(ramp)) {
        const [whole, lead = '', family = '', step = ''] = match;
        hits.push({
          line: i + 1,
          literal: `${whole} (use ${lead}${ORDINAL_HUES[family]}-${step})`,
        });
      }
      for (const match of line.matchAll(glow)) {
        const [whole, lead = '', alpha = ''] = match;
        hits.push({ line: i + 1, literal: `${whole} (use ${lead}${SIGNAL_HUE}-glow-${alpha})` });
      }
      for (const match of line.matchAll(green)) {
        hits.push({ line: i + 1, literal: `${match[0]} (use ${GREEN_ROLE})` });
      }
    });
  return hits.sort((a, b) => a.line - b.line);
}

function namespaceResets(themeCss: string): Set<string> {
  const resets = new Set<string>();
  postcss.parse(themeCss).walkAtRules(THEME_AT_RULE, (rule) => {
    rule.each((node) => {
      if (
        node.type === 'decl' &&
        node.prop.startsWith(CUSTOM_PROPERTY) &&
        node.prop.endsWith(NAMESPACE_WILDCARD) &&
        node.value.trim() === NAMESPACE_RESET_VALUE
      ) {
        resets.add(node.prop);
      }
    });
  });
  return resets;
}

export function findUnusedThemeTokens(themeCss: string, sources: string[]): string[] {
  const haystacks = [themeCss, ...sources].map(stripComments);
  const resets = namespaceResets(themeCss);
  return themeTokenNames(themeCss).filter((token) => {
    if (resets.has(token)) return false;
    const reference = new RegExp(`${escapeRegExp(token)}(?![\\w-])(?!\\s*:)`);
    if (haystacks.some((text) => reference.test(text))) return false;
    const utility = utilityPattern(token);
    return !(utility && haystacks.some((text) => utility.test(text)));
  });
}

export function findConsumerFiles(root: string): string[] {
  return listUnderTokenRoots(
    root,
    (name) => CONSUMER_FILE.test(name) && !CONSUMER_SKIPPED.test(name),
  );
}

export function scanRepo(root: string, cssFiles: string[]): RepoScan {
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const tag = (file: string, hits: ColorHit[]): RawColorHit[] =>
    hits.map((hit) => ({ ...hit, file }));
  const cssTargets = cssFiles.map((f) => `app/css/${f}`);
  const colorTargets = [...cssTargets, ...findTokenFiles(root)];
  const themePath = `app/css/${THEME_SHEET}`;
  const themeCss = existsSync(join(root, themePath)) ? read(themePath) : '';
  return {
    colors: [
      ...colorTargets.flatMap((file) => tag(file, findRawColors(read(file)))),
      ...findTsxFiles(root).flatMap((file) => tag(file, findRawTsxColors(read(file)))),
    ],
    zIndex: [
      ...cssTargets.flatMap((file) => tag(file, findRawZIndex(read(file), 'css'))),
      ...findTsxFiles(root).flatMap((file) => tag(file, findRawZIndex(read(file), 'tsx'))),
    ],
    focus: cssTargets
      .filter((file) => !file.endsWith(FORCED_COLORS_SHEET))
      .flatMap((file) => tag(file, findRawFocusRing(read(file)))),
    tokenEqual: findTsxFiles(root).flatMap((file) =>
      findTokenEqualArbitraryValues(themeCss, read(file)).map((hit) => ({
        file,
        line: hit.line,
        literal: `${hit.literal} (use ${hit.utility})`,
      })),
    ),
    primitives: findConsumerFiles(root)
      .filter((file) => file !== themePath)
      .flatMap((file) => tag(file, findPrimitiveColorUses(themeCss, read(file)))),
    ordinals: findConsumerFiles(root).flatMap((file) =>
      tag(file, findOrdinalPaletteNames(read(file))),
    ),
  };
}

export function readThemeSheets(root: string): string {
  const cssDir = join(root, CSS_DIRECTORY);
  const sheets = [THEME_SHEET, ...listScannedCss(root).sort()];
  return sheets.map((sheet) => readFileSync(join(cssDir, sheet), 'utf8')).join('\n');
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
  failed =
    report(
      'arbitrary value(s) that equal an @theme token',
      'Use the token utility named on each line instead of the arbitrary value.',
      scan.tokenEqual,
    ) || failed;
  failed =
    report(
      'primitive color use(s) outside theme.css',
      'Name the role the site means (the one shown on each line) and read it as var(--color-role) or X-(color:--color-role).',
      scan.primitives,
    ) || failed;
  failed =
    report(
      'ordinal palette name(s) that the hue names replaced',
      'The palette is five hue ramps: signal, carbon, sage, gold and coral. Use the name shown on each line.',
      scan.ordinals,
    ) || failed;
  const unused = findUnusedThemeTokens(
    readThemeSheets(root),
    findConsumerFiles(root).map((file) => readFileSync(join(root, file), 'utf8')),
  );
  if (unused.length > 0) {
    failed = true;
    console.error(`[css-tokens] ${unused.length} @theme token(s) with no consumer:`);
    for (const token of unused) console.error(`  ✗ ${token}`);
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
    '[css-tokens] no raw color literals, z-index values or focus rings outside their tokens, no primitive colors where a role exists, no ordinal palette names, no arbitrary values that equal a token, and no unused @theme tokens.',
  );
}

if (isMain(import.meta.url)) main();
