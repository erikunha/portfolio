import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isMain } from '../lib/is-main';
import { listFiles } from '../lib/walk';

const SECTION_ID_PATTERN = /sec-[a-z0-9-]+/g;
const RENDERED_ID_PATTERN = /id="(sec-[^"]+)"/g;
const ORDERED_RULE_PATTERN = /#(sec-[^{\s,]+)[^{}]*\{[^{}]*\border:\s*-?\d+/g;
const CSS_ID_PATTERN = /#(sec-[a-z0-9-]+)/g;
const TSX_EXTENSION = '.tsx';
const TEST_MARKER = '.test.';
const CSS_EXTENSION = '.css';
const SECTIONS_DIR = 'components/sections';
const CSS_DIR = 'app/css';
const LIVE_SCAN_DIRS = ['components', 'app'];
const FAILURE_EXIT_CODE = 1;
const TAG = '[check-section-order]';

export function collectTsx(dir: string): string[] {
  return listFiles(dir, {
    include: (name) => name.endsWith(TSX_EXTENSION) && !name.includes(TEST_MARKER),
  }).map((rel) => join(dir, rel));
}

export function collectRenderedSectionIds(sources: string[]): Set<string> {
  const ids = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(RENDERED_ID_PATTERN)) {
      if (m[1]) ids.add(m[1]);
    }
  }
  return ids;
}

export function collectLiveSectionIds(sources: string[]): Set<string> {
  const ids = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(SECTION_ID_PATTERN)) {
      ids.add(m[0]);
    }
  }
  return ids;
}

export function collectOrderedIds(css: string): Set<string> {
  return new Set([...css.matchAll(ORDERED_RULE_PATTERN)].flatMap((m) => (m[1] ? [m[1]] : [])));
}

export function collectCssSectionIds(css: string): Set<string> {
  return new Set([...css.matchAll(CSS_ID_PATTERN)].flatMap((m) => (m[1] ? [m[1]] : [])));
}

export function findOrphanedCssIds(cssIds: Set<string>, liveIds: Set<string>): string[] {
  return [...cssIds].filter((id) => !liveIds.has(id));
}

function collectSourceIds(root: string, dirs: string[]): string[] {
  const sources: string[] = [];
  for (const dir of dirs) {
    for (const file of collectTsx(resolve(root, dir))) {
      sources.push(readFileSync(file, 'utf8'));
    }
  }
  return sources;
}

function main(): void {
  const root = process.cwd();

  const sectionSources = collectTsx(resolve(root, SECTIONS_DIR)).map((file) =>
    readFileSync(file, 'utf8'),
  );

  const renderedIds = collectRenderedSectionIds(sectionSources);
  const liveIds = collectLiveSectionIds([
    ...sectionSources,
    ...collectSourceIds(root, LIVE_SCAN_DIRS),
  ]);

  const cssSources = readdirSync(resolve(root, CSS_DIR))
    .filter((file) => file.endsWith(CSS_EXTENSION))
    .map((file) => readFileSync(resolve(root, CSS_DIR, file), 'utf8'));
  const reordered = new Set(cssSources.flatMap((css) => [...collectOrderedIds(css)]));

  if (reordered.size > 0) {
    console.error(`\n${TAG} Sections reordered with the CSS order property:`);
    for (const id of reordered) {
      console.error(`  - ${id}`);
    }
    console.error(
      '\nFix: delete the order declaration. Keyboard and screen reader order follows the DOM order, so a section placed elsewhere on screen breaks WCAG 2.4.3. Reorder the sections in components/SiteHome.tsx instead.',
    );
    process.exit(FAILURE_EXIT_CODE);
  }

  const cssIds = new Set(cssSources.flatMap((css) => [...collectCssSectionIds(css)]));

  const orphaned = findOrphanedCssIds(cssIds, liveIds);

  if (orphaned.length > 0) {
    console.error(`\n${TAG} Orphaned #sec-* rules in app/css:`);
    for (const id of orphaned) {
      console.error(`  - ${id}`);
    }
    console.error(
      `\nFix: delete the CSS rule(s) for ${orphaned[0]}. No section renders that id any more, so the rule styles nothing.`,
    );
    console.error(
      'If the id is rendered somewhere this scan cannot see, keep the rule and widen the live-id scan instead.',
    );
    process.exit(FAILURE_EXIT_CODE);
  }

  console.log(
    `${TAG} OK: ${renderedIds.size} sections checked and none reordered by CSS, ${cssIds.size} live section ids in CSS.`,
  );
}

if (isMain(import.meta.url)) {
  main();
}
