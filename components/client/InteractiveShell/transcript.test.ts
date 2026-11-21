import { describe, expect, it } from 'vitest';
import { SHELL_LIMITS, ShellLineKind } from '@/content/shell-ui';
import { appendLines, bounded, formatRemaining, type Line } from './transcript';

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

describe('appendLines', () => {
  const extra = lines(3, 1000);

  it('returns the existing lines unchanged when nothing is added', () => {
    const input = lines(2);
    expect(appendLines(input)).toEqual(input);
  });

  it('appends a single line after the existing ones', () => {
    const input = lines(2);
    expect(appendLines(input, extra[0] as Line).map((line) => line.id)).toEqual([0, 1, 1000]);
  });

  it('appends several lines in the order given', () => {
    expect(appendLines(lines(1), ...extra).map((line) => line.id)).toEqual([0, 1000, 1001, 1002]);
  });

  it('keeps the newest lines when the result crosses the cap', () => {
    const result = appendLines(lines(SHELL_LIMITS.logEntries - 1), ...extra);
    expect(result).toHaveLength(SHELL_LIMITS.logEntries);
    expect(result[0]?.id).toBe(2);
    expect(result.slice(-3).map((line) => line.id)).toEqual([1000, 1001, 1002]);
  });

  it('does not mutate the input array', () => {
    const input = lines(SHELL_LIMITS.logEntries);
    const snapshot = [...input];
    appendLines(input, ...extra);
    expect(input).toEqual(snapshot);
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

describe('Line kinds', () => {
  it('lets each kind carry only its own fields', () => {
    const valid: Line[] = [
      { id: 1, kind: ShellLineKind.Output, text: 'a', ai: true, lang: 'en' },
      { id: 2, kind: ShellLineKind.Error, text: 'b', prefix: 'stderr', retry: 'ask', lang: 'en' },
      { id: 3, kind: ShellLineKind.Info, text: 'c', welcome: true },
      { id: 4, kind: ShellLineKind.RateLimit, text: 'd', retryAfter: 30 },
    ];
    const outputWithRetryAfter: Line = {
      id: 5,
      kind: ShellLineKind.Output,
      text: 'e',
      // @ts-expect-error retryAfter belongs to a rate limit line
      retryAfter: 3,
    };
    // @ts-expect-error ai belongs to an output line
    const errorWithAi: Line = { id: 6, kind: ShellLineKind.Error, text: 'f', ai: true };
    // @ts-expect-error a prompt line carries no prefix
    const promptWithPrefix: Line = { id: 8, kind: ShellLineKind.Prompt, text: 'h', prefix: 'x' };
    expect([valid.length, outputWithRetryAfter, errorWithAi, promptWithPrefix]).toHaveLength(4);
  });
});
