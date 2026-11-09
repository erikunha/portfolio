import { describe, expect, it } from 'vitest';
import { productionSources } from '../helpers/production-sources';

const GUARDED_ROUTE_FILES = [
  'app/(en)/cv/page.tsx',
  'app/(pt)/pt/cv/page.tsx',
  'app/(en)/summary/page.tsx',
  'app/(pt)/pt/summary/page.tsx',
  'app/(pt)/links/page.tsx',
  'app/(en)/links/en/page.tsx',
  'app/(en)/design-system/layout.tsx',
];
const ENSURE_STATIC_NAVIGATION = /^export const ensureStatic = 'navigation';$/m;

describe('static routes declare ensureStatic so request-time rendering cannot return', () => {
  const sources = productionSources(['app']);

  it.each(GUARDED_ROUTE_FILES)('%s requires the complete route to be static', (file) => {
    const source = sources.get(file);
    expect(source, `${file} is missing`).toBeDefined();
    expect(source).toMatch(ENSURE_STATIC_NAVIGATION);
  });

  it('the guard rejects a route file without the export', () => {
    expect('export default function Route() { return null; }\n').not.toMatch(
      ENSURE_STATIC_NAVIGATION,
    );
  });
});
