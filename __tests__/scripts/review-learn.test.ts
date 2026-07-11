import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ArchivedFinding,
  type GateProposal,
  proposeGates,
  readArchive,
  selectNewProposals,
} from '@/scripts/review-learn';

const rec = (over: Partial<ArchivedFinding>): ArchivedFinding => ({
  id: 'a',
  severity: 'important',
  title: 'CSP header missing',
  source: 'security-auditor',
  status: 'resolved',
  resolution: 'sha',
  cycleSha: 'c1',
  cycleIso: '2026-06-18T00:00:00Z',
  ...over,
});

describe('proposeGates', () => {
  it('returns nothing for an empty archive', () => {
    expect(proposeGates([], 2)).toEqual([]);
  });

  it('does not propose a class seen in fewer than minCycles distinct cycles', () => {
    expect(proposeGates([rec({ cycleSha: 'c1' })], 2)).toEqual([]);
  });

  it('proposes a class that recurred across >= minCycles distinct cycles', () => {
    const out = proposeGates(
      [rec({ cycleSha: 'c1' }), rec({ cycleSha: 'c2' }), rec({ cycleSha: 'c3' })],
      2,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', cycles: 3, severity: 'important' });
  });

  it('counts distinct cycles, not raw occurrences (same cycle twice = 1)', () => {
    const out = proposeGates([rec({ cycleSha: 'c1' }), rec({ cycleSha: 'c1' })], 2);
    expect(out).toEqual([]);
  });

  it('sorts proposals by recurrence count, descending', () => {
    const recs = [
      rec({ id: 'a', cycleSha: 'c1' }),
      rec({ id: 'a', cycleSha: 'c2' }),
      rec({ id: 'b', title: 'unguarded route', cycleSha: 'c1' }),
      rec({ id: 'b', title: 'unguarded route', cycleSha: 'c2' }),
      rec({ id: 'b', title: 'unguarded route', cycleSha: 'c3' }),
    ];
    const out = proposeGates(recs, 2);
    expect(out.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('selectNewProposals (auto-trigger dedup + cap)', () => {
  const p = (id: string): GateProposal => ({
    id,
    source: 'security-auditor',
    title: 't',
    severity: 'important',
    cycles: 3,
  });

  it('drops proposals whose id is already recorded in the inbox', () => {
    const out = selectNewProposals([p('aaa'), p('bbb')], 'earlier: `aaa` was logged', 5);
    expect(out.map((x) => x.id)).toEqual(['bbb']);
  });

  it('caps how many new proposals are surfaced', () => {
    expect(selectNewProposals([p('a'), p('b'), p('c'), p('d')], '', 2)).toHaveLength(2);
  });

  it('returns all (up to cap) when the inbox is empty', () => {
    expect(selectNewProposals([p('a'), p('b')], '', 5).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('readArchive (tolerant JSONL parsing)', () => {
  it('skips a malformed JSON line instead of throwing, keeping valid records', () => {
    const valid = JSON.stringify(rec({ id: 'ok' }));
    const file = join(tmpdir(), `review-learn-archive-${process.pid}.jsonl`);
    writeFileSync(file, `${valid}\n{ not json\n\n${JSON.stringify({ foo: 1 })}\n`);
    try {
      const out = readArchive(file);
      expect(out).toHaveLength(1);
      expect(out[0]?.id).toBe('ok');
    } finally {
      rmSync(file, { force: true });
    }
  });

  it('returns [] for a non-existent archive path', () => {
    expect(readArchive(join(tmpdir(), `review-learn-missing-${process.pid}.jsonl`))).toEqual([]);
  });
});
