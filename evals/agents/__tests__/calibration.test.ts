// evals/agents/__tests__/calibration.test.ts
// Structural test for the agent-eval judge-calibration gold set
// (evals/agents/calibration.ts), mirroring __tests__/ask-eval-calibration.test.ts:
//   - the gold set Zod-parses (the module parses at import; a violation throws)
//   - >=6 cases
//   - >=1 positive (humanVerdict true) AND >=1 negative (humanVerdict false)
//   - every id is unique
// These guard the gate's discriminating power: a gold set with no negative case
// cannot catch a judge that rubber-stamps.

import { describe, expect, it } from 'vitest';
import { AGENT_EVAL_CALIBRATION, AgentEvalCalibrationItemSchema } from '@/evals/agents/calibration';

describe('evals/agents/calibration gold set', () => {
  it('every item re-parses against the schema', () => {
    for (const item of AGENT_EVAL_CALIBRATION) {
      expect(() => AgentEvalCalibrationItemSchema.parse(item)).not.toThrow();
    }
  });

  it('has at least 6 gold cases', () => {
    expect(AGENT_EVAL_CALIBRATION.length).toBeGreaterThanOrEqual(6);
  });

  it('contains at least one positive AND one negative human verdict', () => {
    const positives = AGENT_EVAL_CALIBRATION.filter((c) => c.humanVerdict === true);
    const negatives = AGENT_EVAL_CALIBRATION.filter((c) => c.humanVerdict === false);
    expect(positives.length).toBeGreaterThanOrEqual(1);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
  });

  it('has unique ids', () => {
    const ids = AGENT_EVAL_CALIBRATION.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
