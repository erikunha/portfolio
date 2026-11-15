import { describe, expect, it } from 'vitest';
import { SHELL_LIMITS, ShellLineKind } from '@/content/shell-ui';
import { bounded, formatRemaining, type Line } from './transcript';

const UNITS = { minutesUnit: 'min', secondsUnit: 's' };

function lines(count: number, startId = 0): Line[] {
  return Array.from({ length: count }, (_, index) => ({
    id: startId + index,
    kind: ShellLineKind.Output,
    text: `line ${startId + index}`,
  }));
}

describe('bounded', () => {
  it.each([
    ['empty', 0],
    ['one line', 1],
    ['one below the cap', SHELL_LIMITS.logEntries - 1],
    ['exactly the cap', SHELL_LIMITS.logEntries],
  ])('keeps every line when %s', (_name, count) => {
    const input = lines(count);
    expect(bounded(input)).toEqual(input);
  });

  it.each([
    ['one over the cap', SHELL_LIMITS.logEntries + 1],
    ['far over the cap', SHELL_LIMITS.logEntries * 3],
  ])('drops the oldest lines when %s', (_name, count) => {
    const result = bounded(lines(count));
    expect(result).toHaveLength(SHELL_LIMITS.logEntries);
    expect(result[0]?.id).toBe(count - SHELL_LIMITS.logEntries);
    expect(result.at(-1)?.id).toBe(count - 1);
  });
});

describe('formatRemaining', () => {
  it.each([
    [0, '0 s'],
    [1, '1 s'],
    [59, '59 s'],
    [60, '1 min'],
    [61, '2 min'],
    [120, '2 min'],
    [121, '3 min'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatRemaining(seconds, UNITS)).toBe(expected);
  });

  it('uses the supplied unit labels', () => {
    const units = { minutesUnit: 'minutos', secondsUnit: 'segundos' };
    expect(formatRemaining(30, units)).toBe('30 segundos');
    expect(formatRemaining(90, units)).toBe('2 minutos');
  });
});
