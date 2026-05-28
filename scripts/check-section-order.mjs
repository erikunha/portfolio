#!/usr/bin/env node
/**
 * Verifies every sec-* id defined in components/sections/ has a matching
 * :global(#sec-...) order rule in the AppShell.module.css mobile block.
 *
 * Motivation: AppShell.module.css uses CSS flex `order` to reorder sections
 * on mobile. Sections without an explicit order default to 0 and float to the
 * top of the page, above all numbered sections. This caused sec-daw-mixer to
 * appear between the hero and readme sections on mobile until caught by manual
 * visual inspection (2026-05-28).
 *
 * KNOWN_UNORDERED: sections intentionally kept at order:0 (appear right after
 * hero on mobile, before all numbered sections). Add a comment explaining why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();

const KNOWN_UNORDERED = new Set([
  // sec-ai-metrics intentionally has no explicit order (defaults to 0).
  // On mobile it appears immediately after the hero — desired behaviour, as
  // AiMetrics is a key above-the-fold signal that should stay near the top.
  'sec-ai-metrics',
]);

// Recursively collect all .tsx files under components/sections/
function collectTsx(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsx(full));
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      results.push(full);
    }
  }
  return results;
}

const sectionsDir = resolve(root, 'components/sections');
const tsxFiles = collectTsx(sectionsDir);

const sectionIds = new Set();
for (const file of tsxFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/id="(sec-[^"]+)"/g)) {
    sectionIds.add(m[1]);
  }
}

const appShellCss = readFileSync(resolve(root, 'components/AppShell/AppShell.module.css'), 'utf8');
// Extract only the @media (max-width: 768px) block to avoid false-positives
// from :global(#sec-...) selectors used outside mobile ordering context.
const mobileBlockMatch = appShellCss.match(
  /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)(?=\n[}\s]*$|\n@media|\n\/\*[^@])/,
);
const mobileBlock = mobileBlockMatch ? mobileBlockMatch[1] : '';
const orderedIds = new Set([...mobileBlock.matchAll(/:global\(#(sec-[^)]+)\)/g)].map((m) => m[1]));

const missing = [...sectionIds].filter((id) => !orderedIds.has(id) && !KNOWN_UNORDERED.has(id));

if (missing.length > 0) {
  console.error('\n[check-section-order] Missing mobile order entries in AppShell.module.css:');
  for (const id of missing) {
    console.error(`  - ${id}`);
  }
  console.error(
    '\nFix: add :global(#' +
      missing[0] +
      ') { order: N; } inside the @media (max-width: 768px) block.',
  );
  console.error(
    'If this section intentionally defaults to order:0, add it to KNOWN_UNORDERED in this script with a comment explaining why.',
  );
  process.exit(1);
}

console.log(
  `[check-section-order] OK — ${sectionIds.size} sections checked (${KNOWN_UNORDERED.size} intentionally unordered).`,
);
