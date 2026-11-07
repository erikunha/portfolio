import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as icons from '@/components/Icons/Icons';
import * as linksConstants from '@/content/links.constants';
import * as sectionRegistry from '@/content/section-registry';
import * as siteLocale from '@/content/site-locale';

const ROOT_DIR = process.cwd();
const PRODUCTION_ROOTS = ['app', 'components', 'content', 'design-system', 'lib'];
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const DECLARATION_COUNT = 1;
const NOT_PRODUCTION = /\.(test|spec|e2e)\.[cm]?[jt]sx?$|\/__tests__\//;

function productionSources(dir: string): Map<string, string> {
  const sources = new Map<string, string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [file, text] of productionSources(path)) sources.set(file, text);
    } else if (SOURCE_FILE.test(entry.name) && !NOT_PRODUCTION.test(path)) {
      // behavioral-test-allow: importer reachability of an export is a property of the source graph, not of a render
      sources.set(path, readFileSync(path, 'utf-8'));
    }
  }
  return sources;
}

const SOURCES = new Map<string, string>();
for (const root of PRODUCTION_ROOTS) {
  for (const [file, text] of productionSources(join(ROOT_DIR, root))) SOURCES.set(file, text);
}

const MODULES: Record<string, { exports: Record<string, unknown>; file: string }> = {
  'components/Icons/Icons.tsx': { exports: icons, file: 'components/Icons/Icons.tsx' },
  'content/section-registry.ts': { exports: sectionRegistry, file: 'content/section-registry.ts' },
  'content/site-locale.ts': { exports: siteLocale, file: 'content/site-locale.ts' },
  'content/links.constants.ts': { exports: linksConstants, file: 'content/links.constants.ts' },
};

describe('exports of the shared vocabulary modules have a production importer', () => {
  for (const [name, { exports, file }] of Object.entries(MODULES)) {
    it(`${name}: every runtime export is read by production code`, () => {
      const own = join(ROOT_DIR, file);
      const dead = Object.keys(exports).filter((symbol) => {
        const word = new RegExp(`\\b${symbol}\\b`, 'g');
        const usedInOwnFile = (SOURCES.get(own)?.match(word)?.length ?? 0) > DECLARATION_COUNT;
        const usedElsewhere = [...SOURCES].some(([path, text]) => path !== own && word.test(text));
        return !usedInOwnFile && !usedElsewhere;
      });
      expect(
        dead,
        `${name} exports symbols no production code reads; delete them rather than pin them with a test`,
      ).toEqual([]);
    });
  }
});
