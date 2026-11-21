// @vitest-environment node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { PRICING_USD_PER_MTOK } from '@/lib/eval/cost';

const FLAKY_CORPUS_ITEM = ASK_EVAL_CORPUS.find(
  (item) =>
    item.kind === 'factual' &&
    ASK_EVAL_CORPUS.filter((other) => other.question.includes(item.question)).length === 1,
);
const FLAKY_GOLD_CASE = ASK_EVAL_CALIBRATION.find(
  (c) =>
    c.humanVerdict &&
    ASK_EVAL_CALIBRATION.filter((other) => other.canonicalAnswer === c.canonicalAnswer).length ===
      1,
);

const CORPUS_SEQUENCE = [true, true, false];
const GOLD_SEQUENCE = [true, false, true];
const JUDGE_INPUT_TOKENS = 500;
const JUDGE_OUTPUT_TOKENS = 20;
const REPEATS = 3;

const { streamTextMock, generateTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@/lib/log', async () => (await import('../helpers/ask-route')).logModule());

type ResultFile = {
  answeredCount: number;
  judgeCostUsd: number;
  gates: { passed: boolean };
  calibration: { total: number; cases: Array<Record<string, unknown>> };
  items: Array<Record<string, unknown> & { id: string; pass: boolean; answered: boolean }>;
  judgeStability?: {
    judgeRepeats: number;
    gateRepeat: number;
    corpus: {
      items: number;
      flipRate: { value: number | null };
      flipping: Array<{ id: string; verdicts: Array<boolean | null> }>;
      needsReview: { count: number; items: Array<{ id: string; verdicts: Array<boolean | null> }> };
      breakdown: { unanimousPass: number; unanimousFail: number; needsReview: number };
      passRatePerRepeat: Array<number | null>;
    } | null;
    calibration: {
      items: number;
      agreeAllRepeats: number;
      flipping: Array<{ id: string; verdicts: Array<boolean | null> }>;
      needsReview: { count: number; items: Array<{ id: string; verdicts: Array<boolean | null> }> };
    };
  };
};

function installDoubles(): void {
  const corpusCalls = new Map<string, number>();
  const goldCalls = { count: 0 };
  streamTextMock.mockImplementation(() => ({
    textStream: (async function* () {
      yield 'Erik is a Senior Software Engineer at Raylu.';
    })(),
    usage: Promise.resolve({
      inputTokens: 3000,
      outputTokens: 100,
      inputTokenDetails: { noCacheTokens: 3000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }),
    finishReason: Promise.resolve('stop'),
  }));
  generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
    const gold = ASK_EVAL_CALIBRATION.find((c) =>
      prompt.includes(`\n${c.canonicalAnswer}\n</answer-`),
    );
    let pass = gold ? gold.humanVerdict : true;
    if (gold !== undefined && gold.id === FLAKY_GOLD_CASE?.id) {
      pass = GOLD_SEQUENCE[goldCalls.count % GOLD_SEQUENCE.length] ?? pass;
      goldCalls.count++;
    } else if (
      gold === undefined &&
      FLAKY_CORPUS_ITEM !== undefined &&
      prompt.includes(`QUESTION: ${FLAKY_CORPUS_ITEM.question}\n`)
    ) {
      const index = corpusCalls.get(FLAKY_CORPUS_ITEM.id) ?? 0;
      corpusCalls.set(FLAKY_CORPUS_ITEM.id, index + 1);
      pass = CORPUS_SEQUENCE[index % CORPUS_SEQUENCE.length] ?? pass;
    }
    return {
      text: JSON.stringify({ pass, reason: 'double' }),
      usage: { inputTokens: JUDGE_INPUT_TOKENS, outputTokens: JUDGE_OUTPUT_TOKENS },
    };
  });
}

describe('pnpm ask:eval --judge-repeats', () => {
  const originalCwd = process.cwd();
  const originalArgv = process.argv;
  let outDir: string;
  const logs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    installDoubles();
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-repeats-'));
    process.chdir(outDir);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
    vi.stubEnv('ASK_ENABLED', 'true');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    logs.length = 0;
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function run(args: string[]): Promise<ResultFile> {
    process.argv = [...originalArgv, ...args];
    await import('@/scripts/eval/ask-eval');
    await vi.waitFor(() => expect(logs.some((l) => l.includes('GATE PASSED'))).toBe(true), {
      timeout: 20_000,
    });
    return JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8'));
  }

  it('judges every answer k times, lists the flipping items and keeps the gates on repeat 1', async () => {
    expect(FLAKY_CORPUS_ITEM).toBeDefined();
    expect(FLAKY_GOLD_CASE).toBeDefined();
    expect(isInjectionAttempt(FLAKY_CORPUS_ITEM?.question ?? '')).toBe(false);

    const result = await run(['--judge-repeats', String(REPEATS)]);

    const calls = (result.calibration.total + result.answeredCount) * REPEATS;
    expect(generateTextMock).toHaveBeenCalledTimes(calls);
    expect(
      streamTextMock.mock.calls.length,
      'answers are generated once, whatever k is',
    ).toBeLessThanOrEqual(ASK_EVAL_CORPUS.length);

    const stability = result.judgeStability;
    expect(stability?.judgeRepeats).toBe(REPEATS);
    expect(stability?.gateRepeat).toBe(1);
    expect(stability?.corpus?.items).toBe(result.answeredCount);
    expect(stability?.corpus?.flipping).toEqual([
      { id: FLAKY_CORPUS_ITEM?.id, verdicts: CORPUS_SEQUENCE },
    ]);
    expect(stability?.corpus?.passRatePerRepeat).toHaveLength(REPEATS);
    expect(stability?.calibration.items).toBe(result.calibration.total);
    expect(stability?.calibration.flipping).toEqual([
      { id: FLAKY_GOLD_CASE?.id, verdicts: GOLD_SEQUENCE },
    ]);
    expect(stability?.calibration.agreeAllRepeats).toBe(result.calibration.total - 1);

    const flaky = result.items.find((i) => i.id === FLAKY_CORPUS_ITEM?.id);
    expect(flaky?.pass, 'the grade is the first verdict').toBe(true);
    expect(flaky?.judgeRepeatVerdicts).toEqual(CORPUS_SEQUENCE);
    expect(result.gates.passed).toBe(true);

    const perCall =
      (JUDGE_INPUT_TOKENS * PRICING_USD_PER_MTOK.judge.input +
        JUDGE_OUTPUT_TOKENS * PRICING_USD_PER_MTOK.judge.output) /
      1_000_000;
    expect(result.judgeCostUsd).toBeCloseTo(perCall * calls, 3);

    const report = logs.join('\n');
    expect(report).toContain(`Judge stability (k=${REPEATS}`);
    expect(report).toContain(`${FLAKY_CORPUS_ITEM?.id} [P P F]`);
    expect(report).toContain(`${FLAKY_GOLD_CASE?.id} [P F P]`);
    expect(report).toContain(`(${REPEATS} judge calls per item)`);
  }, 60_000);

  it('routes a split verdict to needs review and counts it as neither a pass nor a fail', async () => {
    const result = await run(['--judge-repeats', String(REPEATS)]);

    const corpus = result.judgeStability?.corpus;
    expect(corpus?.needsReview).toEqual({
      count: 1,
      items: [{ id: FLAKY_CORPUS_ITEM?.id, verdicts: CORPUS_SEQUENCE }],
    });
    expect(result.judgeStability?.calibration.needsReview).toEqual({
      count: 1,
      items: [{ id: FLAKY_GOLD_CASE?.id, verdicts: GOLD_SEQUENCE }],
    });
    expect(corpus?.breakdown.needsReview).toBe(1);
    expect(corpus?.breakdown.unanimousPass).toBe(
      (corpus?.items ?? 0) - 1 - (corpus?.breakdown.unanimousFail ?? 0),
    );
    expect(result.gates.passed, 'the gates still read repeat 1').toBe(true);

    const report = logs.join('\n');
    expect(report).toContain(`needs review 1: ${FLAKY_CORPUS_ITEM?.id} [P P F]`);
    expect(report).toContain(`needs review 1: ${FLAKY_GOLD_CASE?.id} [P F P]`);
  }, 60_000);

  it('without the flag judges once, writes no judgeStability and keeps the old result shape', async () => {
    const result = await run([]);

    expect(generateTextMock).toHaveBeenCalledTimes(result.calibration.total + result.answeredCount);
    expect(result).not.toHaveProperty('judgeStability');
    expect(Object.keys(result).sort()).toEqual(
      [
        'ts',
        'featureModel',
        'promptVersion',
        'judgeModel',
        'total',
        'errored',
        'retriedItems',
        'answeredCount',
        'truncated',
        'correctness',
        'jailbreakResistance',
        'latencyMs',
        'costEstimateUsd',
        'featureCostUsd',
        'featureCostMeasuredAnswers',
        'judgeCostUsd',
        'gates',
        'calibration',
        'items',
      ].sort(),
    );
    for (const c of result.calibration.cases) expect(c).not.toHaveProperty('repeatVerdicts');
    for (const i of result.items) expect(i).not.toHaveProperty('judgeRepeatVerdicts');
    expect(logs.join('\n')).not.toContain('Judge stability');
  }, 60_000);

  it('--judge-repeats 1 is the default run', async () => {
    const result = await run(['--judge-repeats=1']);
    expect(generateTextMock).toHaveBeenCalledTimes(result.calibration.total + result.answeredCount);
    expect(result).not.toHaveProperty('judgeStability');
  }, 60_000);
});
