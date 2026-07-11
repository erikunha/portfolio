import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgeVerdict } from '@/lib/eval/types';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));
vi.mock('@/lib/eval/judge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/eval/judge')>()),
  judge: mockJudge,
}));

import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  MIN_CALIBRATION_AGREEMENT,
  runCalibration,
} from '@/lib/eval/calibration';

function gold(id: string, humanVerdict: boolean) {
  return {
    id,
    prompt: `prompt ${id}`,
    expect: `expect ${id}`,
    canonicalAnswer: `answer ${id}`,
    humanVerdict,
  };
}

function verdict(pass: boolean, reason = 'ok'): JudgeVerdict {
  return { pass, reason, inputTokens: 10, outputTokens: 5 };
}

beforeEach(() => {
  mockJudge.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/eval/calibration runCalibration', () => {
  it('pins the gate constants at 0.85 / 0.5', () => {
    expect(MIN_CALIBRATION_AGREEMENT).toBe(0.85);
    expect(CALIBRATION_ERROR_FRACTION_LIMIT).toBe(0.5);
  });

  it('agreement = agreed/total and passes when judge matches every human label', async () => {
    const goldSet = [gold('a', true), gold('b', false), gold('c', true), gold('d', false)];
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false))
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.total).toBe(4);
    expect(r.agreed).toBe(4);
    expect(r.agreement).toBe(1.0);
    expect(r.errored).toBe(0);
    expect(r.passed).toBe(true);
    expect(r.judgeInputTokens).toBe(40);
    expect(r.judgeOutputTokens).toBe(20);
  });

  it('a judge disagreement drops agreement and fails the gate below 0.85', async () => {
    const goldSet = [gold('a', true), gold('b', true), gold('c', true), gold('d', true)];
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false))
      .mockResolvedValueOnce(verdict(false))
      .mockResolvedValueOnce(verdict(true));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.agreed).toBe(2);
    expect(r.agreement).toBe(0.5);
    expect(r.errored).toBe(0);
    expect(r.passed).toBe(false);
  });

  it('counts a judge ERROR as both a disagreement and an errored case', async () => {
    const goldSet = [gold('a', true), gold('b', false)];
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false, 'judge errored after 3 attempts: network blip'));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.errored).toBe(1);
    expect(r.agreed).toBe(1);
    expect(r.agreement).toBe(0.5);
    const erroredCase = r.cases.find((c) => c.id === 'b');
    expect(erroredCase?.errored).toBe(true);
    expect(erroredCase?.agreed).toBe(false);
  });

  it('treats a no-JSON judge response as an errored case', async () => {
    const goldSet = [gold('a', true)];
    mockJudge.mockResolvedValueOnce(verdict(false, 'judge returned no JSON'));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.errored).toBe(1);
    expect(r.cases[0]?.errored).toBe(true);
  });

  it('an outage (errorFraction > 0.5) fails passed and is distinguishable', async () => {
    const goldSet = [gold('a', true), gold('b', false), gold('c', true)];
    mockJudge
      .mockResolvedValueOnce(verdict(false, 'judge errored after 3 attempts: 503'))
      .mockResolvedValueOnce(verdict(false, 'judge returned no JSON'))
      .mockResolvedValueOnce(verdict(true));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.errored).toBe(2);
    expect(r.passed).toBe(false);
    expect(r.errored / r.total).toBeGreaterThan(CALIBRATION_ERROR_FRACTION_LIMIT);
  });
});
