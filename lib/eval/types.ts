// lib/eval/types.ts
//
// Shared eval result + judge types. The /api/ask quality-eval harness
// (scripts/ask-eval.ts) already grades answers through the ONE extracted
// judge() (lib/eval/judge.ts), the load-bearing "one judge prompt" invariant.
// These calibration schemas define the judge-calibration CONTRACT that the
// agent/prompt-eval harness (scripts/agent-eval.ts, added in unit C-b) will
// consume. ask-eval.ts still uses its own local CalibrationResult type for now
// (it carries an extra `kind` field), so unifying the two calibration shapes
// onto these schemas is a deliberate follow-up; the shared judge() already
// guarantees the one-judge-prompt property. Validated by Zod at the boundary so
// a malformed calibration result fails at parse, not deep inside a CI run after
// spending Gateway tokens.

import { z } from 'zod';

// The verdict a single judge() call returns. Token counts ride along so the
// caller can sum judge-side spend without a second usage lookup.
export type JudgeVerdict = {
  pass: boolean;
  reason: string;
  inputTokens: number;
  outputTokens: number;
};

// Per-gold-case calibration outcome. `agreed` is the judge↔human match;
// `errored` distinguishes a judge-API outage (fail-closed disagreement) from a
// genuine model-drift disagreement — the result JSON records both so a human
// can tell drift from outage across runs.
export const CalibrationCaseSchema = z.object({
  id: z.string().min(1),
  humanVerdict: z.boolean(),
  judgeVerdict: z.boolean(),
  agreed: z.boolean(),
  errored: z.boolean(),
  reason: z.string(),
});
export type CalibrationCase = z.infer<typeof CalibrationCaseSchema>;

// The aggregate calibration result. `agreement` is bounded to [0,1] (agreed /
// total); `passed` folds the agreement threshold AND the outage guard.
export const CalibrationResultSchema = z.object({
  cases: z.array(CalibrationCaseSchema),
  total: z.number().int().nonnegative(),
  agreed: z.number().int().nonnegative(),
  agreement: z.number().min(0).max(1),
  errored: z.number().int().nonnegative(),
  passed: z.boolean(),
  judgeInputTokens: z.number().int().nonnegative(),
  judgeOutputTokens: z.number().int().nonnegative(),
});
export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;
