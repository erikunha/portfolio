import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const HOME_AGENTS = join(homedir(), '.claude', 'agents');
const MARKETPLACES = join(homedir(), '.claude', 'plugins', 'marketplaces');

// Agents and plugins are installed per machine, not committed here, so a CI
// runner genuinely cannot answer "does this name resolve". That is a third
// state, not a failure: reporting it as missing would make the gate cry wolf
// on every CI run and train the bypass it exists to prevent. Absent the
// install roots the check abstains; present, it asserts.
const CAN_OBSERVE_INSTALLS = existsSync(HOME_AGENTS) || existsSync(MARKETPLACES);

function pluginRoots(plugin: string): string[] {
  if (!existsSync(MARKETPLACES)) return [];
  return readdirSync(MARKETPLACES)
    .map((m) => join(MARKETPLACES, m, 'plugins', plugin))
    .filter((p) => existsSync(p));
}

// The accept-list mixes entry points: a bare name is an agent, a qualified one
// may be an agent or the skill/command that orchestrates them. Resolving to
// none of those is the dead-name class this guards.
function resolves(entry: string): boolean {
  const [plugin, name] = entry.includes(':') ? entry.split(':') : [null, entry];
  if (plugin === null) {
    return (
      existsSync(join(process.cwd(), '.claude', 'agents', `${name}.md`)) ||
      existsSync(join(HOME_AGENTS, `${name}.md`))
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

describe('BATTERY_ROLES accept-lists', () => {
  it('every role has at least one accepted entry, which needs no install to check', () => {
    for (const role of BATTERY_ROLES) expect(role.accepts.length, role.role).toBeGreaterThan(0);
  });

  it.skipIf(!CAN_OBSERVE_INSTALLS).each(ENTRIES)(
    'role %s accepts %s, which resolves to something installed',
    (_role, entry) => {
      expect(
        resolves(entry),
        `${entry} resolves to no installed agent, skill, or command. A dead name here is worse than a missing one: agentDispatchedAfter requires no result pairing, so dispatching something that cannot run still satisfies the role and the stamp passes. That is how ui-ux-tester, dependency-manager, and bare code-reviewer all stayed dead. A plugin-qualified name must be checked against the plugin, never trusted for containing a colon.`,
      ).toBe(true);
    },
  );
});
