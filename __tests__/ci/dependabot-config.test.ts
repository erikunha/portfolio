import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const MINUTES_PER_DAY = 24 * 60;

type Group = {
  patterns?: string[];
  'applies-to'?: string;
  'update-types'?: string[];
};
type Update = {
  'package-ecosystem': string;
  cooldown?: { 'default-days'?: number };
  groups?: Record<string, Group>;
};

// behavioral-test-allow: the artifacts under test ARE the Dependabot config and the pnpm settings file; neither has a runtime surface in this repository.
const dependabot = parse(
  readFileSync(join(process.cwd(), '.github', 'dependabot.yml'), 'utf8'),
) as { updates: Update[] };
// behavioral-test-allow: same artifact reason as above.
const workspace = parse(readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8')) as {
  minimumReleaseAge: number;
};

const releaseAgeDays = workspace.minimumReleaseAge / MINUTES_PER_DAY;

const ecosystems = dependabot.updates.map((update) => ({
  ecosystem: update['package-ecosystem'],
  update,
}));

describe('dependabot.yml and the install-time release-age window', () => {
  it.each(ecosystems)(
    '$ecosystem waits at least as long as pnpm minimumReleaseAge before opening a version update',
    ({ update }) => {
      expect(update.cooldown?.['default-days']).toBeGreaterThanOrEqual(releaseAgeDays);
    },
  );

  it.each(ecosystems)(
    '$ecosystem splits its updates into security, majors and rest groups',
    ({ update }) => {
      const groups = update.groups ?? {};
      const security = Object.values(groups).filter((g) => g['applies-to'] === 'security-updates');
      const majors = Object.values(groups).filter((g) => g['update-types']?.includes('major'));
      const rest = Object.values(groups).filter(
        (g) => g['update-types']?.includes('minor') && g['update-types'].includes('patch'),
      );
      expect(security).toHaveLength(1);
      expect(majors).toHaveLength(1);
      expect(rest).toHaveLength(1);
      expect(Object.keys(groups).sort()).toEqual(['majors', 'rest', 'security']);
    },
  );

  it.each(ecosystems)(
    '$ecosystem keeps a major out of the group that merges unreviewed minors',
    ({ update }) => {
      const rest = update.groups?.rest;
      expect(rest?.['update-types']).not.toContain('major');
    },
  );
});
