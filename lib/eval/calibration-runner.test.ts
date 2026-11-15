import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgeVerdict } from '@/lib/eval/types';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));
vi.mock('@/lib/eval/judge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/eval/judge')>()),
  judge: mockJudge,
}));

import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  describeCalibrationFailure,
  MIN_CALIBRATION_AGREEMENT,
  MIN_CALIBRATION_TNR,
  runCalibration,
  summarizeCalibration,
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

  it('pins the true-negative gate at 11 of 12', () => {
    expect(MIN_CALIBRATION_TNR).toBe(11 / 12);
  });

  it('reports the true-positive and true-negative rates', async () => {
    const goldSet = [gold('a', true), gold('b', true), gold('c', false), gold('d', false)];
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false))
      .mockResolvedValueOnce(verdict(false))
      .mockResolvedValueOnce(verdict(false));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r).toMatchObject({
      positives: 2,
      negatives: 2,
      truePositives: 1,
      trueNegatives: 2,
      tpr: 0.5,
      tnr: 1,
    });
  });

  it('fails a lenient judge that clears raw agreement by passing wrong answers', async () => {
    const goldSet = [
      ...Array.from({ length: 12 }, (_, i) => gold(`p${i}`, true)),
      ...Array.from({ length: 12 }, (_, i) => gold(`n${i}`, false)),
    ];
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(true));
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(i < 3));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.agreement).toBeGreaterThanOrEqual(MIN_CALIBRATION_AGREEMENT);
    expect(r.tnr).toBe(0.75);
    expect(r.tnrPassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('lets one false pass in twelve negatives through', async () => {
    const goldSet = [
      ...Array.from({ length: 12 }, (_, i) => gold(`p${i}`, true)),
      ...Array.from({ length: 12 }, (_, i) => gold(`n${i}`, false)),
    ];
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(true));
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(i === 0));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.tnrPassed).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('scales the allowance with the negatives: two false passes in sixteen fail', async () => {
    const goldSet = [
      ...Array.from({ length: 14 }, (_, i) => gold(`p${i}`, true)),
      ...Array.from({ length: 16 }, (_, i) => gold(`n${i}`, false)),
    ];
    for (let i = 0; i < 14; i++) mockJudge.mockResolvedValueOnce(verdict(true));
    for (let i = 0; i < 16; i++) mockJudge.mockResolvedValueOnce(verdict(i < 2));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.agreement).toBeGreaterThanOrEqual(MIN_CALIBRATION_AGREEMENT);
    expect(r.tnr).toBe(0.875);
    expect(r.passed).toBe(false);
  });

  it('does not count an errored negative as a true negative', async () => {
    const goldSet = [gold('p', true), gold('n', false)];
    mockJudge
      .mockResolvedValueOnce(verdict(true))
      .mockResolvedValueOnce(verdict(false, 'judge returned no JSON'));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(r.trueNegatives).toBe(0);
    expect(r.tnr).toBe(0);
  });

  it('cannot pass without a single negative gold case', async () => {
    mockJudge.mockResolvedValue(verdict(true));
    const r = await runCalibration([gold('a', true), gold('b', true)], { model: 'm' });
    expect(r.negatives).toBe(0);
    expect(r.tnrPassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('names the true-negative rate, not only agreement, when a lenient judge fails the gate', async () => {
    const goldSet = [
      ...Array.from({ length: 12 }, (_, i) => gold(`p${i}`, true)),
      ...Array.from({ length: 12 }, (_, i) => gold(`n${i}`, false)),
    ];
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(true));
    for (let i = 0; i < 12; i++) mockJudge.mockResolvedValueOnce(verdict(i < 3));
    const r = await runCalibration(goldSet, { model: 'm' });
    expect(describeCalibrationFailure(r)).toContain('true-negative rate 75.0%');
    expect(describeCalibrationFailure(r)).not.toContain('agreement');
    expect(summarizeCalibration(r)).toMatchObject({
      tpr: 1,
      tnr: 0.75,
      minTnr: MIN_CALIBRATION_TNR,
      tnrPassed: false,
      agreementPassed: true,
      passed: false,
    });
  });
});
