#!/usr/bin/env node
/**
 * Verifies every sec-* id defined in components/sections/ has a matching
 * #sec-... order rule in the app/css/base.css mobile block.
 *
 * Motivation: app/css/base.css uses CSS flex `order` to reorder sections
 * on mobile. Sections without an explicit order default to 0 and float to the
 * top of the page, above all numbered sections. This caused sec-daw-mixer to
 * appear between the hero and readme sections on mobile until caught by manual
 * visual inspection (2026-05-28).
 *
 * Previously this was AppShell.module.css; migrated to app/css/base.css as
 * part of the Tailwind v4 migration (2026-05-31) — CSS modules removed.
 *
 * KNOWN_UNORDERED: sections intentionally kept at order:0 (appear right after
 * hero on mobile, before all numbered sections). Add a comment explaining why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();

const KNOWN_UNORDERED = new Set([
  // sec-man-page-body is a sub-content div nested inside #sec-man-page
  // (ManPageMobile.tsx). It inherits the parent section's flex order and
  // does not need its own order rule in the flex column layout.
  'sec-man-page-body',
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

// Mobile section ordering migrated from AppShell.module.css → app/css/base.css
// as part of the Tailwind v4 migration (2026-05-31). Selectors are now plain
// #sec-* IDs (no :global() wrapper needed outside CSS Modules).
const baseCss = readFileSync(resolve(root, 'app/css/base.css'), 'utf8');
// Extract the region starting at the "Mobile section order" comment.
// All #sec-* selectors in that region are the ordered set.
// This avoids false-positives from #sec-* used in other contexts.
const sectionOrderComment = baseCss.indexOf('Mobile section order');
const sectionOrderRegion = sectionOrderComment >= 0 ? baseCss.substring(sectionOrderComment) : '';
const orderedIds = new Set(
  [...sectionOrderRegion.matchAll(/#(sec-[^{\s]+)\s*\{/g)].map((m) => m[1]),
);

const missing = [...sectionIds].filter((id) => !orderedIds.has(id) && !KNOWN_UNORDERED.has(id));

if (missing.length > 0) {
  console.error('\n[check-section-order] Missing mobile order entries in app/css/base.css:');
  for (const id of missing) {
    console.error(`  - ${id}`);
  }
  console.error(
    '\nFix: add #' +
      missing[0] +
      ' { order: N; } inside the @media (max-width: 768px) block in app/css/base.css.',
  );
  console.error(
    'If this section intentionally defaults to order:0, add it to KNOWN_UNORDERED in this script with a comment explaining why.',
  );
  process.exit(1);
}

console.log(
  `[check-section-order] OK — ${sectionIds.size} sections checked (${KNOWN_UNORDERED.size} intentionally unordered).`,
);
