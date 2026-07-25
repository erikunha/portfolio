import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const REPO_AGENTS = join(process.cwd(), '.claude', 'agents');
const HOME_AGENTS = join(homedir(), '.claude', 'agents');
const MARKETPLACES = join(homedir(), '.claude', 'plugins', 'marketplaces');

function pluginRoots(plugin: string): string[] {
  if (!existsSync(MARKETPLACES)) return [];
  return readdirSync(MARKETPLACES)
    .map((m) => join(MARKETPLACES, m, 'plugins', plugin))
    .filter((p) => existsSync(p));
}

// Agents and plugins install per machine and are not committed, so a CI runner
// cannot observe a host-only name. Decided per entry: a bare name may resolve
// from the repo's own committed agents, which every checkout has.
function canObserve(entry: string): boolean {
  if (entry.includes(':')) return existsSync(MARKETPLACES);
  return existsSync(join(REPO_AGENTS, `${entry}.md`)) || existsSync(HOME_AGENTS);
}

function resolves(entry: string): boolean {
  const [plugin, name] = entry.includes(':') ? entry.split(':') : [null, entry];
  if (plugin === null) {
    return (
      existsSync(join(REPO_AGENTS, `${name}.md`)) || existsSync(join(HOME_AGENTS, `${name}.md`))
    );
  }
  return pluginRoots(plugin).some(
    (root) =>
      existsSync(join(root, 'agents', `${name}.md`)) ||
      existsSync(join(root, 'skills', name, 'SKILL.md')) ||
      existsSync(join(root, 'commands', `${name}.md`)),
  );
}

const ENTRIES = BATTERY_ROLES.flatMap((r) => r.accepts.map((a) => [r.role, a] as const));
const OBSERVABLE = ENTRIES.filter(([, entry]) => canObserve(entry));
const UNOBSERVABLE = ENTRIES.filter(([, entry]) => !canObserve(entry));

describe('BATTERY_ROLES accept-lists', () => {
  it('every role keeps at least one accepted entry', () => {
    for (const role of BATTERY_ROLES) expect(role.accepts.length, role.role).toBeGreaterThan(0);
  });

  it.each(OBSERVABLE)(
    'role %s accepts %s, which resolves to something installed',
    (_role, entry) => {
      expect(
        resolves(entry),
        `${entry} resolves to no installed agent, skill, or command. agentDispatchedAfter requires no result pairing, so dispatching something that cannot run still satisfies the role and the stamp passes. ui-ux-tester, dependency-manager, and bare code-reviewer all stayed dead this way. A plugin-qualified name is checked against the plugin, never trusted for containing a colon.`,
      ).toBe(true);
    },
  );

  if (UNOBSERVABLE.length > 0) {
    it.skip.each(UNOBSERVABLE)(
      'role %s accepts %s, needs host-only install state',
      (_role, entry) => {
        expect(resolves(entry)).toBe(true);
      },
    );
  }
});
