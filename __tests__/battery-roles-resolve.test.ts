import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const PLUGIN_QUALIFIED = /:/;

function resolves(agent: string): boolean {
  if (PLUGIN_QUALIFIED.test(agent)) return true;
  return (
    existsSync(join(process.cwd(), '.claude', 'agents', `${agent}.md`)) ||
    existsSync(join(homedir(), '.claude', 'agents', `${agent}.md`))
  );
}

describe('BATTERY_ROLES accept-lists', () => {
  it.each(BATTERY_ROLES.flatMap((r) => r.accepts.map((a) => [r.role, a] as const)))(
    'role %s accepts %s, which resolves to an installed agent',
    (_role, agent) => {
      expect(
        resolves(agent),
        `${agent} resolves to no installed agent. A dead name in this accept-list is worse than a missing one: agentDispatchedAfter requires no result pairing, so dispatching an agent that cannot run still satisfies the role and the stamp passes. This is how ui-ux-tester stayed dead for months.`,
      ).toBe(true);
    },
  );
});
