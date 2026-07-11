#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();

const KNOWN_UNORDERED = new Set(['sec-man-page-body']);

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

const baseCss = readFileSync(resolve(root, 'app/css/base.css'), 'utf8');
const orderedIds = new Set(
  [...baseCss.matchAll(/#(sec-[^{\s,]+)[^{}]*\{[^{}]*\border:\s*-?\d+/g)].map((m) => m[1]),
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
