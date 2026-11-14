import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_HEADER,
  CHANGELOG_INTRO,
  commitTypeToKind,
  humanizeDescription,
  mergeChangelogGroups,
  parseChangelogGroups,
  renderChangelogGroups,
  renderChangelogPage,
} from '@/scripts/lib/changelog-merge';

const EXISTING_MDX = `export const metadata = {
  title: 'Changelog · Design System · erikunha.dev',
};

# CHANGELOG

## 2026-05-30

- **docs:** fix phantom layer tokens on reference page

## 2026-05-24

- **fix:** remove commitizen, add space token aliases, fix token boundary violations
- **feat:** git-driven changelog + sidebar home link
`;

describe('parseChangelogGroups', () => {
  it('extracts date groups with their entries from an existing changelog', () => {
    const groups = parseChangelogGroups(EXISTING_MDX);
    expect([...groups.keys()]).toEqual(['2026-05-30', '2026-05-24']);
    expect(groups.get('2026-05-24')).toEqual([
      {
        kind: 'Fixed' as const,
        description: 'remove commitizen, add space token aliases, fix token boundary violations',
        breaking: false,
      },
      {
        kind: 'Added' as const,
        description: 'git-driven changelog + sidebar home link',
        breaking: false,
      },
    ]);
  });

  it('returns an empty map for a changelog with no entries', () => {
    expect(parseChangelogGroups('# CHANGELOG\n').size).toBe(0);
  });
});

describe('mergeChangelogGroups', () => {
  it('preserves existing entries whose commits no longer exist in git history (squash merges)', () => {
    const existing = parseChangelogGroups(EXISTING_MDX);
    const fromGit = new Map([
      [
        '2026-07-09',
        [
          {
            kind: 'Added' as const,
            description: 'align docs type scale with the app',
            breaking: false,
          },
        ],
      ],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-05-30')).toEqual([
      {
        kind: 'Changed' as const,
        description: 'Fix phantom layer tokens on reference page',
        breaking: false,
      },
    ]);
    expect(merged.get('2026-07-09')).toEqual([
      {
        kind: 'Added' as const,
        description: 'Align docs type scale with the app',
        breaking: false,
      },
    ]);
  });

  it('dedupes an entry present in both the file and git history (idempotent re-sync)', () => {
    const existing = new Map([
      ['2026-07-09', [{ kind: 'Added' as const, description: 'same entry', breaking: false }]],
    ]);
    const fromGit = new Map([
      [
        '2026-07-09',
        [
          { kind: 'Added' as const, description: 'same entry', breaking: false },
          { kind: 'Fixed' as const, description: 'new entry', breaking: false },
        ],
      ],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-07-09')).toEqual([
      { kind: 'Added' as const, description: 'Same entry', breaking: false },
      { kind: 'Fixed' as const, description: 'New entry', breaking: false },
    ]);
  });
});

describe('breaking changes survive the parse/render round-trip', () => {
  it('renders a breaking entry with the ! marker', () => {
    const groups = new Map([
      [
        '2026-07-16',
        [{ kind: 'Added' as const, description: 'drop the legacy token alias', breaking: true }],
      ],
    ]);
    expect(renderChangelogGroups(groups)).toContain('- Breaking: Drop the legacy token alias');
  });

  it('parses a rendered breaking entry back, marker intact', () => {
    const mdx =
      '# CHANGELOG\n\n## 2026-07-16\n\n### Added\n\n- Breaking: drop the legacy token alias\n';
    expect(
      parseChangelogGroups(mdx).get('2026-07-16'),
      'render and parse must agree on the ! marker. They are separate regexes over the same line, so a fix to one that misses the other silently drops every breaking entry on the next sync: it fails to parse back out of the file, and re-appears only while its commit is still in git history.',
    ).toEqual([
      { kind: 'Added' as const, description: 'drop the legacy token alias', breaking: true },
    ]);
  });

  it('parses a legacy breaking line, marker intact', () => {
    const mdx = '# CHANGELOG\n\n## 2026-07-16\n\n- **feat!:** drop the legacy token alias\n';
    expect(parseChangelogGroups(mdx).get('2026-07-16')).toEqual([
      { kind: 'Added' as const, description: 'drop the legacy token alias', breaking: true },
    ]);
  });

  it('does not dedupe a breaking entry against its non-breaking twin', () => {
    const existing = new Map([
      [
        '2026-07-16',
        [{ kind: 'Added' as const, description: 'drop the legacy token alias', breaking: false }],
      ],
    ]);
    const fromGit = new Map([
      [
        '2026-07-16',
        [{ kind: 'Added' as const, description: 'drop the legacy token alias', breaking: true }],
      ],
    ]);
    expect(
      mergeChangelogGroups(existing, fromGit).get('2026-07-16'),
      'the dedupe key must include the breaking flag, or a breaking change is swallowed by an identically-worded non-breaking entry.',
    ).toHaveLength(2);
  });
});

const DASHES = /[\u2013\u2014]/;

describe('changelog text carries no em or en dash', () => {
  it('replaces a dash in a commit subject with a colon when rendering', () => {
    const groups = new Map([
      [
        '2026-07-16',
        [
          {
            kind: 'Added' as const,
            description: 'StatTile display variant \u2014 docs tiles',
            breaking: false,
          },
        ],
      ],
    ]);
    const out = renderChangelogGroups(groups);
    expect(out, 'the generated page is visible copy; the no-dash rule covers it').not.toMatch(
      DASHES,
    );
    expect(out).toContain('- StatTile display variant: docs tiles');
  });

  it('does not duplicate an entry whose git subject has a dash and whose file text is clean', () => {
    const existing = new Map([
      ['2026-07-16', [{ kind: 'Added' as const, description: 'A: b', breaking: false }]],
    ]);
    const fromGit = new Map([
      ['2026-07-16', [{ kind: 'Added' as const, description: 'a \u2013 b', breaking: false }]],
    ]);
    expect(
      mergeChangelogGroups(existing, fromGit).get('2026-07-16'),
      'a re-sync must stay idempotent after the dash is rewritten',
    ).toHaveLength(1);
  });

  it('writes a page title without a dash', () => {
    expect(CHANGELOG_HEADER).not.toMatch(DASHES);
    expect(CHANGELOG_HEADER).toContain(
      "title: 'Changelog \u00b7 Design System \u00b7 erikunha.dev'",
    );
  });
});

describe('renderChangelogGroups', () => {
  it('renders date groups newest-first', () => {
    const merged = new Map([
      ['2026-05-24', [{ kind: 'Added' as const, description: 'older', breaking: false }]],
      ['2026-07-09', [{ kind: 'Fixed' as const, description: 'newer', breaking: false }]],
    ]);
    const out = renderChangelogGroups(merged);
    expect(out.indexOf('2026-07-09</h2>')).toBeLessThan(out.indexOf('2026-05-24</h2>'));
    expect(out).toContain('- Newer');
  });
});

describe('humanizeDescription', () => {
  it.each([
    [
      'finish topbar, mobile menu and pager port (#319)',
      'Finish topbar, mobile menu and pager port',
    ],
    ['one gutter and page measure (T075 part 1) (#302)', 'One gutter and page measure'],
    ['/design-system route + MDX docs (PR-C) (#50)', '/design-system route + MDX docs'],
    ['StatTile display variant', 'StatTile display variant'],
    ['Already capitalised', 'Already capitalised'],
  ])('rewrites %s', (raw, human) => {
    expect(humanizeDescription(raw)).toBe(human);
  });

  it('is idempotent', () => {
    const once = humanizeDescription('keep it stable (#12)');
    expect(humanizeDescription(once)).toBe(once);
  });
});

describe('commitTypeToKind', () => {
  it.each([
    ['feat', 'Added'],
    ['fix', 'Fixed'],
    ['refactor', 'Changed'],
    ['perf', 'Changed'],
    ['docs', 'Changed'],
    ['test', 'Changed'],
  ])('groups %s under %s', (type, kind) => {
    expect(commitTypeToKind(type)).toBe(kind);
  });
});

describe('grouped rendering', () => {
  const groups = new Map([
    [
      '2026-07-09',
      [
        { kind: 'Fixed' as const, description: 'closes the gap (#12)', breaking: false },
        { kind: 'Added' as const, description: 'new swatch list', breaking: false },
        { kind: 'Fixed' as const, description: 'second fix', breaking: false },
      ],
    ],
  ]);

  it('lists entries under Added, Changed and Fixed headings without commit prefixes', () => {
    const out = renderChangelogGroups(groups);
    expect(out).toContain('### Added\n\n- New swatch list');
    expect(out).toContain('### Fixed\n\n- Closes the gap\n- Second fix');
    expect(out).not.toContain('**fix');
    expect(out).not.toContain('(#12)');
    expect(out).not.toContain('### Changed');
    expect(out.indexOf('### Added')).toBeLessThan(out.indexOf('### Fixed'));
  });

  it('round-trips through parse so a re-sync does not duplicate entries', () => {
    const page = renderChangelogPage(groups);
    const reparsed = parseChangelogGroups(page);
    expect(renderChangelogPage(mergeChangelogGroups(reparsed, groups))).toBe(page);
  });

  it('emits an on-this-page list with one link per date', () => {
    const page = renderChangelogPage(groups);
    expect(page).toContain("<OnThisPage items={[{id:'2026-07-09',label:'2026-07-09'}]} />");
    expect(page).toContain('<h2 id="2026-07-09">2026-07-09</h2>');
  });

  it('puts an intro paragraph right after the list so a phone shows it before the list', () => {
    const page = renderChangelogPage(groups);
    expect(page.indexOf('<OnThisPage')).toBeLessThan(page.indexOf(CHANGELOG_INTRO));
    expect(page.indexOf(CHANGELOG_INTRO)).toBeLessThan(page.indexOf('<h2 id="2026-07-09">'));
  });
});

describe('the committed changelog page', () => {
  it('is exactly what the generator renders from its own entries', () => {
    // behavioral-test-allow: the generated MDX page is the published copy, the file text is the property under test
    const page = readFileSync(
      join(process.cwd(), 'app/(en)/design-system/changelog/page.mdx'),
      'utf8',
    );
    expect(
      renderChangelogPage(mergeChangelogGroups(parseChangelogGroups(page), new Map())),
      'run pnpm changelog:sync; the page is generated, never hand-edited',
    ).toBe(page);
    expect(page).not.toMatch(/\*\*(feat|fix|docs|refactor|test|perf)!?:\*\*/);
    expect(page).not.toMatch(/\(#\d+\)/);
  });

  it('contains no em or en dash in its title or entries', () => {
    // behavioral-test-allow: the generated MDX page is the published copy, the file text is the property under test
    const page = readFileSync(
      join(process.cwd(), 'app/(en)/design-system/changelog/page.mdx'),
      'utf8',
    );
    expect(page, 'run pnpm changelog:sync; the generator rewrites dashes').not.toMatch(DASHES);
  });
});
