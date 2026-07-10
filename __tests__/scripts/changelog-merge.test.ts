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
      },
      { type: 'feat', description: 'git-driven changelog + sidebar home link' },
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
      ['2026-07-09', [{ type: 'feat', description: 'align docs type scale with the app' }]],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-05-30')).toEqual([
      { type: 'docs', description: 'fix phantom layer tokens on reference page' },
    ]);
    expect(merged.get('2026-07-09')).toEqual([
      { type: 'feat', description: 'align docs type scale with the app' },
    ]);
  });

  it('dedupes an entry present in both the file and git history (idempotent re-sync)', () => {
    const existing = new Map([['2026-07-09', [{ type: 'feat', description: 'same entry' }]]]);
    const fromGit = new Map([
      [
        '2026-07-09',
        [
          { type: 'feat', description: 'same entry' },
          { type: 'fix', description: 'new entry' },
        ],
      ],
    ]);
    const merged = mergeChangelogGroups(existing, fromGit);
    expect(merged.get('2026-07-09')).toEqual([
      { type: 'feat', description: 'same entry' },
      { type: 'fix', description: 'new entry' },
    ]);
  });
});

describe('renderChangelogGroups', () => {
  it('renders date groups newest-first', () => {
    const merged = new Map([
      ['2026-05-24', [{ type: 'feat', description: 'older' }]],
      ['2026-07-09', [{ type: 'fix', description: 'newer' }]],
    ]);
    const out = renderChangelogGroups(merged);
    expect(out.indexOf('## 2026-07-09')).toBeLessThan(out.indexOf('## 2026-05-24'));
    expect(out).toContain('- **fix:** newer');
  });
});
