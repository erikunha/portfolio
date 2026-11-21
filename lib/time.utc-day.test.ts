import { describe, expect, it } from 'vitest';
import { utcDay } from '@/lib/time';

describe('utcDay', () => {
  it.each([
    ['just after UTC midnight', '2026-11-06T00:00:00.001Z', '2026-11-06'],
    ['midday', '2026-11-06T12:00:00.000Z', '2026-11-06'],
    ['just before UTC midnight', '2026-11-06T23:59:59.999Z', '2026-11-06'],
    [
      'a late evening instant west of UTC, already the next UTC day',
      '2026-11-06T23:30:00-05:00',
      '2026-11-07',
    ],
  ])('returns the UTC calendar day, %s', (_label, iso, expected) => {
    expect(utcDay(new Date(iso))).toBe(expected);
  });

  it('has the YYYY-MM-DD shape', () => {
    expect(utcDay(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
