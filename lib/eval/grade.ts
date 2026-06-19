// lib/eval/grade.ts
//
// Grading dispatch for one target output in the agent-eval harness
// (scripts/agent-eval.ts, C-b.7). Dispatches on case.grader:
//   - 'code'  → the case's pure assert(output) predicate. Deterministic and
//               FREE: zero judge tokens, no Gateway call. This is why the
//               trivial git-add-scoping case can run N times within the cost cap.
//   - 'judge' → the shared judge() (lib/eval/judge.ts), with the case mapped onto
//               the JudgeItem shape and the tiered judge model.
// Both paths return the same JudgeVerdict shape so the Monte-Carlo loop treats
// every run uniformly. A code grader with no assert is a CONFIG error (the
// loader/schema should have caught it), surfaced loudly rather than silently
// passing.

import type { LoadedCase } from '@/evals/agents/load';
import { judge } from '@/lib/eval/judge';
import type { JudgeVerdict } from '@/lib/eval/types';

export async function gradeRun(
  c: LoadedCase,
  output: string,
  opts: { judgeModel: string },
): Promise<JudgeVerdict> {
  if (c.grader === 'code') {
    if (typeof c.assert !== 'function') {
      throw new Error(
        `case "${c.id}": grader is 'code' but no assert predicate is attached — cannot grade deterministically`,
      );
    }
    const pass = c.assert(output);
    // Code grading is free; report a fixed reason and zero judge spend so the
    // cost aggregation never attributes Gateway tokens to a deterministic case.
    return {
      pass,
      reason: pass ? 'code assertion passed' : 'code assertion failed',
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  // Judge path: adapt the case fields onto the shared JudgeItem shape. `kind`
  // carries the case tier so the judge prompt's KIND line reflects whether this
  // is a mechanical or judgment case.
  return judge({ id: c.id, question: c.prompt, kind: c.tier, expect: c.expect }, output, {
    model: opts.judgeModel,
  });
}
