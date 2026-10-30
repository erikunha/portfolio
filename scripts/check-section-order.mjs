#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const KNOWN_UNORDERED = new Set([
  'sec-ai-metrics',
  'sec-live-perf',
  'sec-perf-receipts',
  'sec-credentials',
  'sec-community',
]);

const SECTION_ID_PATTERN = /sec-[a-z0-9-]+/g;

export function collectTsx(dir) {
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

export function collectRenderedSectionIds(sources) {
  const ids = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/id="(sec-[^"]+)"/g)) {
      ids.add(m[1]);
    }
  }
  return ids;
}

export function collectLiveSectionIds(sources) {
  const ids = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(SECTION_ID_PATTERN)) {
      ids.add(m[0]);
    }
  }
  return ids;
}

export function collectOrderedIds(css) {
  return new Set(
    [...css.matchAll(/#(sec-[^{\s,]+)[^{}]*\{[^{}]*\border:\s*-?\d+/g)].map((m) => m[1]),
  );
}

export function collectCssSectionIds(css) {
  return new Set([...css.matchAll(/#(sec-[a-z0-9-]+)/g)].map((m) => m[1]));
}

export function findMissingOrderEntries(renderedIds, orderedIds, knownUnordered = KNOWN_UNORDERED) {
  return [...renderedIds].filter((id) => !orderedIds.has(id) && !knownUnordered.has(id));
}

export function findOrphanedCssIds(cssIds, liveIds) {
  return [...cssIds].filter((id) => !liveIds.has(id));
}

function collectSourceIds(root, dirs) {
  const sources = [];
  for (const dir of dirs) {
    for (const file of collectTsx(resolve(root, dir))) {
      sources.push(readFileSync(file, 'utf8'));
    }
  }
  return sources;
}

function main() {
  const root = process.cwd();

  const sectionsDir = resolve(root, 'components/sections');
  const sectionSources = collectTsx(sectionsDir).map((file) => readFileSync(file, 'utf8'));

  const renderedIds = collectRenderedSectionIds(sectionSources);
  const liveIds = collectLiveSectionIds([
    ...sectionSources,
    ...collectSourceIds(root, ['components', 'app']),
  ]);

  const baseCss = readFileSync(resolve(root, 'app/css/base.css'), 'utf8');
  const orderedIds = collectOrderedIds(baseCss);

  const missing = findMissingOrderEntries(renderedIds, orderedIds);

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
      'If this section intentionally defaults to order:0, add it to KNOWN_UNORDERED in this script and record why in DECISIONS.md.',
    );
    process.exit(1);
  }

  const cssIds = collectCssSectionIds(baseCss);
  for (const file of readdirSync(resolve(root, 'app/css'))) {
    if (!file.endsWith('.css')) continue;
    for (const id of collectCssSectionIds(readFileSync(resolve(root, 'app/css', file), 'utf8'))) {
      cssIds.add(id);
    }
  }

  const orphaned = findOrphanedCssIds(cssIds, liveIds);

  if (orphaned.length > 0) {
    console.error('\n[check-section-order] Orphaned #sec-* rules in app/css:');
    for (const id of orphaned) {
      console.error(`  - ${id}`);
    }
    console.error(
      '\nFix: delete the CSS rule(s) for ' +
        orphaned[0] +
        '. No section renders that id any more, so the rule styles nothing.',
    );
    console.error(
      'If the id is rendered somewhere this scan cannot see, keep the rule and widen the live-id scan instead.',
    );
    process.exit(1);
  }

  console.log(
    `[check-section-order] OK — ${renderedIds.size} sections checked (${KNOWN_UNORDERED.size} intentionally unordered), ${cssIds.size} live section ids in CSS.`,
  );
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
