#!/usr/bin/env node
/**
 * scripts/lint-breakpoints.mjs
 *
 * Rejects raw width @media queries that use pixel values not registered in
 * app/css/_breakpoints.css. This is the breakpoint contract enforcement gate.
 *
 * WHY: 54 raw @media literals existed across 7 values. The 768/769 pair was
 * manually kept in sync — one off-by-one creates a silent 1px dead-zone.
 * CSS Modules cannot share @custom-media across module boundaries (spike
 * 2026-05-30, see DECISIONS.md), so the contract is: modules may use the
 * approved raw pixel values listed in _breakpoints.css; any OTHER pixel value
 * in a width media query is rejected. New breakpoints must be registered in
 * _breakpoints.css first.
 *
 * Allowlisted media features (never flagged, regardless of value):
 *   prefers-reduced-motion, hover, pointer, any-hover, any-pointer,
 *   prefers-color-scheme, color, color-index, monochrome, print,
 *   aspect-ratio, resolution, orientation
 *
 * Definition file: app/css/_breakpoints.css
 *   Reads the approved set of pixel values from @media definition stubs in
 *   this file. Definition stubs are empty @media blocks whose sole purpose
 *   is to register the value with this gate.
 *
 * Run: node scripts/lint-breakpoints.mjs
 * Exit 1 if any violation found; exit 0 if clean.
 */
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- Load approved breakpoint values from the definition file ---
const DEFINITION_FILE = path.join(ROOT, 'app/css/_breakpoints.css');
const DEFINITION_REL = 'app/css/_breakpoints.css';

let definitionContent;
try {
  definitionContent = readFileSync(DEFINITION_FILE, 'utf8');
} catch {
  console.error(`lint-breakpoints: cannot read definition file: ${DEFINITION_FILE}`);
  process.exit(1);
}

// Extract approved pixel values from CSS custom properties in the definition file.
// Reads --ds-bp-* properties defined in :root whose values are plain pixel values.
// E.g. "--ds-bp-mobile: 768px;" → approves "768px".
// This avoids requiring empty @media blocks (which trigger Biome noEmptyBlock).
const DEFINITION_PROP_RE = /--ds-bp-[a-z-]+\s*:\s*(\d+px)\s*;/g;
const approvedValues = new Set();
for (const match of definitionContent.matchAll(DEFINITION_PROP_RE)) {
  approvedValues.add(match[1]);
}

if (approvedValues.size === 0) {
  console.error(
    `lint-breakpoints: no approved values found in ${DEFINITION_REL} — gate cannot run`,
  );
  process.exit(1);
}

/** Returns true if a media condition contains a width query (max-width or min-width). */
function containsWidthQuery(mediaCondition) {
  return /(?:max-width|min-width)\s*:/.test(mediaCondition);
}

/** Strip block comments from CSS content, preserving line count. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

// --- Scan all CSS files ---
const CSS_IGNORE = ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'];

const allFiles = await Array.fromAsync(glob('**/*.css', { cwd: ROOT, ignore: CSS_IGNORE }));

// @media rule extraction: captures the full condition string after "@media"
// This regex handles both single-condition and complex (and/or/not) queries.
const MEDIA_RULE_RE = /@media\s+([^{]+?)\s*\{/g;

// Within a media condition, find all width constraints with their px value
const WIDTH_VALUE_RE = /(?:max-width|min-width)\s*:\s*(\d+px)/g;

let violations = 0;

for (const rel of allFiles.sort()) {
  // Skip the definition file itself — it is the allowlist source
  if (rel === DEFINITION_REL) continue;

  const abs = path.join(ROOT, rel);
  let content;
  try {
    content = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }

  const stripped = stripComments(content);

  for (const mediaMatch of stripped.matchAll(MEDIA_RULE_RE)) {
    const condition = mediaMatch[1].trim();

    // Skip queries that don't contain any width constraint at all
    if (!containsWidthQuery(condition)) continue;

    // Extract each width px value from the condition
    for (const valueMatch of condition.matchAll(WIDTH_VALUE_RE)) {
      const pxValue = valueMatch[1];
      if (!approvedValues.has(pxValue)) {
        // Compute 1-indexed line number from position in stripped content
        const upTo = stripped.slice(0, mediaMatch.index);
        const lineNum = upTo.split('\n').length;
        console.error(
          `BREAKPOINT VIOLATION in ${rel}:${lineNum}: @media ${condition} — ` +
            `${pxValue} is not in the approved breakpoint set. ` +
            'Register it in app/css/_breakpoints.css first.\n' +
            `  Approved values: ${[...approvedValues].sort().join(', ')}`,
        );
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} breakpoint violation(s). Fix before merging.`);
  process.exit(1);
}

console.log(
  `Breakpoint gate passed — ${approvedValues.size} approved values, 0 violations (${allFiles.length} files scanned).`,
);
