import { describe, expect, it } from 'vitest';
import * as footer from './footer.schema';
import * as navigation from './navigation.schema';
import * as primitives from './schema-primitives';
import * as barrel from './schemas';

type Moved = readonly [string, Record<string, unknown>, readonly string[]];

const MOVED: readonly Moved[] = [
  [
    'schema-primitives',
    primitives,
    ['CompanyUrlSchema', 'LocalizedTextSchema', 'SectionTextSchema'],
  ],
  ['navigation.schema', navigation, ['createNavigationSchema']],
  ['footer.schema', footer, ['CopyFeedbackSchema', 'FooterContentSchema']],
];

const INTERNAL = new Set(['SectionTextSchema']);

describe.each(MOVED)('%s', (_name, moved, names) => {
  it('exports exactly the moved names', () => {
    expect(Object.keys(moved).sort()).toEqual([...names].sort());
  });

  it.each(names.filter((name) => !INTERNAL.has(name)))(
    'barrel re-exports %s as the same value',
    (name) => {
      expect((barrel as Record<string, unknown>)[name]).toBe(moved[name]);
    },
  );
});
