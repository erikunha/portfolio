// lib/eval/calibration.ts
//
// Shared judge-calibration runner, generalized from scripts/ask-eval.ts's
// runCalibration(). Runs each human-labeled gold case through the SAME shared
// judge() used to grade the corpus (passing the gold case's canonicalAnswer as
// the answer), and compares the judge verdict to the human label. A drifted
// judge fails this gate BEFORE the corpus spends Gateway tokens.
//
// The agent-eval harness (scripts/agent-eval.ts, C-b.7) consumes this; the gold
// set is evals/agents/calibration.ts. Per the plan's C-b.3 note this does NOT
// re-point ask-eval.ts's own runCalibration() — that script keeps its local copy
// to avoid a second behavior-touching change on the blocking ai-eval path. The
// load-bearing "one judge prompt" invariant is already held by the shared
// judge() both runners call.

import { JUDGE_ERROR_REASON_PREFIX, JUDGE_NO_JSON_REASON, judge } from '@/lib/eval/judge';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';

// Minimum judge↔human agreement on the gold set. Below this the judge has
// drifted (or the labels are stale) and the corpus grades would be untrustworthy.
export const MIN_CALIBRATION_AGREEMENT = 0.85;

// If MORE than this fraction of gold cases ERRORED (judge API failure) rather
// than genuinely disagreed, the low agreement is an OUTAGE, not drift — the
// caller must report it as such so an API blip is never read as model drift.
export const CALIBRATION_ERROR_FRACTION_LIMIT = 0.5;

// A judge-side FAILURE (retry exhaustion or a malformed/no-JSON response) is an
// outage, NOT a genuine disagreement. The two failure reasons are imported from
// judge.ts (the single source of truth), so a rename there cannot silently
// desync this outage-vs-drift classifier.
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

/**
 * Runs the calibration gold set through the shared judge() and reports per-case
 * agreement plus the aggregate. An errored case counts as BOTH a disagreement
 * (fail-closed) AND an `errored` case, so the caller can tell model drift
 * (genuine disagreements) from a judge-API outage (errors). `passed` folds the
 * agreement threshold AND the outage guard.
 */
export async function runCalibration(
  goldSet: CalibrationGoldCase[],
  opts: { model: string },
): Promise<CalibrationResult> {
  const cases: CalibrationCase[] = [];
  let judgeInputTokens = 0;
  let judgeOutputTokens = 0;

  for (const item of goldSet) {
    // Adapt the gold-case fields onto the shared JudgeItem shape. The gold set
    // is not segmented by kind (it grades platform-prompt answers, not the
    // ask-feature's typed corpus), so a fixed 'calibration' kind is passed.
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
