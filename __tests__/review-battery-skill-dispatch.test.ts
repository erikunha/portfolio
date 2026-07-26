import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const SKILL = join(process.cwd(), '.claude', 'skills', 'review-battery', 'SKILL.md');

const DISPATCH_LINE = /`subagent_type:\s*([^`]+)`/g;

function dispatchedTypes(): string[] {
  const source = readFileSync(SKILL, 'utf8');
  return [...source.matchAll(DISPATCH_LINE)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
}

const ACCEPTED = new Set(BATTERY_ROLES.flatMap((r) => r.accepts));

describe('review-battery skill dispatches only what the stamp accepts', () => {
  const types = dispatchedTypes();

  it('names at least one subagent_type per battery role', () => {
    expect(
      types.length,
      `.claude/skills/review-battery/SKILL.md declares ${types.length} \`subagent_type:\` lines but BATTERY_ROLES has ${BATTERY_ROLES.length} roles. The skill is the operative dispatch instruction (CLAUDE.md routes the whole battery through it) and BATTERY_ROLES is the gate that scores it; a role with no dispatch line is a role nobody is told to run.`,
    ).toBeGreaterThanOrEqual(BATTERY_ROLES.length);
  });

  it.each(dispatchedTypes())('%s is an accepted subagent_type for some role', (type) => {
    expect(
      ACCEPTED.has(type),
      `The skill tells the agent to dispatch \`${type}\`, which no BATTERY_ROLES accept-list contains, so \`pnpm review:stamp\` refuses on a missing role and .husky/pre-push blocks every push.\n\nThis exact defect shipped on 2026-07-25: the skill said \`general-purpose\` while claim-drift accepted only \`documentation-engineer\`, and nothing coupled the two files, so the whole suite stayed green.\n\nFix the SKILL.md line, not this accept-list — widening accepts to match a wrong dispatch line is the fail-open direction, because the stamp matches subagent_type alone and cannot see what an agent was asked to do.\n\naccepted: ${[...ACCEPTED].sort().join(', ')}`,
    ).toBe(true);
  });

  it('covers every role, so a role cannot be silently undispatched', () => {
    const covered = BATTERY_ROLES.filter((r) => r.accepts.some((a) => types.includes(a))).map(
      (r) => r.role,
    );
    expect(
      covered.sort(),
      'Every role in BATTERY_ROLES must have a dispatch line in the skill. A role the stamp requires but the skill never names is unreachable: the operator follows the skill, the stamp refuses, and the remediation text points back at the skill that omitted it.',
    ).toEqual(BATTERY_ROLES.map((r) => r.role).sort());
  });
});
