#!/usr/bin/env node
// Rejects hardcoded magic values in .module.css: hex colors, color function literals
// (rgba/rgb/hsl/hsla), non-token px, hardcoded ms/s durations, raw z-index integers.
//
// Intentionally does NOT flag:
//   - Values inside CSS comments (/* ... */)
//   - px values inside @media conditions (those are breakpoints, not layout tokens)
//   - Values already in the allowlist with documented reasons
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowlist = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/lint-no-magic-values.allowlist.json'), 'utf8'),
);

const allowedHex = new Set(allowlist['hex-colors'].map((e) => e.value));
const allowedPx = new Set(allowlist['px-values'].map((e) => e.value));
const allowedDurations = new Set(allowlist['duration-values'].map((e) => e.value));
// z-index-values entries may be plain strings or {value, reason} objects
const allowedZIndex = new Set(
  allowlist['z-index-values'].map((e) => (typeof e === 'string' ? e : e.value)),
);
const allowedColorFunctions = new Set((allowlist['color-functions'] ?? []).map((e) => e.value));

/**
 * Strip CSS block comments from content so we never flag values inside them.
 * Preserves line count by replacing comment bodies with spaces.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * Strip @media condition strings so breakpoint px values (768px, 900px, etc.)
 * are never flagged — those are viewport breakpoints, not space tokens.
 * Pattern matches: @media (max-width: Npx), (min-width: Npx), etc.
 */
function stripMediaConditions(css) {
  return css.replace(/@media\s*\([^)]*\)/g, (match) => match.replace(/\d+px/g, '___px'));
}

/**
 * Strip var() calls so values used as var() fallbacks or inside var() references
 * are never flagged. Replaces var(...) with a placeholder that won't match any
 * of the check patterns. Pre-processing the content this way is simpler and more
 * reliable than using complex regex lookahead/lookbehind assertions.
 */
function stripVarCalls(css) {
  return css.replace(/var\([^)]*\)/g, 'VAR_REF');
}

// Patterns to detect magic values; run against pre-processed content (no comments,
// no @media conditions, no var() calls) to avoid false-positives.
const checks = [
  // Hex colors
  {
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    extract: (m) => m,
    filter: (m) => !allowedHex.has(m),
    message: (m) => `hardcoded hex color ${m} — use a --ds-color-* token or add to allowlist`,
  },
  // rgba / rgb / hsl color function calls
  {
    pattern: /\b(?:rgba?|hsla?)\s*\([^)]*\)/g,
    extract: (m) => m.replace(/\s+/g, ' ').trim(),
    filter: (m) => !allowedColorFunctions.has(m),
    message: (m) =>
      `hardcoded color function ${m} — use a --ds-color-* token or add to allowlist with a reason`,
  },
  // Raw ms durations
  {
    pattern: /\b(\d+)ms\b/g,
    extract: (_m, p1) => `${p1}ms`,
    filter: (m) => !allowedDurations.has(m),
    message: (m) => `hardcoded duration ${m} — use var(--ds-duration-*) or add to allowlist`,
  },
  // Raw s durations — matches e.g. 0.6s, 1.05s, 4s
  {
    pattern: /\b(\d+(?:\.\d+)?)s\b/g,
    extract: (_m, p1) => `${p1}s`,
    filter: (m) => !allowedDurations.has(m),
    message: (m) => `hardcoded duration ${m} — use var(--ds-duration-*) or add to allowlist`,
  },
  // Raw px values not in allowlist
  {
    pattern: /\b(\d+)px\b/g,
    extract: (_m, p1) => `${p1}px`,
    filter: (m) => !allowedPx.has(m),
    message: (m) => `magic px value ${m} — use a --ds-space-* token or add to allowlist`,
  },
  // Hardcoded z-index integers
  {
    pattern: /z-index\s*:\s*(\d+)/g,
    extract: (_m, p1) => p1,
    filter: (m) => !allowedZIndex.has(m),
    message: (m) => `hardcoded z-index ${m} — use var(--ds-layer-*) or add to allowlist`,
  },
];

const files = await Array.fromAsync(
  glob('**/*.module.css', {
    cwd: ROOT,
    ignore: ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'],
  }),
);

let violations = 0;
for (const rel of files.sort()) {
  const abs = path.join(ROOT, rel);
  const raw = readFileSync(abs, 'utf8');
  // Strip comments, media conditions, and var() calls before scanning for values.
  // Order matters: strip comments first so var() inside comments don't suppress real findings.
  const content = stripVarCalls(stripMediaConditions(stripComments(raw)));
  for (const check of checks) {
    for (const match of content.matchAll(check.pattern)) {
      const val = check.extract ? check.extract(match[0], match[1]) : match[0];
      if (check.filter && !check.filter(val)) continue;
      console.error(`MAGIC VALUE in ${rel}: ${check.message(val)}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} magic value(s) found. Fix or add to allowlist.`);
  process.exit(1);
}
console.log(`No-magic-values check passed (${files.length} files).`);
