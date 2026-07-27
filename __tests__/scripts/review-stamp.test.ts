import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES, decideStamp } from '@/scripts/review-stamp';

const HEAD_ISO = '2026-06-04T12:00:00Z';
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

function batteryAt(iso: string) {
  return BATTERY_ROLES.map((r) => agent(r.accepts[0] ?? r.role, iso));
}

const ALL_ROLES = BATTERY_ROLES.map((r) => r.role);

function roleAccepts(role: string): readonly string[] {
  const found = BATTERY_ROLES.find((r) => r.role === role);
  if (!found) {
    throw new Error(
      `BATTERY_ROLES has no role "${role}". A silent [] here would make it.each register ZERO tests and the file would still pass — which is how a role rename loses its assertions without a single red run.`,
    );
  }
  return found.accepts;
}

describe('decideStamp', () => {
  it('writes the stamp when every role was dispatched after HEAD', () => {
    const d = decideStamp({
      records: batteryAt(AFTER),
      transcriptResolved: true,
      baseCommitIso: HEAD_ISO,
    });
    expect(d.write, JSON.stringify(d)).toBe(true);
    expect(d.missing).toEqual([]);
  });

  it.each(roleAccepts('correctness'))(
    'satisfies the correctness role via the %s subagent_type variant',
    (variant) => {
      const others = BATTERY_ROLES.filter((r) => r.role !== 'correctness').map((r) =>
        agent(r.accepts[0] ?? r.role, AFTER),
      );
      const withVariant = [...others, agent(variant, AFTER)];
      const d = decideStamp({
        records: withVariant,
        transcriptResolved: true,
        baseCommitIso: HEAD_ISO,
      });
      expect(d.write, JSON.stringify(d)).toBe(true);
    },
  );

  it('refuses and names the missing ROLE when one role never ran', () => {
    const present = BATTERY_ROLES.filter((r) => r.role !== 'test-strength').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const d = decideStamp({ records: present, transcriptResolved: true, baseCommitIso: HEAD_ISO });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['test-strength']);
  });

  it('refuses fail-closed when the transcript could not be resolved', () => {
    const d = decideStamp({ records: [], transcriptResolved: false, baseCommitIso: HEAD_ISO });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(ALL_ROLES);
    expect(d.reason).toMatch(/transcript/i);
  });

  it('does NOT count dispatches from BEFORE HEAD (stale prior-cycle review)', () => {
    const d = decideStamp({
      records: batteryAt(BEFORE),
      transcriptResolved: true,
      baseCommitIso: HEAD_ISO,
    });
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual([...ALL_ROLES].sort());
  });

  it('mixes stale + fresh: only roles dispatched AFTER HEAD count', () => {
    const stale = BATTERY_ROLES.filter((r) => r.role !== 'test-strength').map((r) =>
      agent(r.accepts[0] ?? r.role, BEFORE),
    );
    const testStrengthAccepts = roleAccepts('test-strength');
    const fresh = [agent(testStrengthAccepts[testStrengthAccepts.length - 1] as string, AFTER)];
    const d = decideStamp({
      records: [...stale, ...fresh],
      transcriptResolved: true,
      baseCommitIso: HEAD_ISO,
    });
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual(ALL_ROLES.filter((r) => r !== 'test-strength').sort());
  });
});

describe('decideStamp — verification-loop (findings) gate', () => {
  const fullBattery = {
    records: batteryAt(AFTER),
    transcriptResolved: true,
    baseCommitIso: HEAD_ISO,
  };

  it('writes when the battery ran AND the ledger has no open/invalid findings', () => {
    const d = decideStamp({
      ...fullBattery,
      findings: { present: true, blocking: [], invalid: [] },
    });
    expect(d.write, JSON.stringify(d)).toBe(true);
  });

  it('refuses when no findings ledger exists even though the battery ran', () => {
    const d = decideStamp({
      ...fullBattery,
      findings: { present: false, blocking: [], invalid: [] },
    });
    expect(d.write).toBe(false);
    expect(d.reason).toMatch(/ledger/i);
  });

  it('refuses when an open Critical/Important finding remains', () => {
    const d = decideStamp({
      ...fullBattery,
      findings: { present: true, blocking: ['a1 CSP missing'], invalid: [] },
    });
    expect(d.write).toBe(false);
    expect(d.reason).toMatch(/open Critical\/Important/i);
  });

  it('refuses when a resolved finding cites no reason', () => {
    const d = decideStamp({
      ...fullBattery,
      findings: { present: true, blocking: [], invalid: ['b2 unguarded route'] },
    });
    expect(d.write).toBe(false);
    expect(d.reason).toMatch(/missing a reason/i);
  });

  it('still enforces dispatch first: an incomplete battery refuses regardless of findings', () => {
    const allButOne = BATTERY_ROLES.filter((r) => r.role !== 'gate-robustness').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const d = decideStamp({
      records: allButOne,
      transcriptResolved: true,
      baseCommitIso: HEAD_ISO,
      findings: { present: true, blocking: [], invalid: [] },
    });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['gate-robustness']);
  });
});

describe('decideStamp anchors freshness to the branch base, not to HEAD', () => {
  // The regression this pins: anchoring to HEAD meant every fix commit
  // invalidated the battery that found the thing being fixed, so a branch could
  // never converge without re-running all four agents per round — which
  // contradicts CLAUDE.md's run-it-ONCE rule and cost 8 needless Opus dispatches
  // on the branch that produced this test.
  const BASE_ISO = '2026-07-26T10:00:00.000Z';
  const clean = { present: true, blocking: [], invalid: [] };

  it('accepts a battery dispatched mid-branch even though later fix commits exist', () => {
    const d = decideStamp({
      records: batteryAt('2026-07-26T11:00:00.000Z'),
      transcriptResolved: true,
      baseCommitIso: BASE_ISO,
      findings: clean,
    });
    expect(d.write).toBe(true);
  });

  it('still refuses a battery that predates the branch entirely', () => {
    const d = decideStamp({
      records: batteryAt('2026-07-26T09:00:00.000Z'),
      transcriptResolved: true,
      baseCommitIso: BASE_ISO,
      findings: clean,
    });
    expect(d.write).toBe(false);
    expect(d.missing.length).toBe(BATTERY_ROLES.length);
  });

  it('still refuses while a blocking finding is open, whatever the anchor', () => {
    const d = decideStamp({
      records: batteryAt('2026-07-26T11:00:00.000Z'),
      transcriptResolved: true,
      baseCommitIso: BASE_ISO,
      findings: { present: true, blocking: ['abc123 something real'], invalid: [] },
    });
    expect(d.write).toBe(false);
  });
});
