import { judgeCostUsdFrom, type TargetTier, targetCostUsdFrom } from '@/lib/eval/cost';

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
      `${args.doubled ? 'A/B (doubled) ' : ''}cap of $${cap}: ` +
      'reduce N (EVAL_RUNS) or the corpus size, or split the run',
  };
}

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type SpendMeter = {
  addTarget(tier: TargetTier, usage: TokenUsage): void;
  addJudge(usage: TokenUsage): void;
  readonly spentUsd: number;
  exceeded(): boolean;
};

export function createSpendMeter(capUsd: number): SpendMeter {
  let spentUsd = 0;
  return {
    addTarget(tier, usage) {
      spentUsd += targetCostUsdFrom(tier, usage.inputTokens, usage.outputTokens);
    },
    addJudge(usage) {
      spentUsd += judgeCostUsdFrom(usage.inputTokens, usage.outputTokens);
    },
    get spentUsd() {
      return spentUsd;
    },
    exceeded: () => spentUsd > capUsd,
  };
}
