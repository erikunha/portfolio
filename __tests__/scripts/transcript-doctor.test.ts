import { describe, expect, it } from 'vitest';
import { summarizeRoles } from '@/scripts/transcript-doctor';

const HEAD = '2026-06-04T12:00:00Z';
const AFTER = '2026-06-04T12:00:01Z';
const BEFORE = '2026-06-04T11:59:59Z';

function agent(subagentType: string, iso: string) {
  return {
    type: 'assistant',
    timestamp: iso,
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: subagentType } }],
    },
  };
}

describe('summarizeRoles', () => {
  it('marks a role detected when an accepted agent ran after HEAD', () => {
    const status = summarizeRoles([agent('security-auditor', AFTER)], HEAD);
    expect(status.find((s) => s.role === 'security')?.detected).toBe(true);
    expect(status.find((s) => s.role === 'performance')?.detected).toBe(false);
  });

  it('does not mark a role detected for a stale (pre-HEAD) dispatch', () => {
    const status = summarizeRoles([agent('security-auditor', BEFORE)], HEAD);
    expect(status.find((s) => s.role === 'security')?.detected).toBe(false);
  });

  it('reports every battery role, so a role cannot vanish from the doctor silently', () => {
    const status = summarizeRoles([], HEAD);
    expect(
      status.map((s) => s.role).sort(),
      'the doctor must report exactly the roles review-stamp.ts requires. The accessibility role was dropped on 2026-07-16 because accessibility-tester no longer exists in any registry, which made the stamp unsatisfiable and blocked every push (see DECISIONS.md). If that agent returns, add the role back HERE and in BATTERY_ROLES together — a doctor that reports a role the stamp does not check, or vice versa, is worse than either.',
    ).toEqual(['code-review', 'dependencies', 'performance', 'security'].sort());
  });
});
