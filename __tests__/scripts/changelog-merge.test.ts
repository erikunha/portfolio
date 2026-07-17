import { describe, expect, it } from 'vitest';
import {
  mergeChangelogGroups,
  parseChangelogGroups,
  renderChangelogGroups,
} from '@/scripts/lib/changelog-merge';

const EXISTING_MDX = `export const metadata = {
  title: 'Changelog — Design System — erikunha.dev',
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
        type: 'fix',
        description: 'remove commitizen, add space token aliases, fix token boundary violations',
        breaking: false,
      },
      { type: 'feat', description: 'git-driven changelog + sidebar home link', breaking: false },
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
        [{ type: 'feat', description: 'align docs type scale with the app', breaking: false }],
      ],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-05-30')).toEqual([
      { type: 'docs', description: 'fix phantom layer tokens on reference page', breaking: false },
    ]);
    expect(merged.get('2026-07-09')).toEqual([
      { type: 'feat', description: 'align docs type scale with the app', breaking: false },
    ]);
  });

  it('dedupes an entry present in both the file and git history (idempotent re-sync)', () => {
    const existing = new Map([
      ['2026-07-09', [{ type: 'feat', description: 'same entry', breaking: false }]],
    ]);
    const fromGit = new Map([
      [
        '2026-07-09',
        [
          { type: 'feat', description: 'same entry', breaking: false },
          { type: 'fix', description: 'new entry', breaking: false },
        ],
      ],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-07-09')).toEqual([
      { type: 'feat', description: 'same entry', breaking: false },
      { type: 'fix', description: 'new entry', breaking: false },
    ]);
  });
});

describe('breaking changes survive the parse/render round-trip', () => {
  it('renders a breaking entry with the ! marker', () => {
    const groups = new Map([
      [
        '2026-07-16',
        [{ type: 'feat', description: 'remove the Breadcrumb feature', breaking: true }],
      ],
    ]);
    expect(renderChangelogGroups(groups)).toContain('- **feat!:** remove the Breadcrumb feature');
  });

  it('parses a rendered breaking entry back, marker intact', () => {
    const mdx = '# CHANGELOG\n\n## 2026-07-16\n\n- **feat!:** remove the Breadcrumb feature\n';
    expect(
      parseChangelogGroups(mdx).get('2026-07-16'),
      'render and parse must agree on the ! marker. They are separate regexes over the same line, so a fix to one that misses the other silently drops every breaking entry on the next sync: it fails to parse back out of the file, and re-appears only while its commit is still in git history.',
    ).toEqual([{ type: 'feat', description: 'remove the Breadcrumb feature', breaking: true }]);
  });

  it('does not dedupe a breaking entry against its non-breaking twin', () => {
    const existing = new Map([
      [
        '2026-07-16',
        [{ type: 'feat', description: 'remove the Breadcrumb feature', breaking: false }],
      ],
    ]);
    const fromGit = new Map([
      [
        '2026-07-16',
        [{ type: 'feat', description: 'remove the Breadcrumb feature', breaking: true }],
      ],
    ]);
    expect(
      mergeChangelogGroups(existing, fromGit).get('2026-07-16'),
      'the dedupe key must include the breaking flag, or a breaking change is swallowed by an identically-worded non-breaking entry.',
    ).toHaveLength(2);
  });
});

describe('renderChangelogGroups', () => {
  it('renders date groups newest-first', () => {
    const merged = new Map([
      ['2026-05-24', [{ type: 'feat', description: 'older', breaking: false }]],
      ['2026-07-09', [{ type: 'fix', description: 'newer', breaking: false }]],
    ]);
    const out = renderChangelogGroups(merged);
    expect(out.indexOf('## 2026-07-09')).toBeLessThan(out.indexOf('## 2026-05-24'));
    expect(out).toContain('- **fix:** newer');
  });
});
