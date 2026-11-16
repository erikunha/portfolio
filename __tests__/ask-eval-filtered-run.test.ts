// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';

const CORPUS_ID = 'fact-ai-direction';
const GOLD_ID = 'cal-crit-ai-direction-core-wording';
const REPEATS = 3;
const REASON = 'double';
const RESULTS_DIR = 'ask-eval-results';
const EXIT_FAILURE = 1;
const SUMMARY = 'ask-eval summary';
const NOTICE = 'FILTERED RUN (2 ids): gates not evaluated';

const { streamTextMock, generateTextMock, publishMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
  publishMock: vi.fn(),
}));

vi.mock('ai', () => ({ streamText: streamTextMock, generateText: generateTextMock }));
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());
vi.mock('@/lib/eval/redis-publish', () => ({ publishWithCredentials: publishMock }));

type Result = {
  filter?: string[];
  total: number;
  gates: { passed: boolean };
  calibration: { total: number; cases: Array<Record<string, unknown> & { id: string }> };
  items: Array<Record<string, unknown> & { id: string }>;
  judgeStability?: {
    corpus: { items: number } | null;
    calibration: { items: number };
  };
};

function installDoubles(opts: { judgeFails?: boolean } = {}): void {
  streamTextMock.mockImplementation(() => ({
    textStream: (async function* () {
      yield 'Erik is moving toward AI engineering.';
    })(),
    usage: Promise.resolve({
      inputTokens: 3000,
      outputTokens: 100,
      inputTokenDetails: { noCacheTokens: 3000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }),
    finishReason: Promise.resolve('stop'),
  }));
  generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
    if (opts.judgeFails) throw new Error('gateway down');
    const gold = ASK_EVAL_CALIBRATION.find((c) =>
      prompt.includes(`\n${c.canonicalAnswer}\n</answer-`),
    );
    return {
      text: JSON.stringify({ pass: gold ? gold.humanVerdict : true, reason: REASON }),
      usage: { inputTokens: 500, outputTokens: 20 },
    };
  });
}

describe('pnpm ask:eval --only', () => {
  const originalCwd = process.cwd();
  const originalArgv = process.argv;
  let outDir: string;
  const logs: string[] = [];
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    streamTextMock.mockReset();
    generateTextMock.mockReset();
    publishMock.mockReset();
    publishMock.mockResolvedValue({ published: true });
    installDoubles();
    outDir = mkdtempSync(path.join(tmpdir(), 'ask-eval-only-'));
    process.chdir(outDir);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
    vi.stubEnv('ASK_ENABLED', 'true');
    vi.stubEnv('EVAL_PUBLISH', '1');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
    logs.length = 0;
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    exitMock = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function run(args: string[], done: string): Promise<Result> {
    process.argv = [...originalArgv, ...args];
    await import('@/scripts/ask-eval');
    await vi.waitFor(() => expect(logs.join('\n')).toContain(done), { timeout: 20_000 });
    return JSON.parse(readFileSync(path.join(outDir, 'ask-eval-result.json'), 'utf8'));
  }

  it('runs only the listed corpus and gold ids and says the gates were not evaluated', async () => {
    const result = await run(
      ['--only', `${CORPUS_ID},${GOLD_ID}`, '--judge-repeats', String(REPEATS)],
      SUMMARY,
    );

    expect(result.filter).toEqual([CORPUS_ID, GOLD_ID]);
    expect(result.items.map((i) => i.id)).toEqual([CORPUS_ID]);
    expect(result.calibration.cases.map((c) => c.id)).toEqual([GOLD_ID]);
    expect(generateTextMock).toHaveBeenCalledTimes(2 * REPEATS);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(result.judgeStability?.corpus?.items).toBe(1);
    expect(result.judgeStability?.calibration.items).toBe(1);
    expect(result.gates.passed, 'a subset is never read as a green gate').toBe(false);

    const report = logs.join('\n');
    expect(report.split(NOTICE)).toHaveLength(3);
    expect(report).not.toContain('GATE PASSED');
    expect(report).not.toContain('GATE FAILED');
    expect(report).not.toContain('CALIBRATION GATE FAILED');
    expect(exitMock).not.toHaveBeenCalledWith(EXIT_FAILURE);
  }, 60_000);

  it('never publishes, even with EVAL_PUBLISH=1 and credentials', async () => {
    await run(['--only', CORPUS_ID], SUMMARY);
    expect(publishMock).not.toHaveBeenCalled();
  }, 60_000);

  it('still publishes on a default run, so the filtered check above is not vacuous', async () => {
    await run([], 'GATE PASSED');
    expect(publishMock).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('runs a corpus-only and a gold-only subset', async () => {
    const corpusOnly = await run(['--only', CORPUS_ID], SUMMARY);
    expect(corpusOnly.calibration.total).toBe(0);
    expect(corpusOnly.items).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('exits 1 when a selected item errored, because nothing was measured', async () => {
    generateTextMock.mockReset();
    installDoubles({ judgeFails: true });
    await run(['--only', `${CORPUS_ID},${GOLD_ID}`], SUMMARY);
    await vi.waitFor(() => expect(exitMock).toHaveBeenCalledWith(EXIT_FAILURE));
  }, 60_000);

  it('adds no filter key to a default run', async () => {
    const result = await run([], 'GATE PASSED');
    expect(result).not.toHaveProperty('filter');
    expect(result.calibration.total).toBe(ASK_EVAL_CALIBRATION.length);
    expect(result.total).toBe(ASK_EVAL_CORPUS.length);
  }, 60_000);

  it('keeps a timestamped copy of the result under a gitignored folder', async () => {
    const result = await run([], 'GATE PASSED');
    const copies = readdirSync(path.join(outDir, RESULTS_DIR));
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
    const copy = readFileSync(path.join(outDir, RESULTS_DIR, copies[0] ?? ''), 'utf8');
    expect(JSON.parse(copy)).toEqual(result);
  }, 60_000);

  it('stores every repeat reason beside the verdicts when k is above 1, and nothing at k=1', async () => {
    const withRepeats = await run(
      ['--only', `${CORPUS_ID},${GOLD_ID}`, '--judge-repeats', String(REPEATS)],
      SUMMARY,
    );
    expect(withRepeats.items[0]?.judgeRepeatReasons).toEqual(Array(REPEATS).fill(REASON));
    expect(withRepeats.calibration.cases[0]?.repeatReasons).toEqual(Array(REPEATS).fill(REASON));

    vi.resetModules();
    logs.length = 0;
    const single = await run(['--only', `${CORPUS_ID},${GOLD_ID}`], SUMMARY);
    expect(single.items[0]).not.toHaveProperty('judgeRepeatReasons');
    expect(single.calibration.cases[0]).not.toHaveProperty('repeatReasons');
  }, 60_000);
});

describe('ask-eval command line, --only', () => {
  const ROOT = path.resolve(__dirname, '..');
  const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const CLI_TIMEOUT_MS = 90_000;

  function runCli(args: string[]) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TSX_TSCONFIG_PATH: 'scripts/tsconfig.eval.json',
    };
    for (const name of ['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'CI', 'EVAL_PUBLISH']) {
      delete env[name];
    }
    return spawnSync(TSX, ['scripts/ask-eval.ts', ...args], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      timeout: CLI_TIMEOUT_MS,
    });
  }

  it(
    'exits 1 and names an unknown id before any model call',
    () => {
      const out = runCli(['--only', 'fact-ai-direction,not-a-real-id']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('unknown id(s): not-a-real-id');
    },
    CLI_TIMEOUT_MS,
  );

  it(
    'exits 1 on --only with no ids',
    () => {
      const out = runCli(['--only']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain('--only needs at least one id');
    },
    CLI_TIMEOUT_MS,
  );
});
