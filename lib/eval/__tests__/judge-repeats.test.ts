import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgeVerdict } from '@/lib/eval/types';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));
vi.mock('@/lib/eval/judge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/eval/judge')>()),
  judge: mockJudge,
}));

import { runCalibration } from '@/lib/eval/calibration';
import { JUDGE_NO_JSON_REASON } from '@/lib/eval/judge';
import {
  judgeRepeated,
  MAX_JUDGE_REPEATS,
  parseJudgeRepeats,
  verdictSequence,
} from '@/lib/eval/judge-repeats';
import { summarizeCalibrationStability } from '@/lib/eval/judge-stability';

function verdict(pass: boolean, reason = 'ok'): JudgeVerdict {
  return { pass, reason, inputTokens: 10, outputTokens: 5 };
}

function scriptedJudge(script: Record<string, boolean[]>) {
  const calls = new Map<string, number>();
  mockJudge.mockImplementation(async (item: { id: string }) => {
    const index = calls.get(item.id) ?? 0;
    calls.set(item.id, index + 1);
    const sequence = script[item.id] ?? [true];
    return verdict(sequence[Math.min(index, sequence.length - 1)] ?? true);
  });
}

function gold(id: string, humanVerdict: boolean) {
  return {
    id,
    prompt: `prompt ${id}`,
    expect: `expect ${id}`,
    canonicalAnswer: `answer ${id}`,
    humanVerdict,
  };
}

beforeEach(() => {
  mockJudge.mockReset();
});

describe('parseJudgeRepeats', () => {
  it.each([
    [[], 1],
    [['--other', 'x'], 1],
    [['--judge-repeats', '1'], 1],
    [['--judge-repeats', '5'], 5],
    [['--judge-repeats=5'], 5],
    [['--judge-repeats', String(MAX_JUDGE_REPEATS)], MAX_JUDGE_REPEATS],
    [['--x', '--judge-repeats', '3', '--y'], 3],
  ])('reads %j as %i', (argv, expected) => {
    expect(parseJudgeRepeats(argv)).toBe(expected);
  });

  it.each([
    ['0'],
    ['-1'],
    [String(MAX_JUDGE_REPEATS + 1)],
    ['2.5'],
    ['abc'],
    [''],
    ['5x'],
    [' 5'],
    ['1e1'],
  ])('rejects the value %j with a message naming the flag and the range', (value) => {
    expect(() => parseJudgeRepeats(['--judge-repeats', value])).toThrow(
      new RegExp(`--judge-repeats.*1 to ${MAX_JUDGE_REPEATS}`),
    );
  });

  it('rejects a flag with no value', () => {
    expect(() => parseJudgeRepeats(['--judge-repeats'])).toThrow(/--judge-repeats.*1 to/);
    expect(() => parseJudgeRepeats(['--judge-repeats', '--other'])).toThrow(/--judge-repeats/);
    expect(() => parseJudgeRepeats(['--judge-repeats='])).toThrow(/--judge-repeats/);
  });
});

describe('verdictSequence', () => {
  it('maps a pass, a fail and an errored judge call', () => {
    expect(
      verdictSequence([verdict(true), verdict(false), verdict(false, JUDGE_NO_JSON_REASON)]),
    ).toEqual([true, false, null]);
  });
});

describe('judgeRepeated', () => {
  const item = { id: 'i', question: 'q', kind: 'factual', expect: 'e' };
  const opts = { model: 'm', factSheet: 'sheet' };

  it('calls the judge once for k=1, with the arguments unchanged', async () => {
    mockJudge.mockResolvedValue(verdict(true));
    const out = await judgeRepeated(item, 'answer', opts, 1);
    expect(out).toHaveLength(1);
    expect(mockJudge).toHaveBeenCalledTimes(1);
    expect(mockJudge).toHaveBeenCalledWith(item, 'answer', opts);
  });

  it('calls the judge k times on the same answer and returns the first verdict first', async () => {
    mockJudge
      .mockResolvedValueOnce(verdict(true, 'first'))
      .mockResolvedValueOnce(verdict(false, 'second'))
      .mockResolvedValueOnce(verdict(true, 'third'));
    const out = await judgeRepeated(item, 'answer', opts, 3);
    expect(out.map((v) => v.reason)).toEqual(['first', 'second', 'third']);
    expect(mockJudge).toHaveBeenCalledTimes(3);
    for (const call of mockJudge.mock.calls) expect(call).toEqual([item, 'answer', opts]);
  });

  it('warms the prompt cache with the first call before it starts the others', async () => {
    const order: string[] = [];
    mockJudge.mockImplementation(async () => {
      order.push('start');
      await Promise.resolve();
      order.push('end');
      return verdict(true);
    });
    await judgeRepeated(item, 'answer', opts, 3);
    expect(order.slice(0, 2)).toEqual(['start', 'end']);
  });
});

describe('runCalibration with judge repeats', () => {
  it('k=1 keeps the old shape: one call per case, no repeat verdicts', async () => {
    scriptedJudge({});
    const result = await runCalibration([gold('a', true), gold('b', false)], { model: 'm' });
    expect(mockJudge).toHaveBeenCalledTimes(2);
    expect(mockJudge.mock.calls[0]?.[2]).toEqual({ model: 'm' });
    for (const c of result.cases) expect(c).not.toHaveProperty('repeatVerdicts');
    expect(result.judgeInputTokens).toBe(20);
  });

  it('judges each gold case k times and sums every call into the judge tokens', async () => {
    scriptedJudge({});
    const result = await runCalibration([gold('a', true), gold('b', true)], {
      model: 'm',
      repeats: 5,
    });
    expect(mockJudge).toHaveBeenCalledTimes(10);
    expect(result.judgeInputTokens).toBe(100);
    expect(result.judgeOutputTokens).toBe(50);
    expect(result.cases.map((c) => c.repeatVerdicts)).toEqual([
      [true, true, true, true, true],
      [true, true, true, true, true],
    ]);
  });

  it('gates on repeat 1 alone, so later flips never change the calibration verdict', async () => {
    scriptedJudge({ a: [true, false, false], b: [false, true, true] });
    const result = await runCalibration([gold('a', true), gold('b', false)], {
      model: 'm',
      repeats: 3,
    });
    expect(result.agreed).toBe(2);
    expect(result.passed).toBe(true);
    expect(result.cases.map((c) => c.agreed)).toEqual([true, true]);
    expect(result.cases.map((c) => c.judgeVerdict)).toEqual([true, false]);
  });

  it('the stability of a scripted flaky judge counts the flip and the human agreement', async () => {
    scriptedJudge({ a: [true, true, true], b: [false, true, false], c: [true, true, true] });
    const goldSet = [gold('a', true), gold('b', false), gold('c', true)];
    const result = await runCalibration(goldSet, { model: 'm', repeats: 3 });
    const stability = summarizeCalibrationStability(
      result.cases.map((c) => ({
        id: c.id,
        verdicts: c.repeatVerdicts ?? [],
        humanVerdict: c.humanVerdict,
      })),
      3,
    );
    expect(stability.flipping).toEqual([{ id: 'b', verdicts: [false, true, false] }]);
    expect(stability.agreeAllRepeats).toBe(2);
    expect(stability.flipRate.value).toBeCloseTo(1 / 3, 4);
  });

  it('records an errored repeat as null and does not count the case as agreeing in every repeat', async () => {
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false, JUDGE_NO_JSON_REASON));
    const result = await runCalibration([gold('a', true)], { model: 'm', repeats: 2 });
    expect(result.cases[0]?.repeatVerdicts).toEqual([true, null]);
    expect(result.cases[0]?.errored).toBe(false);
    expect(result.cases[0]?.agreed).toBe(true);
  });
});
