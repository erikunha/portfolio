import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Group = {
  patterns?: string[];
  'applies-to'?: string;
  'update-types'?: string[];
};
type Update = { 'package-ecosystem': string; groups?: Record<string, Group> };

const PEER_LOCKED_FAMILIES = [
  { group: 'ai-sdk', root: 'ai', scope: '@ai-sdk/' },
  { group: 'vitest', root: 'vitest', scope: '@vitest/' },
] as const;

// behavioral-test-allow: the artifacts under test ARE the Dependabot config and the manifest; neither has a runtime surface in this repository.
const dependabot = parse(
  readFileSync(join(process.cwd(), '.github', 'dependabot.yml'), 'utf8'),
) as { updates: Update[] };
// behavioral-test-allow: same artifact reason as above.
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const npm = dependabot.updates.find((update) => update['package-ecosystem'] === 'npm');
const groups = npm?.groups ?? {};
const groupNames = Object.keys(groups);
const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

function matches(pattern: string, name: string): boolean {
  return pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name;
}

function firstGroupFor(name: string): string | undefined {
  return groupNames.find((groupName) =>
    (groups[groupName]?.patterns ?? []).some((pattern) => matches(pattern, name)),
  );
}

describe('dependabot.yml groups packages that are locked to one version together', () => {
  it('finds the npm ecosystem (anti-vacuous)', () => {
    expect(npm).toBeDefined();
  });

  it.each(PEER_LOCKED_FAMILIES)(
    'the $group group takes version updates of every type, so a major moves the family together',
    ({ group }) => {
      expect(groups[group]?.['applies-to']).toBe('version-updates');
      expect(groups[group]?.['update-types']).toBeUndefined();
    },
  );

  it.each(PEER_LOCKED_FAMILIES)(
    '$root and every declared $scope package land in the $group group',
    ({ group, root, scope }) => {
      const family = declared.filter((name) => name === root || name.startsWith(scope));
      expect(family).toContain(root);
      for (const name of family) expect(firstGroupFor(name)).toBe(group);
    },
  );

  it('lists the peer-locked groups before security, majors and rest, which match everything', () => {
    for (const { group } of PEER_LOCKED_FAMILIES) {
      for (const catchAll of ['security', 'majors', 'rest']) {
        expect(groupNames.indexOf(group)).toBeLessThan(groupNames.indexOf(catchAll));
      }
    }
  });
});
