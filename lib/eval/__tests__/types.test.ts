// lib/eval/__tests__/types.test.ts
// Structural test for the shared eval result/judge Zod schemas (lib/eval/types.ts).
//
// These schemas are the load-time contract both eval harnesses (ask-eval and
// the agent-eval harness) validate their calibration result against. The test
// asserts a valid sample parses and an invalid one (agreement out of [0,1]) is
// rejected — drift guard so a malformed shape fails here, not at harness runtime.

import { describe, expect, it } from 'vitest';
import { CalibrationCaseSchema, CalibrationResultSchema } from '@/lib/eval/types';

const validCase = {
  id: 'cal-1',
  humanVerdict: true,
  judgeVerdict: true,
  agreed: true,
  errored: false,
  reason: 'matches',
};

const validResult = {
  cases: [validCase],
  total: 1,
  agreed: 1,
  agreement: 1,
  errored: 0,
  passed: true,
  judgeInputTokens: 10,
  judgeOutputTokens: 5,
};

describe('lib/eval/types', () => {
  it('CalibrationCaseSchema parses a valid case', () => {
    expect(() => CalibrationCaseSchema.parse(validCase)).not.toThrow();
  });

  it('CalibrationCaseSchema rejects a non-boolean humanVerdict', () => {
    expect(() => CalibrationCaseSchema.parse({ ...validCase, humanVerdict: 'yes' })).toThrow();
  });

  it('CalibrationResultSchema parses a valid result', () => {
    expect(() => CalibrationResultSchema.parse(validResult)).not.toThrow();
  });

  it('CalibrationResultSchema rejects agreement out of [0,1]', () => {
    expect(() => CalibrationResultSchema.parse({ ...validResult, agreement: 1.5 })).toThrow();
  });

  it('CalibrationResultSchema rejects a negative token count', () => {
    expect(() => CalibrationResultSchema.parse({ ...validResult, judgeInputTokens: -1 })).toThrow();
  });
});
