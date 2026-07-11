import { z } from 'zod';

export type JudgeVerdict = {
  pass: boolean;
  reason: string;
  inputTokens: number;
  outputTokens: number;
};

export const CalibrationCaseSchema = z.object({
  id: z.string().min(1),
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
  errored: z.number().int().nonnegative(),
  passed: z.boolean(),
  judgeInputTokens: z.number().int().nonnegative(),
  judgeOutputTokens: z.number().int().nonnegative(),
});
export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;
