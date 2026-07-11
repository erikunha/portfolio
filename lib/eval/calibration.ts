import { JUDGE_ERROR_REASON_PREFIX, JUDGE_NO_JSON_REASON, judge } from '@/lib/eval/judge';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';

export const MIN_CALIBRATION_AGREEMENT = 0.85;

export const CALIBRATION_ERROR_FRACTION_LIMIT = 0.5;

function isJudgeError(reason: string): boolean {
  return reason.startsWith(JUDGE_ERROR_REASON_PREFIX) || reason === JUDGE_NO_JSON_REASON;
}

export type CalibrationGoldCase = {
  id: string;
  prompt: string;
  expect: string;
  canonicalAnswer: string;
  humanVerdict: boolean;
};

export async function runCalibration(
  goldSet: CalibrationGoldCase[],
  opts: { model: string },
): Promise<CalibrationResult> {
  const cases: CalibrationCase[] = [];
  let judgeInputTokens = 0;
  let judgeOutputTokens = 0;

  for (const item of goldSet) {
    const verdict = await judge(
      { id: item.id, question: item.prompt, kind: 'calibration', expect: item.expect },
      item.canonicalAnswer,
      { model: opts.model },
    );
    judgeInputTokens += verdict.inputTokens;
    judgeOutputTokens += verdict.outputTokens;

    const errored = isJudgeError(verdict.reason);
    const agreed = !errored && verdict.pass === item.humanVerdict;
    cases.push({
      id: item.id,
      humanVerdict: item.humanVerdict,
      judgeVerdict: verdict.pass,
      agreed,
      errored,
      reason: verdict.reason,
    });
  }

  const total = cases.length;
  const agreed = cases.filter((c) => c.agreed).length;
  const errored = cases.filter((c) => c.errored).length;
  const agreement = total > 0 ? agreed / total : 0;
  const errorFraction = total > 0 ? errored / total : 0;
  const calibrationOutage = errorFraction > CALIBRATION_ERROR_FRACTION_LIMIT;
  const passed = agreement >= MIN_CALIBRATION_AGREEMENT && !calibrationOutage;

  return {
    cases,
    total,
    agreed,
    agreement: Number(agreement.toFixed(4)),
    errored,
    passed,
    judgeInputTokens,
    judgeOutputTokens,
  };
}
