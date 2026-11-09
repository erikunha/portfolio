import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgeVerdict } from '@/lib/eval/types';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));
vi.mock('@/lib/eval/judge', () => ({ judge: mockJudge }));

import { gradeRun } from '@/lib/eval/grade';

function codeCase(assert?: (o: string) => boolean) {
  const base = {
    id: 'code-case',
    prompt: 'stage your files',
    target: { name: 'rule', systemText: 'never broad git add' },
    tier: 'mechanical' as const,
    grader: 'code' as const,
    expect: 'no broad git add',
    knownHard: false,
    dir: 'code-case',
  };
  return assert ? { ...base, assert } : base;
}

function judgeCase() {
  return {
    id: 'judge-case',
    prompt: 'apply the rule',
    target: { name: 'rule', systemText: 'rule text' },
    tier: 'judgment' as const,
    grader: 'judge' as const,
    expect: 'applies the rule correctly',
    knownHard: false,
    dir: 'judge-case',
  };
}

function verdict(pass: boolean): JudgeVerdict {
  return { pass, reason: pass ? 'ok' : 'no', inputTokens: 7, outputTokens: 3 };
}

beforeEach(() => {
  mockJudge.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/eval/grade gradeRun', () => {
  it('code grader runs assert and never invokes the judge', async () => {
    const c = codeCase((o) => !o.includes('git add -A'));
    const v = await gradeRun(c, 'git add lib/foo.ts', { judgeModel: 'jm' });
    expect(v.pass).toBe(true);
    expect(mockJudge).toHaveBeenCalledTimes(0);
    expect(v.inputTokens).toBe(0);
    expect(v.outputTokens).toBe(0);
  });

  it('code grader reports a failing assertion as pass:false (still no judge call)', async () => {
    const c = codeCase((o) => !o.includes('git add -A'));
    const v = await gradeRun(c, 'git add -A then commit', { judgeModel: 'jm' });
    expect(v.pass).toBe(false);
    expect(mockJudge).toHaveBeenCalledTimes(0);
  });

  it('judge grader invokes the shared judge with the tiered judgeModel', async () => {
    mockJudge.mockResolvedValueOnce(verdict(true));
    const c = judgeCase();
    const v = await gradeRun(c, 'a thoughtful answer', {
      judgeModel: 'anthropic/claude-sonnet-4-6',
    });
    expect(v.pass).toBe(true);
    expect(mockJudge).toHaveBeenCalledTimes(1);
    const [item, answer, opts] = mockJudge.mock.calls[0] ?? [];
    expect(item.id).toBe('judge-case');
    expect(item.question).toBe('apply the rule');
    expect(item.expect).toBe('applies the rule correctly');
    expect(answer).toBe('a thoughtful answer');
    expect(opts.model).toBe('anthropic/claude-sonnet-4-6');
  });

  it('throws a clear config error for a code grader with no assert', async () => {
    const c = codeCase(undefined);
    await expect(gradeRun(c, 'anything', { judgeModel: 'jm' })).rejects.toThrow(/assert/i);
  });
});
