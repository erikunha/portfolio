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
    return {
      pass,
      reason: pass ? 'code assertion passed' : 'code assertion failed',
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  return judge({ id: c.id, question: c.prompt, kind: c.tier, expect: c.expect }, output, {
    model: opts.judgeModel,
  });
}
