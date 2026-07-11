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
    expect(() => validateAgentEvalCase(validCase)).toThrow(/code grader/i);
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
