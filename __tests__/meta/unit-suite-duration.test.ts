import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestModule } from 'vitest/node';
import { parse as parseYaml } from 'yaml';
import { FileBudgetReporter, SLOWEST_RUNNER_RATIO, SUITE_WARN_MS } from '../../vitest.config';

const SUBPROCESS_TEST_TIMEOUT_MS = 120_000;
const SECOND_MS = 1000;
const BUDGET_MS = 5 * SECOND_MS;
const SLOW_MS = 6 * SECOND_MS;
const HUNG_BUDGET_MS = SECOND_MS;
const POLL_MS = 200;
const REPEAT_POLLS = 5;
const NEVER_MS = 600 * SECOND_MS;
const WAIT_FOR_OUTPUT_MS = 90 * SECOND_MS;
const FAILED_EXIT_CODE = 1;
const MINUTE_MS = 60 * SECOND_MS;
const WALL_TIME_LINE = /unit suite wall time (\d+\.\d)s/;
const ANY_WARN_MS = 1;
const UNREACHABLE_WARN_MS = 3600 * SECOND_MS;
const FAKE_BUDGET_MS = 1000;
const FAKE_POLL_MS = 100;
const FAKE_ADVANCE_MS = 1500;

const repoRoot = process.cwd();
const vitestBin = join(repoRoot, 'node_modules/vitest/vitest.mjs');
const configPath = join(repoRoot, 'vitest.config.ts');

const workflow = parseYaml(readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    { 'timeout-minutes'?: number; steps: Array<{ name?: string; 'timeout-minutes'?: number }> }
  >;
};

interface FixtureReporter {
  budgetMs: number;
  suiteWarnMs?: number;
  annotate?: boolean;
}

function writeFixture(
  files: Record<string, string>,
  reporter: FixtureReporter | number,
): { dir: string; config: string } {
  const options = typeof reporter === 'number' ? { budgetMs: reporter } : reporter;
  const dir = mkdtempSync(join(tmpdir(), 'unit-suite-duration-'));
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const config = join(dir, 'vitest.fixture.config.ts');
  writeFileSync(
    config,
    `import { defineConfig } from 'vitest/config';
import { FileBudgetReporter } from ${JSON.stringify(configPath)};
export default defineConfig({
  test: {
    include: ['*.fixture.test.ts'],
    environment: 'node',
    testTimeout: ${NEVER_MS},
    reporters: [new FileBudgetReporter({
      budgetMs: ${options.budgetMs},
      pollMs: ${POLL_MS},
      suiteWarnMs: ${options.suiteWarnMs ?? UNREACHABLE_WARN_MS},
      annotate: ${options.annotate ?? false},
    })],
  },
});
`,
  );
  return { dir, config };
}

function startVitest(dir: string, config: string): ChildProcess {
  return spawn(process.execPath, [vitestBin, 'run', '--config', config, '--root', dir], {
    cwd: dir,
    env: { ...process.env, GITHUB_ACTIONS: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collect(child: ChildProcess): { text: () => string } {
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  return { text: () => output };
}

function exitCodeOf(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => child.once('close', resolve));
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOutput(
  child: ChildProcess,
  read: () => string,
  fragment: string,
): Promise<void> {
  const deadline = Date.now() + WAIT_FOR_OUTPUT_MS;
  while (!read().includes(fragment)) {
    if (child.exitCode !== null) throw new Error(`vitest exited before "${fragment}":\n${read()}`);
    if (Date.now() > deadline) throw new Error(`no "${fragment}" in:\n${read()}`);
    await pause(POLL_MS);
  }
}

const PASSING_TEST = `import { it } from 'vitest';
it('is quick', () => {});
`;
const SLOW_TEST = `import { it } from 'vitest';
it('is slow', async () => {
  await new Promise((resolve) => setTimeout(resolve, ${SLOW_MS}));
});
`;
const SLOW_IMPORT_TEST = `import { it } from 'vitest';
await new Promise((resolve) => setTimeout(resolve, ${SLOW_MS}));
it('imports slowly', () => {});
`;
const HUNG_IMPORT_TEST = `import { it } from 'vitest';
await new Promise(() => {});
it('never gets here', () => {});
`;
const HUNG_TEST = `import { it } from 'vitest';
it('never ends', async () => {
  await new Promise(() => {});
});
`;

describe('the unit suite stays inside its CI budget', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('runs a test that touches no DOM in the node environment, so it pays no jsdom start', () => {
    expect(typeof document).toBe('undefined');
  });

  it('fails the run and names the file that took longer than the per-file budget', async () => {
    const { dir, config } = writeFixture(
      {
        'slow.fixture.test.ts': SLOW_TEST,
        'heavy-import.fixture.test.ts': SLOW_IMPORT_TEST,
        'quick.fixture.test.ts': PASSING_TEST,
      },
      BUDGET_MS,
    );
    const child = startVitest(dir, config);
    const output = collect(child);

    const code = await exitCodeOf(child);

    expect(output.text()).toContain('slow.fixture.test.ts took');
    expect(output.text()).toContain('heavy-import.fixture.test.ts took');
    expect(output.text()).not.toContain('quick.fixture.test.ts took');
    expect(output.text()).not.toContain('quick.fixture.test.ts still running');
    expect(code).toBe(FAILED_EXIT_CODE);
  });

  it('lets a run pass when every file is inside the budget', async () => {
    const { dir, config } = writeFixture({ 'quick.fixture.test.ts': PASSING_TEST }, BUDGET_MS);
    const child = startVitest(dir, config);
    const output = collect(child);

    const code = await exitCodeOf(child);

    expect(output.text()).not.toContain('took');
    expect(code).toBe(0);
  });

  it('names a file that has not finished after the budget, while it is still running', async () => {
    const { dir, config } = writeFixture({ 'hung.fixture.test.ts': HUNG_TEST }, HUNG_BUDGET_MS);
    const child = startVitest(dir, config);
    const output = collect(child);
    try {
      await waitForOutput(child, output.text, 'hung.fixture.test.ts still running');
      await pause(REPEAT_POLLS * POLL_MS);
    } finally {
      child.kill('SIGKILL');
      await exitCodeOf(child);
    }

    const notices =
      output.text().match(/hung\.fixture\.test\.ts still running after (\d+)ms/g) ?? [];
    expect(notices).toHaveLength(1);
    expect(Number(notices[0]?.match(/after (\d+)ms/)?.[1])).toBeGreaterThanOrEqual(HUNG_BUDGET_MS);
  });

  it('names a file whose import never settles, which no test has started', async () => {
    const { dir, config } = writeFixture(
      { 'hung-import.fixture.test.ts': HUNG_IMPORT_TEST },
      HUNG_BUDGET_MS,
    );
    const child = startVitest(dir, config);
    const output = collect(child);
    try {
      await waitForOutput(child, output.text, 'hung-import.fixture.test.ts still running');
    } finally {
      child.kill('SIGKILL');
      await exitCodeOf(child);
    }

    expect(output.text()).toMatch(/hung-import\.fixture\.test\.ts still running after \d+ms/);
  });

  it('prints the suite wall time when the run ends', async () => {
    const { dir, config } = writeFixture({ 'quick.fixture.test.ts': PASSING_TEST }, BUDGET_MS);
    const child = startVitest(dir, config);
    const output = collect(child);

    const code = await exitCodeOf(child);

    expect(output.text()).toMatch(WALL_TIME_LINE);
    expect(code).toBe(0);
  });

  it('annotates a slow suite in CI without failing the run', async () => {
    const { dir, config } = writeFixture(
      { 'quick.fixture.test.ts': PASSING_TEST },
      { budgetMs: BUDGET_MS, suiteWarnMs: ANY_WARN_MS, annotate: true },
    );
    const child = startVitest(dir, config);
    const output = collect(child);

    const code = await exitCodeOf(child);

    expect(output.text()).toContain('::warning::');
    expect(code).toBe(0);
  });

  it('stays silent about wall time outside CI and under the threshold', async () => {
    const outsideCi = writeFixture(
      { 'quick.fixture.test.ts': PASSING_TEST },
      { budgetMs: BUDGET_MS, suiteWarnMs: ANY_WARN_MS, annotate: false },
    );
    const underThreshold = writeFixture(
      { 'quick.fixture.test.ts': PASSING_TEST },
      { budgetMs: BUDGET_MS, suiteWarnMs: UNREACHABLE_WARN_MS, annotate: true },
    );
    const first = startVitest(outsideCi.dir, outsideCi.config);
    const firstOutput = collect(first);
    const second = startVitest(underThreshold.dir, underThreshold.config);
    const secondOutput = collect(second);

    await Promise.all([exitCodeOf(first), exitCodeOf(second)]);

    expect(firstOutput.text()).not.toContain('::warning::');
    expect(secondOutput.text()).not.toContain('::warning::');
  });

  it('sets the warning threshold at the unit step limit divided by the slowest runner ratio seen', () => {
    const step = workflow.jobs.test?.steps.find((candidate) => candidate.name === 'Unit tests');
    const limitMs = (step?.['timeout-minutes'] ?? 0) * MINUTE_MS;

    expect(Math.abs(SUITE_WARN_MS - limitMs / SLOWEST_RUNNER_RATIO)).toBeLessThan(SECOND_MS);
  });

  it('gives the unit test step its own timeout, below the job, so a stall fails the step and the coverage upload still runs', () => {
    const job = workflow.jobs.test;
    const step = job?.steps.find((candidate) => candidate.name === 'Unit tests');

    expect(step?.['timeout-minutes']).toBeTypeOf('number');
    expect(step?.['timeout-minutes'] ?? Number.POSITIVE_INFINITY).toBeLessThan(
      job?.['timeout-minutes'] ?? 0,
    );
  });
});

describe('a reporter that sees a second run in one process', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  function fakeModule(id: string, totalMs: number): TestModule {
    return {
      moduleId: id,
      relativeModuleId: id,
      diagnostic: () => ({
        environmentSetupDuration: 0,
        prepareDuration: 0,
        collectDuration: 0,
        setupDuration: 0,
        duration: totalMs,
      }),
    } as unknown as TestModule;
  }

  function newReporter(): FileBudgetReporter {
    return new FileBudgetReporter({
      budgetMs: FAKE_BUDGET_MS,
      pollMs: FAKE_POLL_MS,
      suiteWarnMs: UNREACHABLE_WARN_MS,
      annotate: false,
    });
  }

  it('forgets the files a previous run found over budget, so the second run does not fail', () => {
    const written = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const reporter = newReporter();
    reporter.onTestRunStart();
    reporter.onTestModuleEnd(fakeModule('slow.test.ts', FAKE_BUDGET_MS * 2));
    reporter.onTestRunEnd();
    process.exitCode = undefined;
    written.mockClear();

    reporter.onTestRunStart();
    reporter.onTestRunEnd();

    expect(written).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('names a stalled file again in the second run and forgets a file that never ended', () => {
    vi.useFakeTimers();
    const written = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const reporter = newReporter();
    reporter.onTestRunStart();
    reporter.onTestModuleQueued(fakeModule('again.test.ts', 0));
    reporter.onTestModuleQueued(fakeModule('abandoned.test.ts', 0));
    vi.advanceTimersByTime(FAKE_ADVANCE_MS);
    reporter.onTestRunEnd();
    written.mockClear();

    reporter.onTestRunStart();
    reporter.onTestModuleQueued(fakeModule('again.test.ts', 0));
    vi.advanceTimersByTime(FAKE_ADVANCE_MS);
    reporter.onTestRunEnd();

    const lines = written.mock.calls.map(([chunk]) => String(chunk));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('again.test.ts still running');
  });
});
