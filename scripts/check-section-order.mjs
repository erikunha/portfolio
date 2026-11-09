#!/usr/bin/env node

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

  const cssSources = readdirSync(resolve(root, 'app/css'))
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(resolve(root, 'app/css', file), 'utf8'));
  const reordered = new Set(cssSources.flatMap((css) => [...collectOrderedIds(css)]));

  if (reordered.size > 0) {
    console.error('\n[check-section-order] Sections reordered with the CSS order property:');
    for (const id of reordered) {
      console.error(`  - ${id}`);
    }
    console.error(
      '\nFix: delete the order declaration. Keyboard and screen reader order follows the DOM order, so a section placed elsewhere on screen breaks WCAG 2.4.3. Reorder the sections in components/SiteHome.tsx instead.',
    );
    process.exit(1);
  }

  const cssIds = new Set(cssSources.flatMap((css) => [...collectCssSectionIds(css)]));

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
    `[check-section-order] OK: ${renderedIds.size} sections checked and none reordered by CSS, ${cssIds.size} live section ids in CSS.`,
  );
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main();
}
