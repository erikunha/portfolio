import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES, decideStamp } from '@/scripts/review-stamp';

/** Build a minimal Agent-dispatch record for the given subagent_type. */
function agent(subagentType: string, index: number) {
  return {
    type: 'assistant',
    timestamp: `2026-06-04T00:00:0${index}.000Z`,
    uuid: `u-${subagentType}-${index}`,
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: subagentType } }],
    },
  };
}

/** One dispatch per role, using each role's FIRST accepted subagent_type. */
function fullBattery() {
  return BATTERY_ROLES.map((r, i) => agent(r.accepts[0] ?? r.role, i));
}

const ALL_ROLES = BATTERY_ROLES.map((r) => r.role);

describe('decideStamp', () => {
  it('writes the stamp when every battery role was satisfied this cycle', () => {
    const d = decideStamp({ records: fullBattery(), transcriptResolved: true });
    expect(d.write).toBe(true);
    expect(d.missing).toEqual([]);
  });

  it('satisfies the code-review role via EITHER accepted subagent_type variant', () => {
    // The reviewer is dispatched as `pr-review-toolkit:code-reviewer` in practice
    // (not the skill name `pr-review-toolkit:review-pr`). Both must satisfy the role.
    const others = BATTERY_ROLES.filter((r) => r.role !== 'code-review').map((r, i) =>
      agent(r.accepts[0] ?? r.role, i),
    );
    const withCodeReviewerVariant = [...others, agent('pr-review-toolkit:code-reviewer', 9)];
    const d = decideStamp({ records: withCodeReviewerVariant, transcriptResolved: true });
    expect(d.write, JSON.stringify(d)).toBe(true);
  });

  it('refuses and names the missing ROLE when only four of five ran', () => {
    const present = BATTERY_ROLES.filter((r) => r.role !== 'dependencies').map((r, i) =>
      agent(r.accepts[0] ?? r.role, i),
    );
    const d = decideStamp({ records: present, transcriptResolved: true });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['dependencies']);
  });

  it('refuses fail-closed when the transcript could not be resolved', () => {
    const d = decideStamp({ records: [], transcriptResolved: false });
    expect(d.write).toBe(false);
    // Fail-closed: every role reported missing so the reason is explicit.
    expect(d.missing).toEqual(ALL_ROLES);
    expect(d.reason).toMatch(/transcript/i);
  });

  it('scopes the battery to dispatches AFTER the last commit', () => {
    // 4 roles pre-commit, then a commit, then only 1 role post-commit.
    const preCommit = BATTERY_ROLES.filter((r) => r.role !== 'dependencies').map((r, i) =>
      agent(r.accepts[0] ?? r.role, i),
    );
    const commit = {
      type: 'assistant',
      timestamp: '2026-06-04T00:00:05.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'git commit -m "x"' } }],
      },
    };
    const postCommit = [agent('dependency-manager', 6)];
    const records = [...preCommit, commit, ...postCommit];
    const d = decideStamp({ records, transcriptResolved: true });
    // Only the dependencies role ran after the commit; the other four are stale.
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual(ALL_ROLES.filter((r) => r !== 'dependencies').sort());
  });
});
