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

function reply(text: string) {
  return { text, usage: { inputTokens: 50, outputTokens: 10 } };
}

beforeEach(() => {
  mockGenerateText.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agent-eval integration (SDK mocked, no real Gateway call)', () => {
  it('the trivial git-add-scoping code case passes 5/5 with zero variance', async () => {
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
    expect(mockGenerateText).toHaveBeenCalledTimes(5);
  });

  it('a WEAKENED target makes passHatK < 1 (the eval discriminates a flaky prompt)', async () => {
    const outputs = [
      'git add lib/eval/montecarlo.ts',
      'git add -A then commit',
      'git add lib/eval/grade.ts',
      'git add --all',
      'git add lib/eval/budget.ts',
    ];
    let call = 0;
    mockGenerateText.mockImplementation(async () => {
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
    expect(stats.passAtK).toBe(1);
    expect(stats.passHatK).toBeLessThan(1);
    expect(stats.variance).toBeGreaterThan(0);
  });

  it('judge calibration scores known-good PASS / known-bad FAIL → agreement 1.0, passed', async () => {
    const byAnswer = new Map<string, boolean>(
      AGENT_EVAL_CALIBRATION.map((c: AgentEvalCalibrationItem) => [
        c.canonicalAnswer,
        c.humanVerdict,
      ]),
    );
    mockGenerateText.mockImplementation(async (args: { system: string; prompt: string }) => {
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
