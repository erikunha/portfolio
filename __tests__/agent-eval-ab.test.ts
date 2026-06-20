// __tests__/agent-eval-ab.test.ts
// Spec §5 acceptance for A/B mode (C-c.3). Mocks the `ai` SDK generateText at
// the MODULE BOUNDARY so NO real Gateway call is made, then drives the runner's
// A/B seam (runAbArms) over a deliberately WEAKENED treatment: the control arm
// always emits a compliant scoped staging command, the treatment arm (the
// pruned-rule variant) sometimes emits the BANNED broad form. The code grader
// then fails those treatment runs, so:
//   - the A/B delta is NON-ZERO and NEGATIVE (treatment worse than control)
//   - degraded is true (the pruned clause was load-bearing)
// It also asserts the doubled-cost pre-flight uses 2 × MAX_JOB_COST_USD: a
// projection that fits under the doubled cap but would bust the single cap is
// allowed in --ab mode and rejected without it.

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
  // The `ai` module mock (vi.mock above) persists across tests; mockReset clears
  // its impl/calls between tests. vi.restoreAllMocks() would NOT undo a module
  // mock, so there is deliberately no afterEach here.
  mockGenerateText.mockReset();
});

describe('agent-eval --ab (SDK mocked, no real Gateway call)', () => {
  it('a weakened treatment reports a non-zero negative delta with degraded:true', async () => {
    // Route by system text: the control arm (full rule) always complies; the
    // treatment arm (pruned rule) emits the banned broad form on most runs.
    let treatmentCall = 0;
    mockGenerateText.mockImplementation(async (args: { system: string }) => {
      const isTreatment = !args.system.includes('never `git add');
      if (!isTreatment) {
        return reply('git add lib/eval/ab.ts'); // control: always compliant
      }
      // Treatment: 4 of 5 runs emit a banned form → fails the code grader.
      const i = treatmentCall++;
      return reply(i === 0 ? 'git add lib/eval/ab.ts' : 'git add -A');
    });

    // Scope to the git-add A/B fixture this mock is written for: the mock routes by
    // the git-add rule text and emits `git add ...` responses. Other A/B cases (e.g.
    // ab-consumer-scan-ci-config) also use grader 'code' but a DIFFERENT assert
    // predicate, which the git-add responses do not satisfy, so this mock must not
    // drive them.
    const abCases = selectAbCases(await loadCases()).filter((c) => c.id === 'ab-rule-loadbearing');
    expect(abCases.length).toBe(1);

    const { control, treatment, ab } = await runAbArms(abCases, {
      runs: 5,
      judgeModel: 'anthropic/claude-sonnet-4-6',
    });

    expect(control).toHaveLength(abCases.length);
    expect(treatment).toHaveLength(abCases.length);
    // Control always complied → mean 1.0; treatment failed most runs → mean < 1.
    expect(ab.controlMean).toBe(1);
    expect(ab.treatmentMean).toBeLessThan(1);
    expect(ab.deltaMean).toBeLessThan(0); // non-zero NEGATIVE delta
    expect(ab.degraded).toBe(true); // the pruned clause was load-bearing
  });

  it('the doubled-cost cap uses 2 × MAX_JOB_COST_USD', () => {
    // A projection between the single cap and the doubled cap: rejected in
    // single-arm mode, allowed in --ab mode.
    const between = MAX_JOB_COST_USD * 1.5;
    expect(assertWithinBudget({ projectedUsd: between, doubled: false }).ok).toBe(false);
    expect(assertWithinBudget({ projectedUsd: between, doubled: true }).ok).toBe(true);

    // Over the doubled cap → rejected even in --ab mode, with the doubled cap named.
    const overDoubled = MAX_JOB_COST_USD * 2 + 0.01;
    const r = assertWithinBudget({ projectedUsd: overDoubled, doubled: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Assert the CAP clause specifically ("cap of $4"). A bare "$4" would also
      // be satisfied by the projection "$4.01" in the same string, so it would
      // never actually test the cap value.
      expect(r.reason).toContain(`cap of $${MAX_JOB_COST_USD * 2}`);
    }
  });
});
