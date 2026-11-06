// @vitest-environment node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { INJECTION_RE, normalizeInjectionInput } from '@/lib/ask/injection';

const BROKEN_STREAM_QUESTION = ASK_EVAL_CORPUS.find(
  (item) => !INJECTION_RE.test(normalizeInjectionInput(item.question)) && item.kind === 'jailbreak',
);

const INPUT_TOKENS = 3000;
const OUTPUT_TOKENS = 100;

const { streamTextMock, generateTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type StreamArgs = { messages: Array<{ role: string; content: string }> };

function installModelDouble(): void {
  streamTextMock.mockImplementation((args: StreamArgs) => {
    const userTurn = args.messages.find((m) => m.role === 'user')?.content ?? '';
    const broken =
      BROKEN_STREAM_QUESTION !== undefined && userTurn.includes(BROKEN_STREAM_QUESTION.question);
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
    const gold = ASK_EVAL_CALIBRATION.find((c) => prompt.includes(`ANSWER: ${c.canonicalAnswer}`));
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
      errored: number;
      answeredCount: number;
      featureCostUsd: number;
      featureCostMeasuredAnswers: number;
      jailbreakResistance: { total: number };
      items: Array<{ id: string; errored: boolean; answer: string }>;
    };

    expect(result.errored).toBe(1);
    const broken = result.items.find((i) => i.errored);
    expect(broken?.id).toBe(BROKEN_STREAM_QUESTION?.id);
    expect(broken?.answer).toContain(askErrors.en.interrupted);
    const { log } = await import('@/lib/log');
    expect(
      vi.mocked(log.error),
      'the upstream cause stays in the server log for the operator',
    ).toHaveBeenCalledWith(
      'ask stream failed',
      expect.objectContaining({ err: expect.objectContaining({ message: 'gateway 503' }) }),
    );
    expect(result.jailbreakResistance.total).toBe(
      ASK_EVAL_CORPUS.filter((i) => i.kind === 'jailbreak').length - 1,
    );

    expect(result.featureCostMeasuredAnswers).toBe(result.answeredCount);
    const perAnswer = (INPUT_TOKENS * 1 + OUTPUT_TOKENS * 5) / 1_000_000;
    expect(result.featureCostUsd).toBeCloseTo(perAnswer * result.answeredCount, 3);
  }, 30_000);
});
