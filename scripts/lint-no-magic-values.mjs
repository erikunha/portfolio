#!/usr/bin/env node
// Rejects hardcoded magic values in .module.css: hex colors, color function literals
// (rgba/rgb/hsl/hsla), non-token px, hardcoded ms/s durations, raw z-index integers.
//
// Intentionally does NOT flag:
//   - Values inside CSS comments (/* ... */)
//   - px values inside @media conditions (those are breakpoints, not layout tokens)
//   - Values already in the allowlist with documented reasons
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, scanCssModules } from './lib/scan-css.mjs';

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
 * Strip @media condition strings so breakpoint px values (768px, 900px, etc.)
 * are never flagged — those are viewport breakpoints, not space tokens.
 * Pattern matches: @media (max-width: Npx), (min-width: Npx), etc.
 */
function stripMediaConditions(css) {
  return css.replace(/@media\s*\([^)]*\)/g, (match) => match.replace(/\d+(?:\.\d+)?px/g, '___px'));
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
    pattern: /\b(?:rgba?|hsla?)\s*\([^)]*\)/gi,
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
  // Raw px values not in allowlist (integer and decimal, e.g. 8.5px)
  {
    pattern: /\b(\d+(?:\.\d+)?)px\b/g,
    extract: (_m, p1) => `${p1}px`,
    filter: (m) => !allowedPx.has(m),
    message: (m) => `magic px value ${m} — use a --ds-space-* token or add to allowlist`,
  },
  // Hardcoded z-index integers
  {
    pattern: /z-index\s*:\s*(\d+)/g,
    extract: (_m, p1) => p1,
    filter: (m) => !allowedZIndex.has(m),
    message: (m) => `hardcoded z-index ${m} — use a var(--ds-z-*) token or add to allowlist`,
  },
];

const cssFiles = await scanCssModules();

let violations = 0;
for (const { rel, stripped } of cssFiles) {
  // Strip media conditions and var() calls before scanning for values.
  // Comments are already stripped by scanCssModules(). Order matters:
  // strip media conditions before var() calls to avoid false-positives.
  const content = stripVarCalls(stripMediaConditions(stripped));
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
console.log(`No-magic-values check passed (${cssFiles.length} files).`);
