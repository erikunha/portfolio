import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { isMain } from '../lib/is-main.ts';

export interface VerifyStep {
  id: string;
  command: string;
  needs: readonly string[];
}

export type Verdict = 'passed' | 'failed' | 'skipped';

export interface StepOutcome {
  id: string;
  command: string;
  verdict: Verdict;
  seconds: number;
  output: string;
}

export interface ExecResult {
  code: number;
  output: string;
}

export interface RunOptions {
  concurrency: number;
  execute: (step: VerifyStep) => Promise<ExecResult>;
  onFinish?: (outcome: StepOutcome) => void;
}

export interface VerifyArgs {
  concurrency: number;
  verbose: boolean;
}

export const DEFAULT_CONCURRENCY = 4;
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2 } as const;

const PNPM = 'pnpm';
const COMMAND_SEPARATOR = ' ';
const CONCURRENCY_ENV = 'VERIFY_CONCURRENCY';
const CONCURRENCY_FLAG = '--concurrency';
const VERBOSE_FLAG = '--verbose';
const HELP_FLAG = '--help';
const MS_PER_SECOND = 1000;
const DURATION_DIGITS = 1;
const VERDICT_WIDTH = 7;
const DURATION_WIDTH = 7;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

const gate = (script: string, needs: readonly string[] = []): VerifyStep => ({
  id: script,
  command: `${PNPM} ${script}`,
  needs,
});

export const VERIFY_STEPS: readonly VerifyStep[] = [
  gate('typecheck'),
  gate('test:coverage', ['typecheck']),
  gate('check'),
  gate('validate-content'),
  gate('check:client-naming'),
  gate('check:shell-dom-writes'),
  gate('check:css-ownership'),
  gate('check:dep-pinning'),
  gate('check:dependency-vetting'),
  gate('check:harness-size'),
  gate('check:component-docs'),
  gate('check:section-order'),
  gate('check:doc-drift'),
  gate('check:decisions-index'),
  gate('check:no-dashes'),
  gate('check:detect-changes-paths'),
  gate('check:test-integrity'),
  gate('lint:contrast'),
  gate('lint:css-tokens'),
];

export function verifyLeaves(steps: readonly VerifyStep[] = VERIFY_STEPS): string[] {
  return steps.map((entry) => entry.command);
}

function assertNeedsResolve(steps: readonly VerifyStep[]): void {
  const seen = new Set<string>();
  for (const entry of steps) {
    for (const need of entry.needs) {
      if (!seen.has(need)) {
        throw new Error(`${entry.id} waits on ${need}, which is not an earlier step`);
      }
    }
    seen.add(entry.id);
  }
}

function elapsedSeconds(startedAt: number): number {
  return (performance.now() - startedAt) / MS_PER_SECOND;
}

async function attempt(entry: VerifyStep, execute: RunOptions['execute']): Promise<StepOutcome> {
  const startedAt = performance.now();
  let result: ExecResult;
  try {
    result = await execute(entry);
  } catch (error) {
    result = { code: EXIT.FAILED, output: error instanceof Error ? error.message : String(error) };
  }
  return {
    id: entry.id,
    command: entry.command,
    verdict: result.code === 0 ? 'passed' : 'failed',
    seconds: elapsedSeconds(startedAt),
    output: result.output,
  };
}

export async function runSteps(
  steps: readonly VerifyStep[],
  options: RunOptions,
): Promise<StepOutcome[]> {
  assertNeedsResolve(steps);
  const outcomes = new Map<string, StepOutcome>();
  const pending = [...steps];
  const running = new Set<Promise<void>>();

  const settle = (outcome: StepOutcome): void => {
    outcomes.set(outcome.id, outcome);
    options.onFinish?.(outcome);
  };

  const skipBlocked = (): void => {
    for (const entry of [...pending]) {
      const blocker = entry.needs.find((need) => {
        const verdict = outcomes.get(need)?.verdict;
        return verdict === 'failed' || verdict === 'skipped';
      });
      if (blocker === undefined) continue;
      pending.splice(pending.indexOf(entry), 1);
      settle({
        id: entry.id,
        command: entry.command,
        verdict: 'skipped',
        seconds: 0,
        output: `skipped: ${blocker} did not pass`,
      });
    }
  };

  const launchReady = (): void => {
    for (const entry of [...pending]) {
      if (running.size >= options.concurrency) return;
      if (!entry.needs.every((need) => outcomes.get(need)?.verdict === 'passed')) continue;
      pending.splice(pending.indexOf(entry), 1);
      const task: Promise<void> = attempt(entry, options.execute).then((outcome) => {
        running.delete(task);
        settle(outcome);
      });
      running.add(task);
    }
  };

  while (pending.length > 0 || running.size > 0) {
    skipBlocked();
    launchReady();
    if (running.size === 0) break;
    await Promise.race(running);
  }
  return steps.flatMap((entry) => outcomes.get(entry.id) ?? []);
}

export function exitCodeFor(outcomes: readonly StepOutcome[]): number {
  return outcomes.every((outcome) => outcome.verdict === 'passed') ? EXIT.OK : EXIT.FAILED;
}

const formatSeconds = (seconds: number): string => `${seconds.toFixed(DURATION_DIGITS)}s`;

export function renderReport(
  outcomes: readonly StepOutcome[],
  options: { verbose?: boolean } = {},
): string {
  const sections = outcomes
    .filter((outcome) => outcome.verdict === 'failed' || options.verbose === true)
    .map((outcome) => `--- ${outcome.verdict} ${outcome.command} ---\n${outcome.output.trim()}`);
  const rows = outcomes.map((outcome) =>
    `${outcome.verdict.padEnd(VERDICT_WIDTH)} ${formatSeconds(outcome.seconds).padStart(DURATION_WIDTH)}  ${outcome.command}`.trimEnd(),
  );
  const count = (verdict: Verdict): number =>
    outcomes.filter((outcome) => outcome.verdict === verdict).length;
  const summary = `${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped`;
  return [...sections, [...rows, '', summary].join('\n')].join('\n\n');
}

export function parseVerifyArgs(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): VerifyArgs {
  let concurrency = env[CONCURRENCY_ENV] ?? String(DEFAULT_CONCURRENCY);
  let verbose = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === VERBOSE_FLAG) verbose = true;
    else if (flag === CONCURRENCY_FLAG) {
      index += 1;
      concurrency = argv[index] ?? '';
    } else throw new Error(`unknown argument ${String(flag)}`);
  }
  if (!POSITIVE_INTEGER.test(concurrency)) {
    throw new Error(`${CONCURRENCY_FLAG} needs a positive integer, got "${concurrency}"`);
  }
  return { concurrency: Number(concurrency), verbose };
}

function execute(entry: VerifyStep): Promise<ExecResult> {
  const [file = PNPM, ...args] = entry.command.split(COMMAND_SEPARATOR);
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({ code: code ?? EXIT.FAILED, output: Buffer.concat(chunks).toString('utf8') }),
    );
  });
}

const HELP = `pnpm verify [--concurrency <n>] [--verbose]

Runs the static gates and the unit tests with coverage in parallel and prints one table.
A step that waits on a failed step is skipped. Output of a passing step is hidden unless
--verbose is set. VERIFY_CONCURRENCY sets the default (${DEFAULT_CONCURRENCY}).

Exit code: 0 every step passed; 1 a step failed or was skipped; 2 bad arguments.`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes(HELP_FLAG)) {
    process.stdout.write(`${HELP}\n`);
    return EXIT.OK;
  }
  let args: VerifyArgs;
  try {
    args = parseVerifyArgs(argv, process.env);
  } catch (error) {
    process.stderr.write(`verify: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT.USAGE;
  }
  const outcomes = await runSteps(VERIFY_STEPS, {
    concurrency: args.concurrency,
    execute,
    onFinish: (outcome) =>
      process.stderr.write(
        `[verify] ${outcome.verdict} ${formatSeconds(outcome.seconds)} ${outcome.command}\n`,
      ),
  });
  process.stdout.write(`\n${renderReport(outcomes, { verbose: args.verbose })}\n`);
  return exitCodeFor(outcomes);
}

if (isMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`verify: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(EXIT.FAILED);
    },
  );
}
