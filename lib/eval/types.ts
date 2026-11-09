import { z } from 'zod';

export type JudgeVerdict = {
  pass: boolean;
  reason: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export const CalibrationCaseSchema = z.object({
  id: z.string().min(1),
  kind: z.string().optional(),
  humanVerdict: z.boolean(),
  judgeVerdict: z.boolean(),
  agreed: z.boolean(),
  errored: z.boolean(),
  reason: z.string(),
});
export type CalibrationCase = z.infer<typeof CalibrationCaseSchema>;

export const CalibrationResultSchema = z.object({
  cases: z.array(CalibrationCaseSchema),
  total: z.number().int().nonnegative(),
  agreed: z.number().int().nonnegative(),
  agreement: z.number().min(0).max(1),
  positives: z.number().int().nonnegative(),
  negatives: z.number().int().nonnegative(),
  truePositives: z.number().int().nonnegative(),
  trueNegatives: z.number().int().nonnegative(),
  tpr: z.number().min(0).max(1),
  tnr: z.number().min(0).max(1),
  agreementPassed: z.boolean(),
  tnrPassed: z.boolean(),
  errored: z.number().int().nonnegative(),
  passed: z.boolean(),
  judgeInputTokens: z.number().int().nonnegative(),
  judgeOutputTokens: z.number().int().nonnegative(),
  judgeCacheReadTokens: z.number().int().nonnegative().default(0),
  judgeCacheWriteTokens: z.number().int().nonnegative().default(0),
});
export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;
