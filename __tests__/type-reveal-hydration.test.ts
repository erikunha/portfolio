import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['components', 'app', 'design-system'];
const MARKER = /data-type-reveal(?![\w\]=-])/g;
const SUPPRESS = 'suppressHydrationWarning';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!path.endsWith('.tsx') || /\.(test|e2e)\.tsx$/.test(path)) return [];
    return [path];
  });
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
        const tagEnd = source.indexOf('>', match.index);
        const rest = source.slice(match.index, tagEnd);
        if (!rest.includes(SUPPRESS)) missing.push(`${file}:${match.index}`);
      }
    }
    expect(seen, 'the scan must find the marked headings').toBeGreaterThan(0);
    expect(
      missing,
      'TypeReveal sets is-typed and --type-chars before every island hydrates; without suppressHydrationWarning the dev overlay reports a mismatch on each heading',
    ).toEqual([]);
  });
});
