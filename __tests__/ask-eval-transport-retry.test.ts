// @vitest-environment node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { evaluateGates, type GradedItem, RETRIED_FRACTION_LIMIT } from '@/lib/eval/ask-grading';
import {
  ASK_TRANSPORT_RETRIES,
  type AskResult,
  isTransportFailure,
  withTransportRetry,
} from '@/lib/eval/ask-retry';

const answer: AskResult = { kind: 'answer', text: 'ok', requestId: null };

function rejected(status: number): AskResult {
  return { kind: 'rejected', status, detail: `HTTP ${status}` };
}

const noSleep = async (_ms: number): Promise<void> => undefined;

describe('isTransportFailure', () => {
  it.each([0, 429, 500, 502, 503, 504])('treats status %i as a transport failure', (status) => {
    expect(isTransportFailure(rejected(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])('does not retry status %i', (status) => {
    expect(isTransportFailure(rejected(status))).toBe(false);
  });

  it('never treats an answer as a transport failure', () => {
    expect(isTransportFailure(answer)).toBe(false);
  });
});

describe('withTransportRetry', () => {
  it('returns the first answer with retried 0 and no sleep', async () => {
    const attempt = vi.fn(async () => answer);
    const sleep = vi.fn(noSleep);
    expect(await withTransportRetry(attempt, { sleep })).toEqual({ result: answer, retried: 0 });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transport failure and records how many retries it took', async () => {
    const attempt = vi
      .fn<() => Promise<AskResult>>()
      .mockResolvedValueOnce(rejected(503))
      .mockResolvedValueOnce(answer);
    expect(await withTransportRetry(attempt, { sleep: noSleep })).toEqual({
      result: answer,
      retried: 1,
    });
  });

  it('retries a thrown error as a transport failure', async () => {
    const attempt = vi
      .fn<() => Promise<AskResult>>()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(answer);
    expect(await withTransportRetry(attempt, { sleep: noSleep })).toEqual({
      result: answer,
      retried: 1,
    });
  });

  it('stops after the bound and returns the last failure', async () => {
    const attempt = vi.fn(async () => rejected(503));
    const outcome = await withTransportRetry(attempt, { sleep: noSleep });
    expect(attempt).toHaveBeenCalledTimes(ASK_TRANSPORT_RETRIES + 1);
    expect(outcome).toEqual({ result: rejected(503), retried: ASK_TRANSPORT_RETRIES });
  });

  it('turns a persistent throw into a rejected result with status 0', async () => {
    const attempt = vi.fn(async (): Promise<AskResult> => {
      throw new Error('socket hang up');
    });
    const { result } = await withTransportRetry(attempt, { sleep: noSleep });
    expect(result).toMatchObject({ kind: 'rejected', status: 0 });
    expect(result.kind === 'rejected' && result.detail).toContain('socket hang up');
  });

  it('does not retry a model-side rejection', async () => {
    const attempt = vi.fn(async () => rejected(400));
    const outcome = await withTransportRetry(attempt, { sleep: noSleep });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(outcome.retried).toBe(0);
  });

  it('backs off longer before each further retry', async () => {
    const sleep = vi.fn(noSleep);
    await withTransportRetry(async () => rejected(503), { sleep });
    const delays = sleep.mock.calls.map(([ms]) => ms);
    expect(delays).toHaveLength(ASK_TRANSPORT_RETRIES);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);
  });
});

function graded(overrides: Partial<GradedItem>): GradedItem {
  return {
    id: 'x',
    kind: 'factual',
    locale: 'en',
    question: 'q',
    answer: 'a',
    pass: true,
    reason: 'ok',
    latencyMs: 1,
    errored: false,
    answered: true,
    gateRefused: false,
    retried: 0,
    ...overrides,
  };
}

describe('evaluateGates and the retried fraction', () => {
  const items = (retriedCount: number): GradedItem[] => [
    ...Array.from({ length: 20 }, (_, i) =>
      graded({ id: `f${i}`, retried: i < retriedCount ? 1 : 0 }),
    ),
    ...Array.from({ length: 5 }, (_, i) => graded({ id: `j${i}`, kind: 'jailbreak' })),
  ];

  it('passes when the retried fraction stays within the limit', () => {
    const within = Math.floor(25 * RETRIED_FRACTION_LIMIT);
    expect(evaluateGates(items(within)).failures.map((f) => f.code)).not.toContain(
      'too-many-retried',
    );
  });

  it('fails when the retried fraction exceeds the limit, even though every item passed', () => {
    const beyond = Math.floor(25 * RETRIED_FRACTION_LIMIT) + 1;
    const verdict = evaluateGates(items(beyond));
    expect(verdict.passed).toBe(false);
    expect(verdict.failures.map((f) => f.code)).toContain('too-many-retried');
  });
});

const FLAKY_QUESTION = ASK_EVAL_CORPUS.find(
  (item) =>
    item.kind === 'factual' &&
    ASK_EVAL_CORPUS.filter((other) => other.question.includes(item.question)).length === 1,
);

const { streamTextMock, generateTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

describe('pnpm ask:eval when one item hits a transient stream failure', () => {
  const originalCwd = process.cwd();
  let outDir: string;
  const logs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    let flakyCalls = 0;
    streamTextMock.mockImplementation(
      (args: { messages: Array<{ role: string; content: string }> }) => {
        const userTurn = args.messages.find((m) => m.role === 'user')?.content ?? '';
        const isFlaky = FLAKY_QUESTION !== undefined && userTurn.includes(FLAKY_QUESTION.question);
        if (isFlaky) flakyCalls += 1;
        return {
          textStream: (async function* () {
            if (isFlaky && flakyCalls === 1) throw new Error('gateway 503');
            yield 'Erik is a Senior Software Engineer at Raylu.';
          })(),
          usage: Promise.resolve({
            inputTokens: 3000,
            outputTokens: 100,
            inputTokenDetails: { noCacheTokens: 3000, cacheReadTokens: 0, cacheWriteTokens: 0 },
          }),
          finishReason: Promise.resolve('stop'),
        };
      },
    );
    generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const gold = ASK_EVAL_CALIBRATION.find((c) =>
        prompt.includes(`\n${c.canonicalAnswer}\n</answer-`),
      );
      return {
        text: JSON.stringify({ pass: gold ? gold.humanVerdict : true, reason: 'double' }),
        usage: { inputTokens: 500, outputTokens: 20 },
      };
    });
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-retry-'));
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
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('retries the item, grades the second answer, and records retried in the result file', async () => {
    expect(FLAKY_QUESTION).toBeDefined();
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(logs.some((l) => l.includes('GATE PASSED'))).toBe(true), {
      timeout: 20_000,
    });

    const result = JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8')) as {
      errored: number;
      retriedItems: number;
      items: Array<{ id: string; errored: boolean; retried: number }>;
    };
    expect(result.errored).toBe(0);
    expect(result.retriedItems).toBe(1);
    expect(result.items.find((i) => i.id === FLAKY_QUESTION?.id)).toMatchObject({
      errored: false,
      retried: 1,
    });
    expect(
      result.items.filter((i) => i.id !== FLAKY_QUESTION?.id).every((i) => i.retried === 0),
    ).toBe(true);
  }, 30_000);
});
