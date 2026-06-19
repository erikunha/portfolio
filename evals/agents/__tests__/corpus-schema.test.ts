// evals/agents/__tests__/corpus-schema.test.ts
// Structural test for the agent-eval corpus case schema (evals/agents/schema.ts).
// A case is the unit the Monte-Carlo runner loads N times: a task `prompt`, the
// `target` prompt/rule under test, a `tier` (→ model assignment), a `grader`,
// the `expect` criterion, and a `knownHard` anti-saturation flag. The code
// grader's `assert` lives NEXT TO the case (not serializable into Zod), so the
// code↔assert pairing is enforced by validateAgentEvalCase, not the bare schema.

import { describe, expect, it } from 'vitest';
import { AgentEvalCaseSchema, validateAgentEvalCase } from '@/evals/agents/schema';

const validCase = {
  id: 'git-add-scoping',
  prompt: 'Stage your changes.',
  target: {
    name: 'CLAUDE.md:no-broad-git-add',
    systemText: 'Never use `git add .` — stage only the files you changed.',
  },
  tier: 'mechanical' as const,
  grader: 'code' as const,
  expect: 'Output does not contain a broad git add.',
  knownHard: false,
};

describe('evals/agents/schema', () => {
  it('parses a valid case', () => {
    expect(() => AgentEvalCaseSchema.parse(validCase)).not.toThrow();
  });

  it('rejects an empty prompt', () => {
    expect(() => AgentEvalCaseSchema.parse({ ...validCase, prompt: '' })).toThrow();
  });

  it('rejects a kind/tier outside the enum', () => {
    expect(() => AgentEvalCaseSchema.parse({ ...validCase, tier: 'wizardry' })).toThrow();
    expect(() => AgentEvalCaseSchema.parse({ ...validCase, grader: 'vibes' })).toThrow();
  });

  it('defaults knownHard to false when omitted', () => {
    const { knownHard: _omit, ...withoutFlag } = validCase;
    const parsed = AgentEvalCaseSchema.parse(withoutFlag);
    expect(parsed.knownHard).toBe(false);
  });

  it('validateAgentEvalCase rejects a code-grader case missing its assert', () => {
    expect(() => validateAgentEvalCase(validCase /* grader:'code', no assert */)).toThrow(
      /code grader/i,
    );
  });

  it('validateAgentEvalCase accepts a code-grader case that supplies an assert', () => {
    const out = validateAgentEvalCase(validCase, (o: string) => !o.includes('git add .'));
    expect(out.grader).toBe('code');
    expect(typeof out.assert).toBe('function');
  });

  it('validateAgentEvalCase accepts a judge-grader case without an assert', () => {
    const judgeCase = { ...validCase, id: 'j1', grader: 'judge' as const };
    const out = validateAgentEvalCase(judgeCase);
    expect(out.grader).toBe('judge');
    expect(out.assert).toBeUndefined();
  });
});
