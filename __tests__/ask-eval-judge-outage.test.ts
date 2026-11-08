// @vitest-environment node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { isInjectionAttempt } from '@/lib/ask/injection';

const OUTAGE_ITEM = ASK_EVAL_CORPUS.find(
  (item) => item.kind === 'jailbreak' && !isInjectionAttempt(item.question),
);

const { streamTextMock, generateTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());
vi.mock('@/lib/eval/judge', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eval/judge')>();
  return {
    ...original,
    judge: vi.fn(async (item: { id: string; question: string }, answer: string) => {
      if (OUTAGE_ITEM !== undefined && item.id === OUTAGE_ITEM.id) {
        return {
          pass: false,
          reason: `${original.JUDGE_ERROR_REASON_PREFIX} 3 attempts: gateway 503`,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      const { ASK_EVAL_CALIBRATION } = await import('@/content/ask-eval-calibration');
      const gold = ASK_EVAL_CALIBRATION.find((c) => c.canonicalAnswer === answer);
      return {
        pass: gold ? gold.humanVerdict : true,
        reason: 'double',
        inputTokens: 1,
        outputTokens: 1,
      };
    }),
  };
});

describe('pnpm ask:eval when the judge is down for one corpus item', () => {
  const originalCwd = process.cwd();
  let outDir: string;
  const logs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    streamTextMock.mockReset();
    streamTextMock.mockImplementation(() => ({
      textStream: (async function* () {
        yield 'Erik is a Senior Software Engineer at Raylu.';
      })(),
      usage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        inputTokenDetails: { noCacheTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
      }),
      finishReason: Promise.resolve('stop'),
    }));
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-outage-'));
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

  it('records the item as errored and keeps the jailbreak gate on the items that were graded', async () => {
    expect(OUTAGE_ITEM).toBeDefined();
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(logs.some((l) => l.includes('GATE PASSED'))).toBe(true), {
      timeout: 20_000,
    });

    const result = JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8')) as {
      errored: number;
      gates: { passed: boolean };
      jailbreakResistance: { rate: number; total: number };
      items: Array<{ id: string; errored: boolean; pass: boolean; reason: string }>;
    };

    const outage = result.items.find((i) => i.id === OUTAGE_ITEM?.id);
    expect(outage).toMatchObject({ errored: true, pass: false });
    expect(outage?.reason).toContain('gateway 503');
    expect(result.errored).toBe(1);
    expect(result.jailbreakResistance.rate).toBe(1);
    expect(result.jailbreakResistance.total).toBe(
      ASK_EVAL_CORPUS.filter((i) => i.kind === 'jailbreak').length - 1,
    );
    expect(result.gates.passed).toBe(true);
  }, 30_000);
});
