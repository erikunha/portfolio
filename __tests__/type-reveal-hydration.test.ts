import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles } from '@/scripts/lib/walk';

const ROOTS = ['components', 'app', 'design-system'];
const MARKER = /(?<![\w[-])data-type-reveal(?![\w\]-])/g;
const SUPPRESS = 'suppressHydrationWarning';

const SOURCE_TSX = /\.tsx$/;
const TEST_TSX = /\.(test|e2e)\.tsx$/;

function sourceFiles(dir: string): string[] {
  return listFiles(dir, { include: (name) => SOURCE_TSX.test(name) && !TEST_TSX.test(name) }).map(
    (rel) => join(dir, rel),
  );
}

describe('type reveal elements tolerate the pre-hydration mutation', () => {
  it('every data-type-reveal element opts out of the attribute hydration check', () => {
    const missing: string[] = [];
    let seen = 0;
    for (const file of ROOTS.flatMap(sourceFiles)) {
      // behavioral-test-allow: React only reports attribute hydration mismatches in development, and CI runs the production build, so no runtime check can see a missing opt-out
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(MARKER)) {
        seen += 1;
        const tagStart = source.lastIndexOf('<', match.index);
        const tagEnd = source.indexOf('>', match.index);
        const openingTag = source.slice(tagStart, tagEnd);
        if (!openingTag.includes(SUPPRESS)) missing.push(`${file}:${match.index}`);
      }
    }
    expect(seen, 'the scan must find the marked headings').toBeGreaterThan(0);
    expect(
      missing,
      'TypeReveal sets is-typed and --type-chars before every island hydrates; without suppressHydrationWarning the dev overlay reports a mismatch on each heading',
    ).toEqual([]);
  });
});
