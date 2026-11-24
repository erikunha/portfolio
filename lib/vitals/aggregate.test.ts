import { describe, expect, it } from 'vitest';
import { formatVitals, percentile, summarizeVitals } from '@/lib/vitals/aggregate';
import { parseReportArgs } from '@/lib/vitals/report-args';

const record = (value: number, extra: Record<string, unknown> = {}) => ({
  name: 'LCP',
  value,
  route: 'home',
  locale: 'en',
  device: 'mobile',
  release: 'r1',
  ...extra,
});

describe('percentile', () => {
  it('takes the nearest rank', () => {
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3);
    expect(percentile([5], 0.75)).toBe(5);
    expect(percentile([], 0.75)).toBe(0);
  });
});

describe('summarizeVitals', () => {
  it('groups by metric, route, device and release and computes p75 and rating shares', () => {
    const groups = summarizeVitals([
      record(1000),
      record(2000),
      record(3000, { parts: { ttfb: 500, renderDelay: 2000 }, el: 'h1@bio' }),
      record(5000, { parts: { ttfb: 700, renderDelay: 3000 }, el: 'h1@bio' }),
      record(900, { release: 'r2' }),
    ]);

    const r1 = groups.find((group) => group.release === 'r1');
    expect(r1).toMatchObject({ count: 4, p75: 3000, slowCount: 2 });
    expect(r1?.share).toEqual({ good: 0.5, 'needs-improvement': 0.25, poor: 0.25 });
    expect(r1?.slowParts).toEqual({ ttfb: 600, renderDelay: 2500 });
    expect(r1?.topElements).toEqual([{ el: 'h1@bio', count: 2 }]);
    expect(groups.find((group) => group.release === 'r2')?.count).toBe(1);
  });

  it('reads the JSON strings Redis may hand back and skips records it cannot read', () => {
    const groups = summarizeVitals([JSON.stringify(record(100)), '{broken', null, 42, {}]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(1);
  });

  it('prints one block per group with the slow subparts and elements', () => {
    const text = formatVitals(
      summarizeVitals([record(4500, { parts: { ttfb: 100 }, el: 'img@bio' })]),
    );

    expect(text).toContain('LCP home mobile r1 n=1 p75=4500ms');
    expect(text).toContain('ttfb=100ms');
    expect(text).toContain('img@bio x1');
    expect(formatVitals([])).toBe('no records');
  });
});

describe('parseReportArgs', () => {
  const now = new Date('2026-11-24T10:00:00Z');

  it('defaults to the current ISO week', () => {
    expect(parseReportArgs([], now)).toEqual({ ok: true, args: { week: '2026-W48', json: false } });
  });

  it('reads the week, release, route and json flags', () => {
    expect(
      parseReportArgs(['--week', '2026-W47', '--release', 'abc', '--route', 'cv', '--json'], now),
    ).toEqual({
      ok: true,
      args: { week: '2026-W47', release: 'abc', route: 'cv', json: true },
    });
  });

  it.each([
    [['--week', 'last'], '--week'],
    [['--week'], 'needs a value'],
    [['--nope', 'x'], 'unknown argument'],
  ])('refuses %j', (argv, message) => {
    const parsed = parseReportArgs(argv, now);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? '' : parsed.message).toContain(message);
  });
});
