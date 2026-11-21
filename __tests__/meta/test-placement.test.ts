import { describe, expect, it } from 'vitest';
import { trackedFiles } from '../../scripts/lib/git';

const LIB_TESTS_FOLDER = /^lib\/(?:.*\/)?__tests__\//;
const ROOT_FAMILY_FILE = /^__tests__\/(?:ask|contact|agent)-[^/]+$/;
const NO_TESTS_FOLDER_ROOTS =
  /^(?:components|content|evals|design-system|app)\/(?:.*\/)?__tests__\//;

function misplacedTests(files: readonly string[]): string[] {
  return files.filter(
    (file) =>
      LIB_TESTS_FOLDER.test(file) ||
      ROOT_FAMILY_FILE.test(file) ||
      NO_TESTS_FOLDER_ROOTS.test(file),
  );
}

describe('misplacedTests', () => {
  it('reports each rule violation and no clean path', () => {
    const violations = [
      'lib/ask/__tests__/x.test.ts',
      '__tests__/ask-x.test.ts',
      'components/Foo/__tests__/x.test.tsx',
      '__tests__/contact-y.test.ts',
      '__tests__/agent-z.test.ts',
      'app/api/ask/__tests__/r.test.ts',
      'lib/__tests__/env.test.ts',
    ];
    const clean = [
      'lib/env.test.ts',
      'lib/ask/x.test.ts',
      '__tests__/ask/x.test.ts',
      '__tests__/meta/x.test.ts',
      '__tests__/asking.test.ts',
      'scripts/__tests__/x.test.ts',
    ];
    expect(misplacedTests([...violations, ...clean])).toEqual(violations);
  });
});

describe('test placement', () => {
  it('keeps every tracked test where the placement rule puts it', () => {
    expect(
      misplacedTests(trackedFiles()),
      'move the test beside its module, or into __tests__/<family>/ (see STANDARDS.md chapter 4)',
    ).toEqual([]);
  });
});
