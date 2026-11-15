import { type BudgetStore, setBudgetStore } from '@/lib/ask/budget';
import { askReservationCost } from '@/lib/ask/input-reservation';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';

export { setBudgetStore };

export function createEvalBudgetStore(requests: number): BudgetStore {
  const used = new Map<string, number>();
  const capacity = requests * askReservationCost(ASK_MAX_OUTPUT_TOKENS);
  return {
    capacity,
    dailyCapacity: capacity,
    async reserve(budgetKey, tokens) {
      const total = (used.get(budgetKey) ?? 0) + tokens;
      used.set(budgetKey, total);
      return total;
    },
    async release(budgetKey, tokens) {
      used.set(budgetKey, (used.get(budgetKey) ?? 0) - tokens);
    },
    chargeOverage: async () => undefined,
  };
}
