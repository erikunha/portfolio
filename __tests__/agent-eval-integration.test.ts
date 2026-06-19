// __tests__/agent-eval-integration.test.ts
// Integration smoke for the agent-eval pipeline. Mocks the `ai` SDK
// generateText at the MODULE BOUNDARY so NO real Gateway call is made, then
// drives the real pipeline pieces (runTarget → gradeRun → aggregateCase, and
// runCalibration) end-to-end. This is the spec §5 acceptance:
//   - the trivial deterministic code case (git-add-scoping) passes 5/5
//     (passAtK=1, passHatK=1, variance=0)
//   - the judge calibration scores known-good PASS / known-bad FAIL →
//     agreement=1.0, passed:true
//   - a WEAKENED target (sometimes emits the banned form) shows passHatK < 1,
//     proving the eval discriminates a flaky prompt from a consistent one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

import { AGENT_EVAL_CALIBRATION, type AgentEvalCalibrationItem } from '@/evals/agents/calibration';
import { loadCases } from '@/evals/agents/load';
import { runCalibration } from '@/lib/eval/calibration';
import { gradeRun } from '@/lib/eval/grade';
import { JUDGE_SYSTEM } from '@/lib/eval/judge';
import { aggregateCase } from '@/lib/eval/montecarlo';
import { runTarget } from '@/lib/eval/run-target';

// Helper: a generateText resolution carrying text + token usage.
function reply(text: string) {
  return { text, usage: { inputTokens: 50, outputTokens: 10 } };
}

beforeEach(() => {
  mockGenerateText.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('agent-eval integration (SDK mocked, no real Gateway call)', () => {
  it('the trivial git-add-scoping code case passes 5/5 with zero variance', async () => {
    // The target always emits a compliant, scoped staging command. A CODE
    // grader never calls the judge, so this exercises only runTarget.
    mockGenerateText.mockImplementation(async () => reply('git add lib/eval/montecarlo.ts'));

    const cases = await loadCases();
    const trivial = cases.find((c) => c.id === 'git-add-scoping');
    expect(trivial).toBeDefined();
    if (!trivial) return;

    const N = 5;
    const runResults: boolean[] = [];
    for (let i = 0; i < N; i++) {
      const target = await runTarget(trivial, { model: 'anthropic/claude-haiku-4-5' });
      const verdict = await gradeRun(trivial, target.output, {
        judgeModel: 'anthropic/claude-sonnet-4-6',
      });
      runResults.push(verdict.pass);
    }
    const stats = aggregateCase(trivial.id, runResults);
    expect(stats.passAtK).toBe(1);
    expect(stats.passHatK).toBe(1);
    expect(stats.variance).toBe(0);
    expect(stats.passes).toBe(5);
    // a code grader must never reach the judge: every SDK call here was a target call
    expect(mockGenerateText).toHaveBeenCalledTimes(5);
  });

  it('a WEAKENED target makes passHatK < 1 (the eval discriminates a flaky prompt)', async () => {
    // The weakened target emits the BANNED broad form on some runs, so the code
    // grader fails those — passAtK stays 1 but passHatK drops below 1.
    const outputs = [
      'git add lib/eval/montecarlo.ts', // compliant
      'git add -A then commit', // banned → fails
      'git add lib/eval/grade.ts', // compliant
      'git add --all', // banned → fails
      'git add lib/eval/budget.ts', // compliant
    ];
    let call = 0;
    mockGenerateText.mockImplementation(async () => {
      // Fall back to a compliant output past the array end (noUncheckedIndexedAccess
      // makes the indexed read string | undefined).
      const out = outputs[call++] ?? 'git add lib/eval/montecarlo.ts';
      return reply(out);
    });

    const cases = await loadCases();
    const trivial = cases.find((c) => c.id === 'git-add-scoping');
    if (!trivial) throw new Error('git-add-scoping case missing');

    const runResults: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const target = await runTarget(trivial, { model: 'm' });
      const verdict = await gradeRun(trivial, target.output, { judgeModel: 'jm' });
      runResults.push(verdict.pass);
    }
    const stats = aggregateCase(trivial.id, runResults);
    expect(stats.passAtK).toBe(1); // at least one compliant run
    expect(stats.passHatK).toBeLessThan(1); // NOT all runs pass → flaky
    expect(stats.variance).toBeGreaterThan(0);
  });

  it('judge calibration scores known-good PASS / known-bad FAIL → agreement 1.0, passed', async () => {
    // Mock the judge to perfectly match every gold label. generateText is the
    // ONLY judge call path; route by the gold case carried in the prompt text.
    // Build a lookup from canonicalAnswer → humanVerdict so the mock returns the
    // label-matching verdict for whichever gold case is being graded.
    const byAnswer = new Map<string, boolean>(
      AGENT_EVAL_CALIBRATION.map((c: AgentEvalCalibrationItem) => [
        c.canonicalAnswer,
        c.humanVerdict,
      ]),
    );
    mockGenerateText.mockImplementation(async (args: { system: string; prompt: string }) => {
      // Calibration always grades through the judge — assert we are on that path.
      expect(args.system).toBe(JUDGE_SYSTEM);
      const matched = [...byAnswer.entries()].find(([ans]) => args.prompt.includes(ans));
      const pass = matched ? matched[1] : false;
      return reply(`{"pass": ${pass}, "reason": "matches the human label"}`);
    });

    const result = await runCalibration(AGENT_EVAL_CALIBRATION, {
      model: 'anthropic/claude-sonnet-4-6',
    });
    expect(result.total).toBe(AGENT_EVAL_CALIBRATION.length);
    expect(result.agreement).toBe(1.0);
    expect(result.errored).toBe(0);
    expect(result.passed).toBe(true);
  });
});
