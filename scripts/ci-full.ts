import { spawnSync } from 'node:child_process';
import { EXIT, exitCode, parseArgs, renderTable, runStages } from './lib/ci-full-run';
import { commandText, NOT_RUN, SERVER, STAGES } from './lib/ci-full-stages';

const HELP = `pnpm ci:full [--base <ref>] [--from <stage>] [--keep-going] [--list]

Runs every check CI runs, one stage at a time, on this machine, and prints a table of
passed, failed and not-run stages with their durations.

  --base <ref>    commit range origin/main..HEAD for commitlint and gitleaks (default origin/main)
  --from <stage>  resume at a stage; the stages before it are reported not-run
  --keep-going    continue after a failed stage (default: stop at the first failure)
  --list          print the stages and the declared not-run checks, run nothing

Exit code: 0 every stage passed; 1 a stage failed; 2 bad arguments; 3 no failure, but a stage did not run.`;

const err = (line: string): void => {
  process.stderr.write(`${line}\n`);
};
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function listStages(base: string): void {
  const context = { root: process.cwd(), base, port: null, origin: null, workDir: '<work-dir>' };
  out(`ci:full stages (base ${base}):`);
  for (const [index, stage] of STAGES.entries()) {
    const serves = stage.server === true ? ' [serves the build]' : '';
    out(`${String(index + 1).padStart(2)}. ${stage.id}  ${stage.title}${serves}`);
    out(`      ${commandText(stage.command(context))}`);
  }
  out('');
  out('declared not-run:');
  for (const entry of NOT_RUN) out(`  not-run  ${entry.id}  ${entry.reason}`);
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
      STAGES.map((stage) => stage.id),
    );
  } catch (error) {
    err(`ci-full: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.USAGE;
  }
  if (args.list) {
    listStages(args.base);
    return EXIT.OK;
  }
  if (!baseExists(args.base)) {
    err(`ci-full: base ${args.base} is not a commit git knows; fetch it or pass --base <ref>`);
    return EXIT.USAGE;
  }
  const results = await runStages({
    stages: STAGES,
    root: process.cwd(),
    base: args.base,
    from: args.from,
    keepGoing: args.keepGoing,
    server: SERVER,
    log: (line) => err(`[ci-full] ${line}`),
  });
  out(`\n${renderTable(results, NOT_RUN)}`);
  return exitCode(results);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    err(`ci-full: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.FAILED);
  },
);
