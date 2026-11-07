import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  ACTION_CLASSES,
  actionName,
  BUILD_COMMAND,
  CONTAINER_ROOT,
  EXIT,
  HOST_MOUNT,
  JOB_POLICIES,
  PLAYWRIGHT_IMAGE,
  PLAYWRIGHT_IMAGE_SUFFIX,
  POLICY_REASONS,
  SESSION_OWNER_LABEL,
  VERCEL_CLI_VERSION,
} from './ci-predict-policy';
import { shellCommand } from './ci-predict-process';
import {
  conditionHolds,
  type ExprContext,
  type ExprFunctions,
  type ExprObject,
  interpolate,
  UnsupportedExpressionError,
  type Workflow,
  type WorkflowJob,
  type WorkflowStep,
} from './ci-workflow';

export interface ExecRequest {
  cmd: string;
  env: Record<string, string>;
  label: string;
  shell?: string | undefined;
  cwd?: string | undefined;
}
export interface ExecResult {
  code: number;
  output: string;
  dry?: boolean;
}
export interface ServerUrls {
  hostUrl: string;
  containerUrl: string;
}
export interface PlaywrightRequest {
  args: string[];
  env: Record<string, string>;
  project: string | undefined;
  label: string;
  server: ServerUrls;
}
export interface Deps {
  exec(request: ExecRequest): Promise<ExecResult>;
  playwright(request: PlaywrightRequest): Promise<ExecResult>;
  ensureServer(env: Record<string, string>): Promise<ServerUrls>;
  commandExists(name: string): boolean;
  anyFileMatches(pattern: string): boolean;
  now(): number;
}
export interface RunContext {
  workflow: Workflow;
  github: { baseSha: string; headSha: string; branch: string; repository: string };
  options: {
    full: boolean;
    linux: boolean;
    skipBuild: boolean;
    evalLive: boolean;
    keepGoing: boolean;
    repeat: number;
    dryRun: boolean;
    stamp: { valid: boolean; reason: string };
  };
  changedFiles: string[];
  specProjects: Map<string, Set<string>>;
  specSources: Map<string, string>;
  evalRun: { linkedCheckout: string; workdir: string } | null;
}
export type Verdict = 'pass' | 'fail' | 'not-run' | 'skipped' | 'partial' | 'would-run';
export interface Row {
  job: string;
  verdict: Verdict;
  why: string;
  ms: number;
  detail?: string;
}
export interface Judgement {
  code: number;
  headline: string;
}
export interface Prediction {
  rows: Row[];
  notes: string[];
  failed: boolean;
  outcome: Judgement;
}

const MS_PER_SECOND = 1000;
const KEY_SEPARATOR = '\u0000';
const EVENT_NAME = 'pull_request';
const CI_ENV: Record<string, string> = { CI: 'true' };
const SERVER_COMMAND = /^pnpm start\b/;
const WAIT_COMMAND = /\bwait-on\b/;
const PLAYWRIGHT_COMMAND = /^pnpm playwright test\b/;
const LHCI_COMMAND = /^pnpm lhci\b/;
const BROWSER_INSTALL_COMMAND = /install-playwright-browsers/;
const ELEVATED_COMMAND = /\bsudo\b/;
const EVAL_COMMAND = /\bask:eval\b/;
const LOCAL_TOOLS = ['gitleaks'];
const NEGATION = '!';
const PROJECT_FLAG = '--project=';
const RETRIES_FLAG = '--retries=0';
const REPEAT_FLAG = '--repeat-each=';
const GITHUB_TOKEN_REFERENCE = /secrets\.GITHUB_TOKEN/;
const SHELL_OPERATORS = /[|&;<>]/;
const PAGE_SPEC_ROOT = 'tests/';
const VISUAL_ROOT = 'tests/visual';
const COMPONENT_ROOTS = /^(components|app|design-system)\//;
const E2E_SUFFIX = '.e2e.ts';
const PLAYWRIGHT_CONFIG = 'playwright.config.ts';
const PNPM_STORE_VOLUME = 'ci-predict-pnpm-store';
const PNPM_STORE_PATH = '/pnpm-store';

export function selectSpecs(
  changed: string[],
  specProjects: Map<string, Set<string>>,
  specSources: Map<string, string>,
): string[] {
  const specs = [...specProjects.keys()];
  if (changed.includes(PLAYWRIGHT_CONFIG)) return specs;
  const selected = new Set<string>();
  for (const file of changed) {
    if (specProjects.has(file)) {
      selected.add(file);
      continue;
    }
    if (COMPONENT_ROOTS.test(file)) {
      for (const spec of specs) {
        if (spec.endsWith(E2E_SUFFIX) && dirname(spec) === dirname(file)) selected.add(spec);
      }
    }
    if (file.startsWith(PAGE_SPEC_ROOT)) {
      const stem = basename(file).replace(/\.[^.]+$/, '');
      const importer = new RegExp(
        `['"/]${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.\\w+)?['"]`,
      );
      for (const [spec, source] of specSources) {
        if (importer.test(source)) selected.add(spec);
      }
    }
  }
  return [...selected];
}

export const linuxImage = (version: string): string =>
  `${PLAYWRIGHT_IMAGE}:v${version}-${PLAYWRIGHT_IMAGE_SUFFIX}`;

export function dockerSessionArgs(options: {
  name: string;
  root: string;
  version: string;
  owner: number;
}): string[] {
  return [
    'run',
    '-d',
    '--rm',
    '--name',
    options.name,
    '--label',
    `${SESSION_OWNER_LABEL}=${options.owner}`,
    '--init',
    '--ipc=host',
    '-v',
    `${options.root}:${HOST_MOUNT}:ro`,
    '-v',
    `${PNPM_STORE_VOLUME}:${PNPM_STORE_PATH}`,
    '-w',
    CONTAINER_ROOT,
    linuxImage(options.version),
    'sleep',
    'infinity',
  ];
}

export function dockerExecPlaywrightArgs(options: {
  name: string;
  baseUrl: string;
  args: string[];
  env: Record<string, string>;
}): string[] {
  const forwarded = { ...options.env, CI: 'true', E2E_BASE_URL: options.baseUrl };
  return [
    'exec',
    '-w',
    CONTAINER_ROOT,
    ...Object.entries(forwarded).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    options.name,
    'node',
    'node_modules/playwright/cli.js',
    'test',
    ...options.args,
  ];
}

export function evalCommand(options: {
  linkedCheckout: string;
  workdir: string;
  command?: string;
}): string {
  const command = options.command ?? 'pnpm ask:eval';
  const cli = `cd '${options.linkedCheckout}' && npx -y vercel@${VERCEL_CLI_VERSION} env run --`;
  if (options.workdir === options.linkedCheckout) return `${cli} ${command}`;
  return `${cli} sh -c "cd '${options.workdir}' && ${command}"`;
}

export function summaryTable(rows: Row[]): string {
  const width = (pick: (row: Row) => string, head: string) =>
    Math.max(head.length, ...rows.map((row) => pick(row).length));
  const jobWidth = width((r) => r.job, 'CI job');
  const verdictWidth = width((r) => r.verdict, 'result');
  const timeOf = (r: Row) => (r.ms > 0 ? `${(r.ms / MS_PER_SECOND).toFixed(1)}s` : '-');
  const timeWidth = width(timeOf, 'time');
  const line = (job: string, verdict: string, time: string, why: string) =>
    `${job.padEnd(jobWidth)}  ${verdict.padEnd(verdictWidth)}  ${time.padStart(timeWidth)}  ${why}`;
  return [
    line('CI job', 'result', 'time', 'why'),
    line('-'.repeat(jobWidth), '-'.repeat(verdictWidth), '-'.repeat(timeWidth), '---'),
    ...rows.map((r) => line(r.job, r.verdict, timeOf(r), r.why)),
  ].join('\n');
}

type StepAction =
  | { kind: 'skip'; reason: string }
  | { kind: 'publish' }
  | { kind: 'substitute'; reason: string }
  | { kind: 'unreproducible'; reason: string }
  | { kind: 'server'; env: Record<string, string> }
  | { kind: 'playwright'; tokens: string[]; env: Record<string, string> }
  | { kind: 'eval'; command: string }
  | {
      kind: 'run';
      cmd: string;
      env: Record<string, string>;
      shell: string | undefined;
      cwd: string | undefined;
      note?: string;
    };

function resolveEnv(
  layer: Record<string, string>,
  ctx: ExprContext,
  into: Record<string, string>,
): Record<string, string> {
  const resolved = { ...into };
  for (const [key, value] of Object.entries(layer)) {
    resolved[key] = interpolate(value, {
      ...ctx,
      env: { ...(ctx.env as ExprObject), ...resolved },
    });
  }
  return resolved;
}

function classifyStep(
  step: WorkflowStep,
  job: WorkflowJob,
  ctx: ExprContext,
  context: RunContext,
  deps: Deps,
  jobEnv: Record<string, string>,
): StepAction {
  if (step.uses !== undefined) {
    const kind = ACTION_CLASSES[actionName(step.uses)];
    if (kind === 'infra') return { kind: 'skip', reason: 'runner setup' };
    if (kind === 'publish') return { kind: 'publish' };
    return { kind: 'unreproducible', reason: `${actionName(step.uses)} needs GitHub` };
  }
  const label = step.name ?? step.run?.split('\n')[0] ?? 'step';
  if (step.run === undefined) return { kind: 'skip', reason: 'no command' };
  if (Object.values(step.env).some((value) => GITHUB_TOKEN_REFERENCE.test(value))) {
    return { kind: 'unreproducible', reason: `${label} needs the GitHub API` };
  }
  let cmd: string;
  let env: Record<string, string>;
  try {
    cmd = interpolate(step.run, ctx);
    env = resolveEnv(step.env, ctx, jobEnv);
  } catch (error) {
    return { kind: 'unreproducible', reason: `${label}: ${(error as Error).message}` };
  }
  const trimmed = cmd.trim();
  if (EVAL_COMMAND.test(trimmed)) return { kind: 'eval', command: trimmed };
  if (SERVER_COMMAND.test(trimmed)) return { kind: 'server', env };
  if (WAIT_COMMAND.test(trimmed)) return { kind: 'skip', reason: 'server readiness awaited' };
  if (LHCI_COMMAND.test(trimmed)) {
    return {
      kind: 'unreproducible',
      reason: 'Lighthouse scores depend on the host (pnpm gates:runtime)',
    };
  }
  if (ELEVATED_COMMAND.test(trimmed)) {
    const tool = LOCAL_TOOLS.find((name) => new RegExp(`\\b${name}\\b`).test(trimmed));
    if (tool === undefined) {
      return { kind: 'unreproducible', reason: `${label} needs elevated privileges` };
    }
    return deps.commandExists(tool)
      ? { kind: 'substitute', reason: `local ${tool} used instead of the pinned install` }
      : { kind: 'unreproducible', reason: `${tool} is not installed locally` };
  }
  if (BROWSER_INSTALL_COMMAND.test(trimmed) && context.options.linux) {
    return { kind: 'skip', reason: 'browsers ship in the Linux image' };
  }
  if (trimmed === BUILD_COMMAND && context.options.skipBuild) {
    return context.options.stamp.valid
      ? { kind: 'skip', reason: 'reusing the .next built for this exact tree (--skip-build)' }
      : {
          kind: 'unreproducible',
          reason: `build reused unverified: ${context.options.stamp.reason}`,
        };
  }
  if (PLAYWRIGHT_COMMAND.test(trimmed) && !SHELL_OPERATORS.test(trimmed)) {
    const tokens = trimmed.split(/\s+/).slice(3);
    if (!context.options.linux && tokens.some((token) => token.startsWith(VISUAL_ROOT))) {
      return {
        kind: 'unreproducible',
        reason: 'CI gates the Linux visual baselines (use --linux)',
      };
    }
    return { kind: 'playwright', tokens, env };
  }
  const missing = LOCAL_TOOLS.find(
    (tool) => new RegExp(`\\b${tool}\\b`).test(trimmed) && !deps.commandExists(tool),
  );
  if (missing !== undefined) {
    return { kind: 'unreproducible', reason: `${missing} is not installed locally` };
  }
  const shell = step.shell ?? job.defaults.shell ?? context.workflow.defaults.shell;
  if (shellCommand(shell, '') === undefined) {
    return { kind: 'unreproducible', reason: `${label}: shell ${shell} is not reproducible` };
  }
  return {
    kind: 'run',
    cmd,
    env,
    shell,
    cwd:
      step.workingDirectory ??
      job.defaults.workingDirectory ??
      context.workflow.defaults.workingDirectory,
  };
}

const touchesChanged = (positionals: string[], changed: string[]): boolean =>
  positionals.some((target) =>
    changed.some(
      (file) => file === target || file.startsWith(target.endsWith('/') ? target : `${target}/`),
    ),
  );

function parseOutputs(path: string): Record<string, string> {
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) out[line.slice(0, at)] = line.slice(at + 1);
  }
  return out;
}

interface JobOutcome {
  result: 'success' | 'failure' | 'skipped' | 'not-run' | 'blocked';
  outputs: Record<string, string>;
}

const LIST_SEPARATOR = ', ';

export function judge(rows: Row[], dryRun: boolean): Judgement {
  if (rows.some((row) => row.verdict === 'fail')) {
    return { code: EXIT.FAILED, headline: 'PREDICTED CI: FAIL' };
  }
  if (dryRun || rows.some((row) => row.verdict === 'would-run')) {
    return {
      code: EXIT.DRY_RUN,
      headline: 'DRY RUN: nothing was executed, so there is no prediction',
    };
  }
  if (!rows.some((row) => row.verdict === 'pass')) {
    return { code: EXIT.NOT_VERIFIED, headline: 'PREDICTED CI: NOT VERIFIED, nothing ran' };
  }
  const githubOnly = Object.entries(JOB_POLICIES)
    .filter(([, policy]) => policy === 'github-only' || policy === 'report-only')
    .map(([id]) => id);
  const unrun = rows.filter((row) => row.verdict === 'partial' || row.verdict === 'not-run');
  const unverified = unrun.filter((row) => !githubOnly.includes(row.job)).map((row) => row.job);
  const elsewhere = unrun.filter((row) => githubOnly.includes(row.job)).map((row) => row.job);
  const elsewhereNote =
    elsewhere.length > 0
      ? ` (GitHub only, not reproducible here: ${elsewhere.join(LIST_SEPARATOR)})`
      : '';
  if (unverified.length > 0) {
    return {
      code: EXIT.NOT_VERIFIED,
      headline: `PREDICTED CI: no failure found in what ran. NOT VERIFIED: ${unverified.join(LIST_SEPARATOR)}${elsewhereNote}`,
    };
  }
  return { code: EXIT.OK, headline: `PREDICTED CI: no failure found${elsewhereNote}` };
}

export async function predict(context: RunContext, deps: Deps): Promise<Prediction> {
  const { workflow, github, options } = context;
  const scratch = mkdtempSync(join(tmpdir(), 'ci-predict-'));
  const rows: Row[] = [];
  const notes: string[] = [];
  const outcomes = new Map<string, JobOutcome>();
  const shared = new Map<string, ExecResult>();
  let server: ServerUrls | undefined;
  let fileCounter = 0;

  const base = (job: WorkflowJob, extra: ExprObject): ExprContext => ({
    github: {
      event_name: EVENT_NAME,
      repository: github.repository,
      ref_name: github.branch,
      head_ref: github.branch,
      sha: github.headSha,
      event: {
        pull_request: {
          base: { sha: github.baseSha },
          head: { sha: github.headSha, repo: { full_name: github.repository } },
        },
      },
    },
    needs: Object.fromEntries(
      job.needs.map((id) => {
        const outcome = outcomes.get(id);
        const result =
          outcome?.result === 'failure' && options.keepGoing ? 'success' : outcome?.result;
        return [
          id,
          {
            result: result === 'not-run' ? 'skipped' : (result ?? 'skipped'),
            outputs: outcome?.outputs ?? {},
          },
        ];
      }),
    ),
    inputs: { update_visual_baselines: 'false' },
    ...extra,
  });

  const functions: ExprFunctions = {
    hashFiles: (patterns) => {
      const negated = patterns.map(String).filter((pattern) => pattern.startsWith(NEGATION));
      if (negated.length > 0) {
        throw new UnsupportedExpressionError(`hashFiles(${negated.join(', ')}) negates a pattern`);
      }
      return patterns.some((pattern) => deps.anyFileMatches(String(pattern))) ? 'present' : '';
    },
  };

  const selected = options.full
    ? null
    : new Set(selectSpecs(context.changedFiles, context.specProjects, context.specSources));

  const functionalScope = (job: WorkflowJob, project: string | undefined): string[] => {
    const ctx = base(job, {
      matrix: { project: project ?? '' },
      steps: {},
      env: {},
      strategy: { 'job-total': job.matrixProjects.length || 1, 'job-index': 0 },
    });
    for (const step of job.steps) {
      if (step.run === undefined || !PLAYWRIGHT_COMMAND.test(step.run.trim())) continue;
      if (!conditionHolds(step.if, ctx, functions)) continue;
      return interpolate(step.run, ctx)
        .trim()
        .split(/\s+/)
        .slice(3)
        .filter((token) => !token.startsWith('--'));
    }
    return [];
  };

  async function runUnit(
    job: WorkflowJob,
    project: string | undefined,
    index: number,
  ): Promise<{ row: Row; steps: ExprObject }> {
    const name = project === undefined ? job.id : `${job.id} (${project})`;
    const started = deps.now();
    const steps: ExprObject = {};
    const finish = (verdict: Verdict, why: string, detail?: string) => ({
      steps,
      row: {
        job: name,
        verdict,
        why,
        ms: deps.now() - started,
        ...(detail === undefined ? {} : { detail }),
      } satisfies Row,
    });
    const policy = JOB_POLICIES[job.id];
    const scope = policy === 'e2e-narrowed' ? functionalScope(job, project) : [];
    const narrowed = (candidate: string | undefined): string[] =>
      selected === null
        ? []
        : [...selected].filter(
            (spec) =>
              (candidate === undefined || context.specProjects.get(spec)?.has(candidate)) &&
              (scope.length === 0 || scope.some((root) => spec.startsWith(root))),
          );
    if (policy === 'e2e-narrowed' && selected !== null && project !== undefined) {
      if (narrowed(project).length === 0) {
        return finish(
          'not-run',
          'no changed spec runs on this project (add --full for the whole suite)',
        );
      }
    }
    const runEnv: Record<string, string> = {};
    let jobEnv: Record<string, string>;
    try {
      const unitCtx = base(job, {
        matrix: { project: project ?? '' },
        steps: {},
        env: {},
        strategy: { 'job-total': job.matrixProjects.length || 1, 'job-index': index },
      });
      jobEnv = resolveEnv(job.env, unitCtx, resolveEnv(workflow.env, unitCtx, {}));
    } catch (error) {
      return finish('not-run', `env: ${(error as Error).message}`);
    }
    const unreproducible: string[] = [];
    const substituted: string[] = [];
    const tolerated: string[] = [];
    let published = 0;
    let ran = 0;
    let dry = 0;
    let partialSuite = false;
    for (const step of job.steps) {
      const ctx = base(job, {
        matrix: { project: project ?? '' },
        steps,
        env: { ...jobEnv, ...runEnv },
        strategy: { 'job-total': job.matrixProjects.length || 1, 'job-index': index },
      });
      let applies: boolean;
      try {
        applies = conditionHolds(step.if, ctx, functions);
      } catch (error) {
        unreproducible.push(`${step.name ?? 'step'}: ${(error as Error).message}`);
        continue;
      }
      if (!applies) continue;
      const action = classifyStep(step, job, ctx, context, deps, jobEnv);
      const label = `${name} > ${step.name ?? step.run?.split('\n')[0] ?? 'step'}`;
      if (action.kind === 'skip') continue;
      if (action.kind === 'publish') {
        published += 1;
        continue;
      }
      if (action.kind === 'substitute') {
        substituted.push(action.reason);
        continue;
      }
      if (action.kind === 'unreproducible') {
        unreproducible.push(action.reason);
        continue;
      }
      if (action.kind === 'eval') continue;
      const env = { ...CI_ENV, ...runEnv, ...action.env };
      if (action.kind === 'server') {
        if (options.skipBuild && !options.stamp.valid) {
          unreproducible.push(`the server runs an unverified build: ${options.stamp.reason}`);
        }
        try {
          server = await deps.ensureServer(env);
        } catch (error) {
          return finish('fail', (error as Error).message);
        }
        continue;
      }
      if (action.kind === 'playwright') {
        if (server === undefined)
          return finish('fail', `${step.name ?? 'playwright'} ran before any server started`);
        const flags = action.tokens.filter((t) => t.startsWith('--'));
        const positionals = action.tokens.filter((t) => !t.startsWith('--'));
        const projectFlag = flags.find((f) => f.startsWith(PROJECT_FLAG));
        const stepProject = projectFlag?.slice(PROJECT_FLAG.length);
        const kept = flags.filter((f) => !f.startsWith('--retries') && !f.startsWith(REPEAT_FLAG));
        const isNarrowed = policy === 'e2e-narrowed' && selected !== null;
        const targets = isNarrowed ? narrowed(stepProject) : positionals;
        if (isNarrowed && targets.length === 0) {
          unreproducible.push(
            `${step.name ?? 'playwright'}: no changed spec runs on ${stepProject ?? 'this project'}`,
          );
          continue;
        }
        if (isNarrowed) partialSuite = true;
        const repeated =
          policy === 'e2e-narrowed' || touchesChanged(positionals, context.changedFiles);
        const args = [
          ...kept,
          ...targets,
          RETRIES_FLAG,
          ...(repeated ? [`${REPEAT_FLAG}${options.repeat}`] : []),
        ];
        const result = await deps.playwright({
          args,
          env: { ...env, E2E_BASE_URL: server.hostUrl },
          project: stepProject,
          label,
          server,
        });
        if (result.dry === true) dry += 1;
        else ran += 1;
        if (result.code !== 0)
          return finish(
            'fail',
            `${step.name ?? 'playwright'} exited ${result.code}`,
            result.output,
          );
        continue;
      }
      fileCounter += 1;
      const outputFile = join(scratch, `${fileCounter}.out`);
      const envFile = join(scratch, `${fileCounter}.env`);
      writeFileSync(outputFile, '');
      writeFileSync(envFile, '');
      const dedupeKey =
        step.id === undefined
          ? `${action.cmd}${KEY_SEPARATOR}${JSON.stringify(step.env)}${KEY_SEPARATOR}${action.cwd ?? ''}${KEY_SEPARATOR}${action.shell ?? ''}`
          : undefined;
      let result = dedupeKey === undefined ? undefined : shared.get(dedupeKey);
      if (result === undefined) {
        result = await deps.exec({
          cmd: action.cmd,
          env: { ...env, GITHUB_OUTPUT: outputFile, GITHUB_ENV: envFile },
          label,
          shell: action.shell,
          cwd: action.cwd,
        });
        if (dedupeKey !== undefined) shared.set(dedupeKey, result);
      }
      if (result.dry === true) dry += 1;
      else ran += 1;
      Object.assign(runEnv, parseOutputs(envFile));
      if (step.id !== undefined) steps[step.id] = { outputs: parseOutputs(outputFile) };
      if (result.code !== 0) {
        if (step.continueOnError) {
          tolerated.push(`${step.name ?? action.cmd.trim()} failed under continue-on-error`);
          continue;
        }
        return finish(
          'fail',
          `${step.name ?? action.cmd.trim()} exited ${result.code}`,
          result.output,
        );
      }
    }
    const noted = [
      ...(unreproducible.length > 0
        ? [`not reproducible: ${[...new Set(unreproducible)].join('; ')}`]
        : []),
      ...(partialSuite ? ['narrowed to the changed specs; CI runs the whole suite (--full)'] : []),
      ...(substituted.length > 0 ? [[...new Set(substituted)].join('; ')] : []),
      ...(tolerated.length > 0 ? [tolerated.join('; ')] : []),
      ...(published > 0 ? [`${published} GitHub-only publish step(s) skipped`] : []),
    ];
    const suffix = noted.length > 0 ? `; ${noted.join('; ')}` : '';
    if (dry > 0) return finish('would-run', `${dry} step(s) would run (dry run)${suffix}`);
    if (ran === 0) return finish('not-run', `no step executed${suffix}`);
    const why = `${ran} step(s) ran${suffix}`;
    return finish(unreproducible.length > 0 || partialSuite ? 'partial' : 'pass', why);
  }

  try {
    for (const id of workflow.order) {
      const job = workflow.jobs[id];
      if (job === undefined) continue;
      const policy = JOB_POLICIES[id];
      if (policy === undefined) throw new Error(`job ${id} has no predictor policy`);
      const blockers = job.needs.filter((need) => {
        const result = outcomes.get(need)?.result;
        return result === 'failure' || result === 'blocked';
      });
      if (blockers.length > 0 && !options.keepGoing && policy !== 'gate') {
        rows.push({
          job: id,
          verdict: 'not-run',
          why: `needs ${blockers.join(', ')} which failed`,
          ms: 0,
        });
        outcomes.set(id, { result: 'blocked', outputs: {} });
        continue;
      }
      if (policy === 'github-only' || policy === 'report-only') {
        rows.push({ job: id, verdict: 'not-run', why: POLICY_REASONS[policy], ms: 0 });
        outcomes.set(id, { result: 'not-run', outputs: {} });
        continue;
      }
      if (policy === 'gate') {
        const upstream = rows.filter((row) =>
          job.needs.some((need) => row.job === need || row.job.startsWith(`${need} (`)),
        );
        const failedJobs = upstream.filter((row) => row.verdict === 'fail').map((row) => row.job);
        const unrun = upstream
          .filter((row) => row.verdict === 'not-run' || row.verdict === 'partial')
          .map((row) => row.job);
        const planned = upstream.filter((row) => row.verdict === 'would-run');
        const verdict: Verdict =
          failedJobs.length > 0
            ? 'fail'
            : planned.length > 0
              ? 'would-run'
              : unrun.length > 0
                ? 'partial'
                : 'pass';
        const why =
          failedJobs.length > 0
            ? `blocked by ${failedJobs.join(', ')}`
            : planned.length > 0
              ? `${planned.length} job(s) would run (dry run)`
              : unrun.length > 0
                ? `${unrun.length} job(s) not fully reproduced locally`
                : 'every upstream job passed or was skipped by paths';
        rows.push({ job: id, verdict, why, ms: 0 });
        outcomes.set(id, { result: failedJobs.length > 0 ? 'failure' : 'success', outputs: {} });
        continue;
      }
      let enabled: boolean;
      try {
        enabled = conditionHolds(job.if, base(job, {}), functions);
      } catch (error) {
        rows.push({ job: id, verdict: 'not-run', why: (error as Error).message, ms: 0 });
        outcomes.set(id, { result: 'not-run', outputs: {} });
        continue;
      }
      if (!enabled) {
        const detect = outcomes.get('detect-changes')?.outputs ?? {};
        const flags = Object.entries(detect)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ');
        rows.push({
          job: id,
          verdict: 'skipped',
          why: `its if is false (detect-changes ${flags})`,
          ms: 0,
        });
        outcomes.set(id, { result: 'skipped', outputs: {} });
        continue;
      }
      if (policy === 'ai-eval') {
        const evalStep = job.steps.find(
          (step) => step.run !== undefined && EVAL_COMMAND.test(step.run),
        );
        const command = evalStep?.run?.trim() ?? 'pnpm ask:eval';
        if (!options.evalLive || context.evalRun === null) {
          const full =
            context.evalRun === null ? command : evalCommand({ ...context.evalRun, command });
          notes.push(`ai paths changed. Live eval: ${full}`);
          rows.push({
            job: id,
            verdict: 'not-run',
            why: options.evalLive
              ? 'no Vercel-linked checkout found'
              : 'needs the linked env (pass --eval to run it)',
            ms: 0,
          });
          outcomes.set(id, { result: 'not-run', outputs: {} });
          continue;
        }
        const started = deps.now();
        const result = await deps.exec({
          cmd: evalCommand({ ...context.evalRun, command }),
          env: { ...CI_ENV },
          label: `${id} > ask:eval`,
        });
        rows.push({
          job: id,
          verdict: result.code === 0 ? 'pass' : 'fail',
          why: result.code === 0 ? 'live eval passed' : `ask:eval exited ${result.code}`,
          ms: deps.now() - started,
          ...(result.code === 0 ? {} : { detail: result.output }),
        });
        outcomes.set(id, { result: result.code === 0 ? 'success' : 'failure', outputs: {} });
        continue;
      }
      const projects: (string | undefined)[] =
        job.matrixProjects.length > 0 ? job.matrixProjects : [undefined];
      let jobFailed = false;
      let lastSteps: ExprObject = {};
      for (const [index, project] of projects.entries()) {
        const unit = await runUnit(job, project, index);
        rows.push(unit.row);
        if (unit.row.verdict === 'fail') jobFailed = true;
        lastSteps = unit.steps;
      }
      const outputs = Object.fromEntries(
        Object.entries(job.outputs).map(([key, template]) => [
          key,
          interpolate(template, { steps: lastSteps }),
        ]),
      );
      outcomes.set(id, { result: jobFailed ? 'failure' : 'success', outputs });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return {
    rows,
    notes,
    failed: rows.some((row) => row.verdict === 'fail'),
    outcome: judge(rows, options.dryRun),
  };
}
