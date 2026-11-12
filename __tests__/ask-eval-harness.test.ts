import { PRICING_USD_PER_MTOK } from '@/lib/eval/cost';
// @vitest-environment node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Requester } from '@upstash/redis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { isInjectionAttempt } from '@/lib/ask/injection';
import { ASK_MODEL } from '@/lib/ask/model';

const BROKEN_STREAM_QUESTION = ASK_EVAL_CORPUS.find(
  (item) =>
    item.kind === 'factual' &&
    ASK_EVAL_CORPUS.filter((other) => other.question.includes(item.question)).length === 1,
);
const BROKEN_JAILBREAK_QUESTION = ASK_EVAL_CORPUS.find(
  (item) => !isInjectionAttempt(item.question) && item.kind === 'jailbreak',
);

let brokenQuestion = BROKEN_STREAM_QUESTION;

const INPUT_TOKENS = 3000;
const OUTPUT_TOKENS = 100;

const { streamTextMock, generateTextMock, redisCommands, credentialsSeenByRedisClient } =
  vi.hoisted(() => ({
    streamTextMock: vi.fn(),
    generateTextMock: vi.fn(),
    redisCommands: [] as unknown[][],
    credentialsSeenByRedisClient: [] as boolean[],
  }));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@upstash/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@upstash/redis')>();
  const recordingRequester = {
    request: async (req: { body?: unknown }) => {
      redisCommands.push(req.body as unknown[]);
      return { result: 'OK' };
    },
  } as unknown as Requester;
  class RecordingRedis extends actual.Redis {
    static override fromEnv(): InstanceType<typeof actual.Redis> {
      credentialsSeenByRedisClient.push(Boolean(process.env.UPSTASH_REDIS_REST_URL));
      return new actual.Redis(recordingRequester);
    }
  }
  return { ...actual, Redis: RecordingRedis };
});
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

type StreamArgs = { messages: Array<{ role: string; content: string }> };

function installModelDouble(): void {
  streamTextMock.mockImplementation((args: StreamArgs) => {
    const userTurn = args.messages.find((m) => m.role === 'user')?.content ?? '';
    const broken = brokenQuestion !== undefined && userTurn.includes(brokenQuestion.question);
    return {
      textStream: (async function* () {
        if (broken) throw new Error('gateway 503');
        yield 'Erik is a Senior Software Engineer at Raylu.';
      })(),
      usage: Promise.resolve({
        inputTokens: INPUT_TOKENS,
        outputTokens: OUTPUT_TOKENS,
        inputTokenDetails: {
          noCacheTokens: INPUT_TOKENS,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
      finishReason: Promise.resolve('stop'),
    };
  });

  generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
    const gold = ASK_EVAL_CALIBRATION.find((c) =>
      prompt.includes(`\n${c.canonicalAnswer}\n</answer-`),
    );
    const pass = gold ? gold.humanVerdict : true;
    return {
      text: JSON.stringify({ pass, reason: 'double' }),
      usage: { inputTokens: 500, outputTokens: 20 },
    };
  });
}

describe('pnpm ask:eval harness without Redis', () => {
  const originalCwd = process.cwd();
  let outDir: string;
  const logs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    brokenQuestion = BROKEN_STREAM_QUESTION;
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    installModelDouble();
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-'));
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

  it('grades the corpus, excludes a broken stream from the rates and meters real token cost', async () => {
    expect(BROKEN_STREAM_QUESTION).toBeDefined();
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(logs.some((l) => l.includes('GATE PASSED'))).toBe(true), {
      timeout: 20_000,
    });

    const result = JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8')) as {
      featureModel: string;
      errored: number;
      answeredCount: number;
      featureCostUsd: number;
      featureCostMeasuredAnswers: number;
      jailbreakResistance: {
        total: number;
        gate: { passed: number; total: number };
        model: { passed: number; total: number };
      };
      items: Array<{ id: string; errored: boolean; answer: string }>;
    };

    expect(result.featureModel).toBe(ASK_MODEL);
    expect(streamTextMock.mock.calls.length).toBeGreaterThan(0);
    expect(
      streamTextMock.mock.calls.every(([args]) => (args as { model: string }).model === ASK_MODEL),
      'the eval must grade the model production serves',
    ).toBe(true);
    expect(result.errored).toBe(1);
    expect(
      logs.some((l) => l.includes('[pending] cal-jb-partial-compliance')),
      'a gold case no judge has seen yet is labelled in the run output',
    ).toBe(true);
    const broken = result.items.find((i) => i.errored);
    expect(broken?.id).toBe(BROKEN_STREAM_QUESTION?.id);
    expect(broken?.answer).toContain(askErrors.en.interrupted);
    const { log } = await import('@/lib/log');
    expect(
      vi.mocked(log.error),
      'the upstream cause stays in the server log for the operator',
    ).toHaveBeenCalledWith(
      'ask stream failed',
      expect.objectContaining({ error: expect.objectContaining({ message: 'gateway 503' }) }),
    );
    expect(result.jailbreakResistance.total).toBe(
      ASK_EVAL_CORPUS.filter((i) => i.kind === 'jailbreak').length,
    );

    const gateRefusedJailbreaks = ASK_EVAL_CORPUS.filter(
      (i) => i.kind === 'jailbreak' && isInjectionAttempt(i.question),
    ).length;
    expect(result.jailbreakResistance.gate).toEqual({
      passed: gateRefusedJailbreaks,
      total: gateRefusedJailbreaks,
    });
    expect(result.jailbreakResistance.model.total).toBe(
      result.jailbreakResistance.total - gateRefusedJailbreaks,
    );
    expect(
      result.jailbreakResistance.model.total,
      'the pt-BR jailbreak items avoid the regex, so the model is graded on them',
    ).toBeGreaterThan(0);

    const portugueseCalls = streamTextMock.mock.calls.filter(([args]) =>
      (args as StreamArgs).messages.some((m) => m.content.includes('Answer in Portuguese')),
    ).length;
    expect(portugueseCalls, 'the eval sends each pt-BR item with locale pt').toBe(
      ASK_EVAL_CORPUS.filter((i) => i.locale === 'pt' && !isInjectionAttempt(i.question)).length,
    );

    expect(result.featureCostMeasuredAnswers).toBe(result.answeredCount);
    const perAnswer =
      (INPUT_TOKENS * PRICING_USD_PER_MTOK.feature.input +
        OUTPUT_TOKENS * PRICING_USD_PER_MTOK.feature.output) /
      1_000_000;
    expect(result.featureCostUsd).toBeCloseTo(perAnswer * result.answeredCount, 3);
  }, 30_000);
});

describe('pnpm ask:eval with EVAL_PUBLISH=1 and Redis credentials', () => {
  const originalCwd = process.cwd();
  let outDir: string;
  const logs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    installModelDouble();
    redisCommands.length = 0;
    credentialsSeenByRedisClient.length = 0;
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-publish-'));
    process.chdir(outDir);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
    vi.stubEnv('ASK_ENABLED', 'true');
    vi.stubEnv('EVAL_PUBLISH', '1');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://prod-redis.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'prod-token');
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

  it('keeps the production credentials away from the route and uses them only to publish the aggregate', async () => {
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(logs.some((l) => l.includes('GATE PASSED'))).toBe(true), {
      timeout: 20_000,
    });

    expect(streamTextMock.mock.calls.length).toBeGreaterThan(0);
    expect(
      redisCommands.map((command) => command[0]),
      'the route must not run its ask:log, ask:guard and refusal counters against production Redis',
    ).toEqual(['set']);
    expect(redisCommands[0]?.[1]).toBe('ask:eval:latest');
    expect(credentialsSeenByRedisClient).toEqual([true]);
  }, 30_000);
});

describe('pnpm ask:eval when a jailbreak item cannot be measured', () => {
  const originalCwd = process.cwd();
  let outDir: string;
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCodes: Array<string | number | null | undefined> = [];

  beforeEach(() => {
    vi.resetModules();
    brokenQuestion = BROKEN_JAILBREAK_QUESTION;
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    installModelDouble();
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-jb-'));
    process.chdir(outDir);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
    vi.stubEnv('ASK_ENABLED', 'true');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    logs.length = 0;
    errors.length = 0;
    exitCodes = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      exitCodes.push(code);
    }) as typeof process.exit);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fails the gate instead of excluding the errored jailbreak from the 100% rate', async () => {
    expect(BROKEN_JAILBREAK_QUESTION).toBeDefined();
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(errors.some((l) => l.includes('GATE FAILED'))).toBe(true), {
      timeout: 20_000,
    });

    const result = JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8')) as {
      gates: { passed: boolean };
      jailbreakResistance: { rate: number };
    };
    expect(result.jailbreakResistance.rate).toBe(1);
    expect(result.gates.passed).toBe(false);
    expect(errors.join('\n')).toContain(BROKEN_JAILBREAK_QUESTION?.id);
    expect(exitCodes).toEqual([1]);
  }, 30_000);
});
