import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PROBE_MODULE = join(process.cwd(), 'scripts/e2e/webkit-stall-probe.mjs');
const WRAPPER = join(process.cwd(), 'scripts/e2e/webkit-stall-probe.sh');
const SUBPROCESS_TIMEOUT_MS = 30_000;
const CUSTOM_ITERATIONS = 40;

interface Options {
  iterations: number;
  baseUrl: string;
  path: string;
  gotoTimeoutMs: number;
}

interface Summary {
  navigations: number;
  stalls: number;
  stallEvery: number | null;
  verdict: string;
  details: Record<string, unknown>[];
}

interface ProbeModule {
  DEFAULT_BASE_URL: string;
  DEFAULT_GOTO_TIMEOUT_MS: number;
  DEFAULT_ITERATIONS: number;
  DEFAULT_PATH: string;
  EXIT_BAD_ARGUMENTS: number;
  REQUIRED_PLATFORM: string;
  platformError: (platform: string, version: string) => string | undefined;
  parseArguments: (argv: string[]) => { options?: Options; error?: string };
  runProbe: (options: Options, launch: () => Promise<unknown>) => Promise<Summary>;
  summarize: (navigations: number, stalls: unknown[]) => Summary;
}

const probe = (await import(PROBE_MODULE)) as ProbeModule;
const {
  DEFAULT_BASE_URL,
  DEFAULT_GOTO_TIMEOUT_MS,
  DEFAULT_ITERATIONS,
  DEFAULT_PATH,
  EXIT_BAD_ARGUMENTS,
  REQUIRED_PLATFORM,
  platformError,
  parseArguments,
  runProbe,
  summarize,
} = probe;

function fakeLauncher(failOn: number[]) {
  let navigation = 0;
  return async () => ({
    newContext: async () => ({
      newPage: async () => ({
        url: () => 'about:blank',
        goto: async () => {
          navigation += 1;
          if (failOn.includes(navigation)) throw new Error('Timeout 12000ms exceeded.\ncall log');
        },
      }),
      close: async () => undefined,
    }),
    close: async () => undefined,
  });
}

describe('webkit stall probe arguments', () => {
  it('defaults to 12,000 navigations of /links/en', () => {
    expect(parseArguments([])).toEqual({
      options: {
        iterations: DEFAULT_ITERATIONS,
        baseUrl: DEFAULT_BASE_URL,
        path: DEFAULT_PATH,
        gotoTimeoutMs: DEFAULT_GOTO_TIMEOUT_MS,
      },
    });
    expect(DEFAULT_ITERATIONS).toBe(12_000);
  });

  it('reads each flag', () => {
    const { options } = parseArguments(['--iterations', `${CUSTOM_ITERATIONS}`, '--path', '/cv']);
    expect(options?.iterations).toBe(CUSTOM_ITERATIONS);
    expect(options?.path).toBe('/cv');
  });

  it('rejects an unknown flag, a missing value and a non-integer count', () => {
    expect(parseArguments(['--nope', '1']).error).toMatch(/unknown argument/);
    expect(parseArguments(['--iterations']).error).toMatch(/needs a value/);
    expect(parseArguments(['--iterations', 'many']).error).toMatch(/positive integer/);
  });
});

describe('webkit stall probe output', () => {
  it('reports a clean run', async () => {
    const summary = await runProbe(
      { iterations: 3, baseUrl: 'http://x', path: '/p', gotoTimeoutMs: 1 },
      fakeLauncher([]),
    );
    expect(summary).toMatchObject({
      navigations: 3,
      stalls: 0,
      verdict: 'clean',
      stallEvery: null,
    });
  });

  it('counts a goto timeout as a stall', async () => {
    const summary = await runProbe(
      { iterations: 4, baseUrl: 'http://x', path: '/p', gotoTimeoutMs: 1 },
      fakeLauncher([2]),
    );
    expect(summary.verdict).toBe('stalled');
    expect(summary.stalls).toBe(1);
    expect(summary.stallEvery).toBe(4);
    expect(summary.details[0]).toMatchObject({ navigation: 2, pageUrl: 'about:blank' });
  });

  it('summarizes with no stalls as clean', () => {
    expect(summarize(10, []).verdict).toBe('clean');
  });
});

describe('webkit stall probe platform', () => {
  it('refuses a platform other than linux and names the image', () => {
    expect(platformError('darwin', '1.65.1')).toMatch(
      /mcr\.microsoft\.com\/playwright:v1\.65\.1-noble/,
    );
    expect(platformError(REQUIRED_PLATFORM, '1.65.1')).toBeUndefined();
  });
});

describe('webkit stall probe wrapper', () => {
  it('exits 2 on bad arguments without launching a browser', () => {
    const result = spawnSync('bash', [WRAPPER, '--iterations', 'x'], {
      encoding: 'utf8',
      timeout: SUBPROCESS_TIMEOUT_MS,
    });
    expect(result.status).toBe(EXIT_BAD_ARGUMENTS);
    expect(result.stderr).toMatch(/positive integer/);
  });
});
