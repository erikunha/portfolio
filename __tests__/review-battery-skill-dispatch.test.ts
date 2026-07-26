import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const SKILL = join(process.cwd(), '.claude', 'skills', 'review-battery', 'SKILL.md');

const DISPATCH_LINE = /`subagent_type:\s*([^`]+)`/g;

const CONDITIONAL_HEADING = '## Conditional reviewers';

function standingRoleSection(source: string): string {
  const cut = source.indexOf(CONDITIONAL_HEADING);
  return cut === -1 ? source : source.slice(0, cut);
}

function dispatchedTypes(): string[] {
  const source = standingRoleSection(readFileSync(SKILL, 'utf8'));
  return [...source.matchAll(DISPATCH_LINE)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
}

const ACCEPTED = new Set(BATTERY_ROLES.flatMap((r) => r.accepts));

describe('review-battery skill dispatches only what the stamp accepts', () => {
  const types = dispatchedTypes();

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
      `Every role in BATTERY_ROLES must have a dispatch line above the "${CONDITIONAL_HEADING}" heading in .claude/skills/review-battery/SKILL.md. A role the stamp requires but the skill never names is unreachable: the operator follows the skill, the stamp refuses, and the hook's remediation text points back at the skill that omitted it.\n\nThis assertion also backstops the it.each above: with zero dispatch lines it.each registers no tests, and only this check goes red.\n\nfound: ${types.join(', ') || '(none)'}`,
    ).toEqual(BATTERY_ROLES.map((r) => r.role).sort());
  });
});
