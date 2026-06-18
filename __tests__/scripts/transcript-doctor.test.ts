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

  it('reports all five battery roles', () => {
    const status = summarizeRoles([], HEAD);
    expect(status.map((s) => s.role).sort()).toEqual(
      ['accessibility', 'code-review', 'dependencies', 'performance', 'security'].sort(),
    );
  });
});
