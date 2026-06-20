// evals/agents/__tests__/ab-variant.test.ts
// Unit test for the A/B case-variant schema extension (evals/agents/schema.ts,
// C-c.2). An A/B case carries optional `control.systemText` + `treatment.systemText`
// variants on top of the base case. selectAbCases() filters a mixed corpus down
// to only the cases that declare BOTH arms; a case missing the treatment (or
// control) variant is excluded from --ab mode, never silently run single-armed.

import { describe, expect, it } from 'vitest';
import { AgentEvalCaseSchema, selectAbCases, validateAgentEvalCase } from '@/evals/agents/schema';

// A base (non-A/B) case: no control/treatment variants.
const baseCase = {
  id: 'plain',
  prompt: 'do a thing',
  target: { name: 'CLAUDE.md:plain', systemText: 'the rule under test' },
  tier: 'mechanical' as const,
  grader: 'judge' as const,
  expect: 'does the thing',
  knownHard: false,
};

// An A/B case: declares both arms.
const abCase = {
  id: 'ab',
  prompt: 'do a thing',
  target: { name: 'CLAUDE.md:ab', systemText: 'the full rule (control)' },
  control: { systemText: 'the full rule (control)' },
  treatment: { systemText: 'the rule with one clause pruned' },
  tier: 'judgment' as const,
  grader: 'judge' as const,
  expect: 'does the thing',
  knownHard: false,
};

describe('evals/agents/schema A/B variants', () => {
  it('a case carrying control.systemText and treatment.systemText parses', () => {
    const parsed = AgentEvalCaseSchema.parse(abCase);
    expect(parsed.control?.systemText).toBe('the full rule (control)');
    expect(parsed.treatment?.systemText).toBe('the rule with one clause pruned');
  });

  it('a base case without A/B variants still parses (optional, no regression)', () => {
    const parsed = AgentEvalCaseSchema.parse(baseCase);
    expect(parsed.control).toBeUndefined();
    expect(parsed.treatment).toBeUndefined();
  });

  it('an A/B variant with an empty systemText is rejected', () => {
    expect(() => AgentEvalCaseSchema.parse({ ...abCase, treatment: { systemText: '' } })).toThrow();
  });

  it('selectAbCases returns only cases declaring BOTH arms', () => {
    const both = selectAbCases([validateAgentEvalCase(baseCase), validateAgentEvalCase(abCase)]);
    expect(both.map((c) => c.id)).toEqual(['ab']);
  });

  it('selectAbCases rejects a case missing the treatment variant', () => {
    const { treatment: _omitted, ...controlOnly } = abCase;
    const selected = selectAbCases([validateAgentEvalCase(controlOnly)]);
    expect(selected).toHaveLength(0);
  });

  it('selectAbCases rejects a case missing the control variant', () => {
    const { control: _omitted, ...treatmentOnly } = abCase;
    const selected = selectAbCases([validateAgentEvalCase(treatmentOnly)]);
    expect(selected).toHaveLength(0);
  });
});
