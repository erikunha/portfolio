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

  it.each([
    'pr-review-toolkit:review-pr',
    'pr-review-toolkit:code-reviewer',
    'code-reviewer',
  ])('satisfies the code-review role via the %s subagent_type variant', (variant) => {
    const others = BATTERY_ROLES.filter((r) => r.role !== 'code-review').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const withVariant = [...others, agent(variant, AFTER)];
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
    expect(d.write).toBe(false);
    expect(d.missing.sort()).toEqual(ALL_ROLES.filter((r) => r !== 'dependencies').sort());
  });
});

describe('decideStamp — verification-loop (findings) gate', () => {
  const fullBattery = {
    records: batteryAt(AFTER),
    transcriptResolved: true,
    headCommitIso: HEAD_ISO,
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
    const fourOfFive = BATTERY_ROLES.filter((r) => r.role !== 'security').map((r) =>
      agent(r.accepts[0] ?? r.role, AFTER),
    );
    const d = decideStamp({
      records: fourOfFive,
      transcriptResolved: true,
      headCommitIso: HEAD_ISO,
      findings: { present: true, blocking: [], invalid: [] },
    });
    expect(d.write).toBe(false);
    expect(d.missing).toEqual(['security']);
  });
});
