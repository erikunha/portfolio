// evals/agents/__tests__/load.test.ts
// Behavioral test for the agent-eval corpus loader (evals/agents/load.ts). The
// loader discovers every evals/agents/<id>/CASE.ts, validates each against the
// schema, and returns the array — each entry carrying its source `dir` and,
// for code graders, its `assert`. The runner depends on these invariants.

import { describe, expect, it } from 'vitest';
import { loadCases } from '@/evals/agents/load';
import { AgentEvalCaseSchema } from '@/evals/agents/schema';

describe('evals/agents/load', () => {
  it('returns >= 3 cases, all schema-valid', async () => {
    const cases = await loadCases();
    expect(cases.length).toBeGreaterThanOrEqual(3);
    for (const c of cases) {
      expect(() => AgentEvalCaseSchema.parse(c)).not.toThrow();
    }
  });

  it('every loaded case carries its source dir', async () => {
    const cases = await loadCases();
    for (const c of cases) {
      expect(typeof c.dir).toBe('string');
      expect(c.dir.length).toBeGreaterThan(0);
    }
  });

  it('code-grader cases carry a callable assert', async () => {
    const cases = await loadCases();
    const codeCases = cases.filter((c) => c.grader === 'code');
    expect(codeCases.length).toBeGreaterThanOrEqual(1);
    for (const c of codeCases) {
      expect(typeof c.assert).toBe('function');
    }
  });

  it('ids are unique across the loaded corpus', async () => {
    const cases = await loadCases();
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
