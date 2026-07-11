export const MAX_JOB_COST_USD = 2.0;

export function assertWithinBudget(args: {
  projectedUsd: number;
  doubled: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const cap = args.doubled ? MAX_JOB_COST_USD * 2 : MAX_JOB_COST_USD;
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
