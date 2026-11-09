import { describe, expect, it } from 'vitest';
import * as icons from '@/components/Icons/Icons';
import * as linksConstants from '@/content/links.constants';
import * as sectionRegistry from '@/content/section-registry';
import * as siteLocale from '@/content/site-locale';
import { productionSources } from '../helpers/production-sources';

const PRODUCTION_ROOTS = ['app', 'components', 'content', 'design-system', 'lib'];
const DECLARATION_COUNT = 1;
const SOURCES = productionSources(PRODUCTION_ROOTS);

const MODULES: Record<string, Record<string, unknown>> = {
  'components/Icons/Icons.tsx': icons,
  'content/section-registry.ts': sectionRegistry,
  'content/site-locale.ts': siteLocale,
  'content/links.constants.ts': linksConstants,
};

describe('exports of the shared vocabulary modules have a production reader', () => {
  for (const [file, exports] of Object.entries(MODULES)) {
    it(`${file}: every runtime export is read by production code`, () => {
      const dead = Object.keys(exports).filter((symbol) => {
        const word = new RegExp(`\\b${symbol}\\b`, 'g');
        const usedInOwnFile = (SOURCES.get(file)?.match(word)?.length ?? 0) > DECLARATION_COUNT;
        const usedElsewhere = [...SOURCES].some(([path, text]) => path !== file && word.test(text));
        return !usedInOwnFile && !usedElsewhere;
      });
      expect(
        dead,
        `${file} exports symbols no production code reads; delete them rather than pin them with a test`,
      ).toEqual([]);
    });
  }
});
