import { describe, expect, it } from 'vitest';
import { BATTERY, decideStamp } from '@/scripts/review-stamp';

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

describe('decideStamp', () => {
  it('writes the stamp when all five battery agents were dispatched this cycle', () => {
    const records = BATTERY.map((a, i) => agent(a, i));
    const d = decideStamp({ records, transcriptResolved: true });
    expect(d.write).toBe(true);
    expect(d.missing).toEqual([]);
  });

  it('refuses and names the missing agent when only four of five ran', () => {
    const present = BATTERY.filter((a) => a !== 'dependency-manager');
    const records = present.map((a, i) => agent(a, i));
    const d = decideStamp({ records, transcriptResolved: true });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['dependency-manager']);
  });

  it('refuses fail-closed when the transcript could not be resolved', () => {
    const d = decideStamp({ records: [], transcriptResolved: false });
    expect(d.write).toBe(false);
    // Fail-closed: every battery agent reported missing so the reason is explicit.
    expect(d.missing).toEqual([...BATTERY]);
    expect(d.reason).toMatch(/transcript/i);
  });

  it('scopes the battery to dispatches AFTER the last commit', () => {
    // 4 agents pre-commit, then a commit, then only 1 agent post-commit.
    const preCommit = BATTERY.filter((a) => a !== 'dependency-manager').map((a, i) => agent(a, i));
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
    // Only dependency-manager ran after the commit; the other four are stale.
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual(BATTERY.filter((a) => a !== 'dependency-manager').sort());
  });
});
