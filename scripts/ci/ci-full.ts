import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT, exitCode, parseArgs, renderTable, runStages } from './ci-full-run';
import {
  commandText,
  LINUX_NOT_RUN,
  LINUX_STAGE_PREFIX,
  LINUX_STAGES,
  linuxStages,
  NOT_RUN,
  SERVER,
  STAGES,
  type Stage,
} from './ci-full-stages';
import { parseWorkflow, workflowEnvFor } from './ci-workflow';

const HELP = `pnpm ci:full [--base <ref>] [--from <stage>] [--only <stages>] [--keep-going] [--list] [--linux[=gate|changed|all]]

Runs every check CI runs, one stage at a time, on this machine, and prints a table of
passed, failed and not-run stages with their durations.

  --base <ref>    commit range origin/main..HEAD for commitlint (default origin/main)
  --from <stage>  resume at a stage; the stages before it are reported not-run
  --only <stages> run only these stages, comma separated; the others are reported not-run
  --keep-going    continue after a failed stage (default: stop at the first failure)
  --list          print the stages and the declared not-run checks, run nothing
  --linux[=scope] add the Linux e2e stages: WebKit and Chromium in the CI Playwright image on Docker.
                  gate: the specs that failed on Linux before; changed (default for a bare --linux):
                  the gate plus the specs changed since the merge base; all: the full CI matrix.
                  Needs Docker. Without --linux the Linux stages are declared not-run.

Exit code: 0 every stage passed; 1 a stage failed; 2 bad arguments; 3 no failure, but a stage did not run.`;

const err = (line: string): void => {
  process.stderr.write(`${line}\n`);
};
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const CI_WORKFLOW_FILE = '.github/workflows/ci.yml';

const loadWorkflow = (root: string) =>
  parseWorkflow(readFileSync(join(root, CI_WORKFLOW_FILE), 'utf8'));

function listStages(base: string, stages: readonly Stage[], notRun: typeof NOT_RUN): void {
  const workflow = loadWorkflow(process.cwd());
  out(`ci:full stages (base ${base}):`);
  for (const [index, stage] of stages.entries()) {
    const serves = stage.server === true ? ' [serves the build]' : '';
    const { env, notReproduced } = workflowEnvFor(workflow, stage.jobs);
    const context = {
      root: process.cwd(),
      base,
      port: null,
      origin: null,
      workDir: '<work-dir>',
      workflowEnv: env,
      listing: true,
    };
    out(`${String(index + 1).padStart(2)}. ${stage.id}  ${stage.title}${serves}`);
    out(`      ${commandText(stage.command(context))}`);
    const names = Object.keys(env);
    if (names.length > 0) out(`      workflow env: ${names.join(', ')}`);
    if (notReproduced.length > 0) out(`      not-reproduced: ${notReproduced.join(', ')}`);
  }
  out('');
  out('declared not-run:');
  for (const entry of notRun) out(`  not-run  ${entry.id}  ${entry.reason}`);
  out('');
  out('listing only: nothing was run, nothing was verified');
}

function baseExists(base: string): boolean {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).status === 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    out(HELP);
    return EXIT.OK;
  }
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(
      argv,
      [...STAGES, ...LINUX_STAGES].map((stage) => stage.id),
    );
  } catch (error) {
    err(`ci-full: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.USAGE;
  }
  const needsLinux = [args.from, ...(args.only ?? [])].find(
    (id) => id?.startsWith(LINUX_STAGE_PREFIX) === true,
  );
  if (args.linux === undefined && needsLinux !== undefined) {
    err(`ci-full: stage ${needsLinux} needs --linux`);
    return EXIT.USAGE;
  }
  const stages = args.linux === undefined ? STAGES : [...STAGES, ...linuxStages(args.linux)];
  const notRun = args.linux === undefined ? [...NOT_RUN, LINUX_NOT_RUN] : NOT_RUN;
  if (args.list) {
    listStages(args.base, stages, notRun);
    return EXIT.OK;
  }
  if (!baseExists(args.base)) {
    err(`ci-full: base ${args.base} is not a commit git knows; fetch it or pass --base <ref>`);
    return EXIT.USAGE;
  }
  const results = await runStages({
    stages,
    root: process.cwd(),
    base: args.base,
    from: args.from,
    only: args.only,
    keepGoing: args.keepGoing,
    server: SERVER,
    workflow: loadWorkflow(process.cwd()),
    log: (line) => err(`[ci-full] ${line}`),
  });
  out(`\n${renderTable(results, notRun)}`);
  return exitCode(results);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    err(`ci-full: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.FAILED);
  },
);
