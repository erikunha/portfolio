import { describe, expect, it } from 'vitest';
import {
  archiveRecords,
  blockingFindings,
  type Finding,
  findingId,
  invalidResolutions,
  withFinding,
  withStatus,
} from '@/scripts/review-findings';

const f = (over: Partial<Finding>): Finding => ({
  id: 'x',
  severity: 'critical',
  title: 't',
  source: 'security-auditor',
  status: 'open',
  ...over,
});

describe('blockingFindings', () => {
  it('blocks open critical and important', () => {
    const findings = [f({ id: 'a', severity: 'critical' }), f({ id: 'b', severity: 'important' })];
    expect(blockingFindings(findings).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('does not block open minor findings', () => {
    expect(blockingFindings([f({ severity: 'minor' })])).toEqual([]);
  });

  it('does not block once resolved or justified', () => {
    const findings = [
      f({ id: 'a', status: 'resolved', resolution: 'abc123' }),
      f({ id: 'b', status: 'justified', resolution: 'wontfix per ADR' }),
    ];
    expect(blockingFindings(findings)).toEqual([]);
  });
});

describe('invalidResolutions', () => {
  it('flags a resolved/justified finding with no reason', () => {
    const findings = [
      f({ status: 'resolved', resolution: '   ' }),
      f({ id: 'y', status: 'justified' }),
    ];
    expect(invalidResolutions(findings).map((x) => x.id)).toEqual(['x', 'y']);
  });

  it('accepts a resolved finding that cites a reason', () => {
    expect(
      invalidResolutions([f({ status: 'resolved', resolution: 'fixed in deadbeef' })]),
    ).toEqual([]);
  });

  it('never flags an open finding', () => {
    expect(invalidResolutions([f({ status: 'open' })])).toEqual([]);
  });
});

describe('findingId', () => {
  it('is deterministic for the same source+title', () => {
    expect(findingId('security-auditor', 'CSP missing')).toBe(
      findingId('security-auditor', 'CSP missing'),
    );
  });
  it('differs by content', () => {
    expect(findingId('a', 'x')).not.toBe(findingId('a', 'y'));
  });
});

describe('withFinding / withStatus', () => {
  it('appends a new finding and replaces one with the same id', () => {
    const one = withFinding([], f({ id: 'a', title: 'first' }));
    expect(one).toHaveLength(1);
    const replaced = withFinding(one, f({ id: 'a', title: 'updated' }));
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.title).toBe('updated');
  });

  it('updates status + resolution by id', () => {
    const out = withStatus([f({ id: 'a' })], 'a', 'resolved', 'sha999');
    expect(out[0]).toMatchObject({ status: 'resolved', resolution: 'sha999' });
  });

  it('throws when the id is unknown', () => {
    expect(() => withStatus([], 'missing', 'resolved', 'x')).toThrow(/missing/);
  });
});

describe('archiveRecords', () => {
  it('returns empty string for an empty ledger', () => {
    expect(archiveRecords([], 'sha1', '2026-06-17T00:00:00Z')).toBe('');
  });

  it('emits one JSONL line per finding, tagged with the cycle', () => {
    const out = archiveRecords(
      [f({ id: 'a' }), f({ id: 'b' })],
      'deadbeef',
      '2026-06-17T00:00:00Z',
    );
    const lines = out.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0] ?? '{}');
    expect(first).toMatchObject({
      id: 'a',
      cycleSha: 'deadbeef',
      cycleIso: '2026-06-17T00:00:00Z',
    });
  });

  it('terminates with a trailing newline so appends stay line-delimited', () => {
    expect(archiveRecords([f({})], 'sha', 'iso').endsWith('\n')).toBe(true);
  });
});
