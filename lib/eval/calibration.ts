import { isJudgeError, judge } from '@/lib/eval/judge';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';

export const MIN_CALIBRATION_AGREEMENT = 0.85;

export const MIN_CALIBRATION_TNR = 11 / 12;

const RATE_DECIMALS = 4;

export const CALIBRATION_ERROR_FRACTION_LIMIT = 0.5;

export type CalibrationGoldCase = {
  id: string;
  kind?: string;
  prompt: string;
  expect: string;
  canonicalAnswer: string;
  humanVerdict: boolean;
};

export async function runCalibration(
  goldSet: CalibrationGoldCase[],
  opts: { model: string; factSheet?: string },
): Promise<CalibrationResult> {
  const cases: CalibrationCase[] = [];
  let judgeInputTokens = 0;
  let judgeOutputTokens = 0;
  let judgeCacheReadTokens = 0;
  let judgeCacheWriteTokens = 0;

  for (const item of goldSet) {
    const verdict = await judge(
      { id: item.id, question: item.prompt, kind: item.kind ?? 'calibration', expect: item.expect },
      item.canonicalAnswer,
      opts,
    );
    judgeInputTokens += verdict.inputTokens;
    judgeOutputTokens += verdict.outputTokens;
    judgeCacheReadTokens += verdict.cacheReadTokens ?? 0;
    judgeCacheWriteTokens += verdict.cacheWriteTokens ?? 0;

    const errored = isJudgeError(verdict.reason);
    const agreed = !errored && verdict.pass === item.humanVerdict;
    cases.push({
      id: item.id,
      ...(item.kind === undefined ? {} : { kind: item.kind }),
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
  const positiveCases = cases.filter((c) => c.humanVerdict);
  const negativeCases = cases.filter((c) => !c.humanVerdict);
  const truePositives = positiveCases.filter((c) => c.agreed).length;
  const trueNegatives = negativeCases.filter((c) => c.agreed).length;
  const tpr = positiveCases.length > 0 ? truePositives / positiveCases.length : 0;
  const tnr = negativeCases.length > 0 ? trueNegatives / negativeCases.length : 0;
  const agreementPassed = agreement >= MIN_CALIBRATION_AGREEMENT;
  const tnrPassed = negativeCases.length > 0 && tnr >= MIN_CALIBRATION_TNR;
  const passed = agreementPassed && tnrPassed && !calibrationOutage;

  return {
    cases,
    total,
    agreed,
    agreement: Number(agreement.toFixed(RATE_DECIMALS)),
    positives: positiveCases.length,
    negatives: negativeCases.length,
    truePositives,
    trueNegatives,
    tpr: Number(tpr.toFixed(RATE_DECIMALS)),
    tnr: Number(tnr.toFixed(RATE_DECIMALS)),
    agreementPassed,
    tnrPassed,
    errored,
    passed,
    judgeInputTokens,
    judgeOutputTokens,
    judgeCacheReadTokens,
    judgeCacheWriteTokens,
  };
}

export function summarizeCalibration(result: CalibrationResult) {
  return {
    total: result.total,
    agreed: result.agreed,
    agreement: result.agreement,
    passed: result.passed,
    minAgreement: MIN_CALIBRATION_AGREEMENT,
    agreementPassed: result.agreementPassed,
    positives: result.positives,
    negatives: result.negatives,
    tpr: result.tpr,
    tnr: result.tnr,
    minTnr: MIN_CALIBRATION_TNR,
    tnrPassed: result.tnrPassed,
    errored: result.errored,
  };
}

export function describeCalibrationFailure(result: CalibrationResult): string {
  const reasons: string[] = [];
  if (!result.agreementPassed) {
    reasons.push(
      `agreement ${(result.agreement * 100).toFixed(1)}% (min ${(MIN_CALIBRATION_AGREEMENT * 100).toFixed(1)}%)`,
    );
  }
  if (!result.tnrPassed) {
    reasons.push(
      `true-negative rate ${(result.tnr * 100).toFixed(1)}% over ${result.negatives} negative gold cases ` +
        `(min ${(MIN_CALIBRATION_TNR * 100).toFixed(1)}%): the judge passes answers a human failed`,
    );
  }
  return reasons.join('; ');
}
