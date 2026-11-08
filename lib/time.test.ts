import { describe, expect, it } from 'vitest';
import {
  HOURS_PER_DAY,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  pad2,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from './time';

describe('time constants', () => {
  it('compose into the physical units they name', () => {
    expect(MS_PER_SECOND).toBe(1000);
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(SECONDS_PER_HOUR).toBe(SECONDS_PER_MINUTE * MINUTES_PER_HOUR);
    expect(MINUTES_PER_DAY).toBe(HOURS_PER_DAY * MINUTES_PER_HOUR);
    expect(MINUTES_PER_DAY).toBe(1440);
  });
});

describe('pad2', () => {
  it.each<[number | string, string]>([
    [0, '00'],
    [7, '07'],
    [10, '10'],
    [59, '59'],
    [123, '123'],
    ['5', '05'],
  ])('formats %i as %s', (value, expected) => {
    expect(pad2(value)).toBe(expected);
  });
});
