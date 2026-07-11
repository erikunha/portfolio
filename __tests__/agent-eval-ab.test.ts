import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

import { loadCases } from '@/evals/agents/load';
import { selectAbCases } from '@/evals/agents/schema';
import { assertWithinBudget, MAX_JOB_COST_USD } from '@/lib/eval/budget';
import { runAbArms } from '@/scripts/agent-eval';

function reply(text: string) {
  return { text, usage: { inputTokens: 50, outputTokens: 10 } };
}

beforeEach(() => {
  mockGenerateText.mockReset();
});

describe('agent-eval --ab (SDK mocked, no real Gateway call)', () => {
  it('a weakened treatment reports a non-zero negative delta with degraded:true', async () => {
    let treatmentCall = 0;
    mockGenerateText.mockImplementation(async (args: { system: string }) => {
      const isTreatment = !args.system.includes('never `git add');
      if (!isTreatment) {
        return reply('git add lib/eval/ab.ts');
      }
      const i = treatmentCall++;
      return reply(i === 0 ? 'git add lib/eval/ab.ts' : 'git add -A');
    });

    const abCases = selectAbCases(await loadCases()).filter((c) => c.id === 'ab-rule-loadbearing');
    expect(abCases.length).toBe(1);

    const { control, treatment, ab } = await runAbArms(abCases, {
      runs: 5,
      judgeModel: 'anthropic/claude-sonnet-4-6',
    });

    expect(control).toHaveLength(abCases.length);
    expect(treatment).toHaveLength(abCases.length);
    expect(ab.controlMean).toBe(1);
    expect(ab.treatmentMean).toBeLessThan(1);
    expect(ab.deltaMean).toBeLessThan(0);
    expect(ab.degraded).toBe(true);
  });

  it('the doubled-cost cap uses 2 × MAX_JOB_COST_USD', () => {
    const between = MAX_JOB_COST_USD * 1.5;
    expect(assertWithinBudget({ projectedUsd: between, doubled: false }).ok).toBe(false);
    expect(assertWithinBudget({ projectedUsd: between, doubled: true }).ok).toBe(true);

    const overDoubled = MAX_JOB_COST_USD * 2 + 0.01;
    const r = assertWithinBudget({ projectedUsd: overDoubled, doubled: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain(`cap of $${MAX_JOB_COST_USD * 2}`);
    }
  });
});
