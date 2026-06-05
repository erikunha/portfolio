import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES, decideStamp } from '@/scripts/review-stamp';

// The battery boundary is the HEAD commit's ISO timestamp. Dispatches must be
// STRICTLY AFTER it. Tests place agent records before/after a fixed HEAD time.
const HEAD_ISO = '2026-06-04T12:00:00Z';
const AFTER = '2026-06-04T12:00:01Z'; // after HEAD -> counts
const BEFORE = '2026-06-04T11:59:59Z'; // before HEAD -> stale, does NOT count

/** Build an Agent-dispatch record for the given subagent_type at a timestamp. */
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

/** One dispatch per role at the given timestamp, using each role's first variant. */
function batteryAt(iso: string) {
  return BATTERY_ROLES.map((r) => agent(r.accepts[0] ?? r.role, iso));
}

const ALL_ROLES = BATTERY_ROLES.map((r) => r.role);

describe('decideStamp', () => {
  it('writes the stamp when every role was dispatched after HEAD', () => {
    const d = decideStamp({
      records: batteryAt(AFTER),
      transcriptResolved: true,
      headCommitIso: HEAD_ISO,
    });
    expect(d.write, JSON.stringify(d)).toBe(true);
    expect(d.missing).toEqual([]);
  });

  it('satisfies the code-review role via EITHER accepted subagent_type variant', () => {
    const others = BATTERY_ROLES.filter((r) => r.role !== 'code-review').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const withVariant = [...others, agent('pr-review-toolkit:code-reviewer', AFTER)];
    const d = decideStamp({
      records: withVariant,
      transcriptResolved: true,
      headCommitIso: HEAD_ISO,
    });
    expect(d.write, JSON.stringify(d)).toBe(true);
  });

  it('refuses and names the missing ROLE when only four of five ran', () => {
    const present = BATTERY_ROLES.filter((r) => r.role !== 'dependencies').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const d = decideStamp({ records: present, transcriptResolved: true, headCommitIso: HEAD_ISO });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['dependencies']);
  });

  it('refuses fail-closed when the transcript could not be resolved', () => {
    const d = decideStamp({ records: [], transcriptResolved: false, headCommitIso: HEAD_ISO });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(ALL_ROLES);
    expect(d.reason).toMatch(/transcript/i);
  });

  it('does NOT count dispatches from BEFORE HEAD (stale prior-cycle review)', () => {
    // A full battery, but all dispatched BEFORE the HEAD commit — e.g. a commit
    // made in the terminal after an earlier review. None may satisfy the battery.
    const d = decideStamp({
      records: batteryAt(BEFORE),
      transcriptResolved: true,
      headCommitIso: HEAD_ISO,
    });
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual([...ALL_ROLES].sort());
  });

  it('mixes stale + fresh: only roles dispatched AFTER HEAD count', () => {
    const stale = BATTERY_ROLES.filter((r) => r.role !== 'dependencies').map((r) =>
      agent(r.accepts[0] ?? r.role, BEFORE),
    );
    const fresh = [agent('dependency-manager', AFTER)];
    const d = decideStamp({
      records: [...stale, ...fresh],
      transcriptResolved: true,
      headCommitIso: HEAD_ISO,
    });
    // Only the dependencies role was dispatched after HEAD; the other four are stale.
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual(ALL_ROLES.filter((r) => r !== 'dependencies').sort());
  });
});
