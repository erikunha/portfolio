import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const MARKETPLACES = join(homedir(), '.claude', 'plugins', 'marketplaces');

function pluginRoots(plugin: string): string[] {
  if (!existsSync(MARKETPLACES)) return [];
  return readdirSync(MARKETPLACES)
    .map((m) => join(MARKETPLACES, m, 'plugins', plugin))
    .filter((p) => existsSync(p));
}

// The accept-list mixes two entry points: bare names are agents, and a
// plugin-qualified name may be either an agent or the skill that orchestrates
// them. Resolving to neither is the dead-name class this guards.
function resolves(agent: string): boolean {
  const [plugin, name] = agent.includes(':') ? agent.split(':') : [null, agent];
  if (plugin === null) {
    return (
      existsSync(join(process.cwd(), '.claude', 'agents', `${name}.md`)) ||
      existsSync(join(homedir(), '.claude', 'agents', `${name}.md`))
    );
  }
  return pluginRoots(plugin).some(
    (root) =>
      existsSync(join(root, 'agents', `${name}.md`)) ||
      existsSync(join(root, 'skills', name, 'SKILL.md')) ||
      existsSync(join(root, 'commands', `${name}.md`)),
  );
}

describe('BATTERY_ROLES accept-lists', () => {
  it.each(BATTERY_ROLES.flatMap((r) => r.accepts.map((a) => [r.role, a] as const)))(
    'role %s accepts %s, which resolves to something installed',
    (_role, agent) => {
      expect(
        resolves(agent),
        `${agent} resolves to no installed agent, skill, or command. A dead name here is worse than a missing one: agentDispatchedAfter requires no result pairing, so dispatching something that cannot run still satisfies the role and the stamp passes. A plugin-qualified name must be checked against the plugin, not trusted for containing a colon.`,
      ).toBe(true);
    },
  );
});
