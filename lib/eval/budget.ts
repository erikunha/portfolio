// lib/eval/budget.ts
//
// Pre-flight cost-ceiling check for the agent-eval harness
// (scripts/agent-eval.ts, C-b.7). The runner computes a PROJECTED cost with
// estimateJobCostUsd (lib/eval/cost.ts) and calls assertWithinBudget BEFORE the
// first model call — a job whose projection exceeds the cap aborts without
// spending a token. A bounded eval is the whole point of N<=5 + a ~20-case
// corpus; this is the hard backstop if those bounds are mis-set.
//
// A/B mode runs TWO arms (control + treatment), so its effective cap is doubled
// (2 × MAX_JOB_COST_USD). C-c's --ab path passes doubled:true.

export const MAX_JOB_COST_USD = 2.0;

export function assertWithinBudget(args: {
  projectedUsd: number;
  doubled: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const cap = args.doubled ? MAX_JOB_COST_USD * 2 : MAX_JOB_COST_USD;
  // Boundary inclusive: a projection exactly at the cap is allowed — the cap is
  // the ceiling, not an exclusive bound.
  if (args.projectedUsd <= cap) {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      `projected cost $${args.projectedUsd} exceeds the ` +
      `${args.doubled ? 'A/B (doubled) ' : ''}cap of $${cap} — ` +
      'reduce N (EVAL_RUNS) or the corpus size, or split the run',
  };
}
