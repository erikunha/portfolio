import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gitText } from '../lib/git';
import {
  DEFAULT_BASE,
  type Exclusion,
  type ServerSpec,
  type Stage,
  type StageCommand,
  type StageContext,
} from './ci-full-stages';
import { ephemeralPort } from './free-port';

export type Verdict = 'passed' | 'failed' | 'not-run';

export interface StageResult {
  id: string;
  title: string;
  verdict: Verdict;
  seconds: number;
  note: string;
}

export interface RunnerOptions {
  stages: readonly Stage[];
  root: string;
  base: string;
  from?: string | undefined;
  keepGoing: boolean;
  server: ServerSpec;
  stageTimeoutMs?: number;
  readyTimeoutMs?: number;
  log: (line: string) => void;
}

export interface Args {
  base: string;
  from: string | undefined;
  keepGoing: boolean;
  list: boolean;
}

export type Stdio = 'inherit' | { log: string };

export const EXIT = { OK: 0, FAILED: 1, USAGE: 2, NOT_VERIFIED: 3 } as const;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const FAILED = 1;
const SIGNAL_EXIT_BASE = 128;
const SIGNALS: [NodeJS.Signals, number][] = [
  ['SIGHUP', 1],
  ['SIGINT', 2],
  ['SIGTERM', 15],
];
const STAGE_TIMEOUT_MS = 2 * 60 * 60 * MS_PER_SECOND;
const READY_TIMEOUT_MS = 90 * MS_PER_SECOND;
const READY_POLL_MS = 250;
const KILL_GRACE_MS = 5 * MS_PER_SECOND;
const STOP_POLL_MS = 25;
const LOCAL_ENV_FILE = /^\.env(\..+)?\.local$/;
const ENV_KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/;
const LSOF_PID_PREFIX = 'p';
const LISTENER_PID_FLAG = '-Fp';
const SERVER_ERROR_STATUS = 500;
const ERROR_EXCERPT_LINES = 20;
const MAX_ANCESTRY = 64;
const INIT_PID = 1;
const MIN_PID = 1;
const REQUEST_TIMEOUT_MS = 5 * MS_PER_SECOND;
const MIN_REQUEST_TIMEOUT_MS = 1;
const STAMP_FILE = '.next/.ci-full-stamp.json';
const BUILD_ID_FILE = '.next/BUILD_ID';
const FIELD_SEPARATOR = '\u0000';
const HASH = 'sha256';
const DURATION_MINUTE_PAD = 2;
const VERDICT_WIDTH = 8;
const DURATION_WIDTH = 7;
const TITLE_WIDTH = 46;
const ALLOWED_ENV_NAMES = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'TMPDIR',
  'TZ',
  'CI',
  'LANG',
  'COLORTERM',
  'FORCE_COLOR',
  'NO_COLOR',
  'COREPACK_HOME',
  'PNPM_HOME',
];
const ALLOWED_ENV_PREFIXES = ['LC_', 'XDG_', 'PLAYWRIGHT_'];

const active = new Set<ChildProcess>();
let cleanupInstalled = false;

const isAllowedEnvName = (name: string): boolean =>
  ALLOWED_ENV_NAMES.includes(name) ||
  ALLOWED_ENV_PREFIXES.some((prefix) => name.startsWith(prefix));

export function allowedEnv(
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const allowed: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && isAllowedEnvName(name)) allowed[name] = value;
  }
  return allowed;
}

export const isRunning = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

export const activeGroupIds = (): number[] =>
  [...active].flatMap((child) => (child.pid === undefined ? [] : [child.pid]));

export function tail(text: string, lines: number): string {
  return text.split('\n').slice(-lines).join('\n');
}

function parentMap(): Map<number, number> {
  const listing = spawnSync('ps', ['-ax', '-o', 'pid=,ppid='], { encoding: 'utf8' });
  const parents = new Map<number, number>();
  for (const line of (listing.stdout ?? '').split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (pid !== undefined && ppid !== undefined && Number.isInteger(pid)) parents.set(pid, ppid);
  }
  return parents;
}

export function descendantPids(root: number): number[] {
  const parents = parentMap();
  const found = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [pid, ppid] of parents) {
      if (!found.has(pid) && (ppid === root || found.has(ppid))) {
        found.add(pid);
        grew = true;
      }
    }
  }
  return [...found];
}

function groupMembers(group: number): number[] {
  const listing = spawnSync('ps', ['-ax', '-o', 'pid=,pgid='], { encoding: 'utf8' });
  return (listing.stdout ?? '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number))
    .flatMap(([pid, pgid]) =>
      pid !== undefined && pgid === group && Number.isInteger(pid) && pid !== group ? [pid] : [],
    );
}

export const groupAlive = (child: ChildProcess | null): boolean =>
  child?.pid !== undefined && (isRunning(child) || groupMembers(child.pid).length > 0);

function signal(pid: number, signalName: NodeJS.Signals): void {
  try {
    process.kill(pid, signalName);
    // biome-ignore lint/suspicious/noEmptyBlockStatements: the process may already be gone
  } catch {}
}

export function killGroup(
  child: ChildProcess | null,
  signalName: NodeJS.Signals = 'SIGTERM',
): void {
  if (child?.pid === undefined) return;
  const leader = child.pid;
  const leaderRunning = isRunning(child);
  const survivors = groupMembers(leader);
  if (!leaderRunning && survivors.length === 0) return;
  const roots = leaderRunning ? [leader, ...survivors] : survivors;
  for (const pid of new Set([...roots.flatMap((root) => descendantPids(root)), ...survivors])) {
    signal(pid, signalName);
  }
  try {
    process.kill(-leader, signalName);
  } catch {
    if (leaderRunning) {
      try {
        child.kill(signalName);
        // biome-ignore lint/suspicious/noEmptyBlockStatements: the child may already be gone
      } catch {}
    }
  }
}

export async function terminateGroup(
  child: ChildProcess | null,
  graceMs: number = KILL_GRACE_MS,
): Promise<void> {
  if (child === null) return;
  killGroup(child, 'SIGTERM');
  const deadline = Date.now() + graceMs;
  while (groupAlive(child) && Date.now() < deadline) await sleep(STOP_POLL_MS);
  const killDeadline = Date.now() + graceMs;
  while (groupAlive(child) && Date.now() < killDeadline) {
    killGroup(child, 'SIGKILL');
    await sleep(STOP_POLL_MS);
  }
}

export function killAllChildren(): void {
  for (const child of active) killGroup(child, 'SIGKILL');
  active.clear();
}

function installCleanup(): void {
  if (cleanupInstalled) return;
  cleanupInstalled = true;
  process.on('exit', killAllChildren);
  for (const [signal, number] of SIGNALS) {
    process.on(signal, () => process.exit(SIGNAL_EXIT_BASE + number));
  }
}

export function childEnv(
  options: {
    env: Record<string, string>;
    blank?: Record<string, string> | undefined;
    unset?: readonly string[] | undefined;
  },
  source: Record<string, string | undefined> = process.env,
): NodeJS.ProcessEnv {
  const inherited = allowedEnv(source);
  for (const name of options.unset ?? []) delete inherited[name];
  return { ...inherited, ...options.blank, ...options.env } as NodeJS.ProcessEnv;
}

export function startTracked(
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: Record<string, string>;
    blank?: Record<string, string>;
    unset?: readonly string[] | undefined;
    stdio: Stdio;
  },
): ChildProcess {
  installCleanup();
  const logFd = options.stdio === 'inherit' ? undefined : openSync(options.stdio.log, 'a');
  const env = childEnv(options);
  const child = spawn(file, args, {
    cwd: options.cwd,
    env,
    stdio: logFd === undefined ? ['ignore', 'inherit', 'inherit'] : ['ignore', logFd, logFd],
    detached: true,
  });
  if (logFd !== undefined) closeSync(logFd);
  active.add(child);
  child.on('close', () => active.delete(child));
  child.on('error', () => active.delete(child));
  return child;
}

export function envKeyNames(text: string): string[] {
  return text.split('\n').flatMap((line) => {
    const key = ENV_KEY_LINE.exec(line)?.[1];
    return key === undefined ? [] : [key];
  });
}

export function localEnvBlanks(root: string): Record<string, string> {
  const blanks: Record<string, string> = {};
  for (const file of readdirSync(root).filter((name) => LOCAL_ENV_FILE.test(name))) {
    for (const key of envKeyNames(readFileSync(join(root, file), 'utf8'))) blanks[key] = '';
  }
  return blanks;
}

function listenerPids(port: number): number[] | null {
  const listing = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', LISTENER_PID_FLAG], {
    encoding: 'utf8',
  });
  if (listing.error !== undefined) return null;
  return listing.stdout
    .split('\n')
    .filter((line) => line.startsWith(LSOF_PID_PREFIX))
    .map((line) => Number(line.slice(LSOF_PID_PREFIX.length)))
    .filter((pid) => Number.isInteger(pid) && pid >= MIN_PID);
}

function startedBy(pid: number, ancestor: number, parents: Map<number, number>): boolean {
  let current: number | undefined = pid;
  for (
    let depth = 0;
    current !== undefined && current > INIT_PID && depth < MAX_ANCESTRY;
    depth++
  ) {
    if (current === ancestor) return true;
    current = parents.get(current);
  }
  return false;
}

export async function waitForOwnServer(options: {
  url: string;
  port: number;
  child: ChildProcess;
  timeoutMs: number;
  pollMs: number;
  logPath?: string;
}): Promise<void> {
  const { child, port } = options;
  const deadline = Date.now() + options.timeoutMs;
  const excerpt = () => {
    try {
      return `\n${tail(readFileSync(options.logPath ?? '', 'utf8'), ERROR_EXCERPT_LINES)}`;
    } catch {
      return '';
    }
  };
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `the server exited with code ${child.exitCode ?? child.signalCode} before it answered on :${port}${excerpt()}`,
      );
    }
    const requestTimeoutMs = Math.max(
      MIN_REQUEST_TIMEOUT_MS,
      Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()),
    );
    const response = await fetch(options.url, {
      signal: AbortSignal.timeout(requestTimeoutMs),
    }).catch(() => null);
    if (response !== null && response.status < SERVER_ERROR_STATUS) {
      const listeners = listenerPids(port);
      if (listeners === null) {
        throw new Error(`cannot tell which process answers on :${port} (lsof is not available)`);
      }
      const parents = parentMap();
      if (
        child.pid !== undefined &&
        listeners.some((pid) => startedBy(pid, child.pid ?? 0, parents))
      )
        return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, options.pollMs));
  }
  throw new Error(
    `:${port} did not answer from the server this run started; the answering process is not the server this run started${excerpt()}`,
  );
}

interface Tree {
  head: string;
  diff: string;
  untracked: string[];
}

interface Stamp {
  fingerprint: string;
  buildId: string;
}

function contentHash(path: string): string {
  const stat = lstatSync(path);
  const fileBytes = stat.isFile() ? readFileSync(path) : Buffer.alloc(0);
  const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(path)) : fileBytes;
  return createHash(HASH).update(bytes).digest('hex');
}

export function readTree(cwd: string, head: string): Tree {
  const untracked = gitText(['ls-files', '-o', '--exclude-standard', '-z'], { cwd, trim: false })
    .split(FIELD_SEPARATOR)
    .filter(Boolean);
  return {
    head,
    diff: gitText(['diff', 'HEAD', '--binary'], { cwd, trim: false }),
    untracked: untracked.map((path) => `${path}${FIELD_SEPARATOR}${contentHash(join(cwd, path))}`),
  };
}

export function fingerprint(tree: Tree): string {
  return createHash(HASH)
    .update([tree.head, tree.diff, [...tree.untracked].sort().join('\n')].join(FIELD_SEPARATOR))
    .digest('hex');
}

export const stampText = (stamp: Stamp): string => JSON.stringify(stamp);

export function checkStamp(
  raw: string | undefined,
  current: { fingerprint: string; buildId: string | undefined },
): { valid: boolean; reason: string } {
  if (raw === undefined) {
    return {
      valid: false,
      reason: 'the existing .next has no build stamp; run the build stage first',
    };
  }
  let stamp: Partial<Stamp>;
  try {
    stamp = JSON.parse(raw) as Partial<Stamp>;
  } catch {
    return { valid: false, reason: 'the build stamp is unreadable; run the build stage again' };
  }
  if (stamp.fingerprint !== current.fingerprint) {
    return {
      valid: false,
      reason: 'the existing .next was built from another tree (commit or edits differ)',
    };
  }
  if (current.buildId === undefined || stamp.buildId !== current.buildId) {
    return { valid: false, reason: 'the .next build id changed after the stamp was written' };
  }
  return { valid: true, reason: '' };
}

const readIfPresent = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

function currentFingerprint(root: string): string {
  const head = gitText(['rev-parse', 'HEAD'], { cwd: root });
  return fingerprint(readTree(root, head));
}

function writeBuildStamp(root: string): string | undefined {
  const buildId = readIfPresent(join(root, BUILD_ID_FILE));
  if (buildId === undefined) return `the build wrote no ${BUILD_ID_FILE}`;
  writeFileSync(
    join(root, STAMP_FILE),
    stampText({ fingerprint: currentFingerprint(root), buildId }),
  );
  return undefined;
}

function verifyBuild(root: string): void {
  const buildId = readIfPresent(join(root, BUILD_ID_FILE));
  if (buildId === undefined) {
    throw new Error('no production build in .next; run the build stage first');
  }
  const check = checkStamp(readIfPresent(join(root, STAMP_FILE)), {
    fingerprint: currentFingerprint(root),
    buildId,
  });
  if (!check.valid) throw new Error(check.reason);
}

function hasBinary(name: string): boolean {
  return (process.env.PATH ?? '').split(delimiter).some((dir) => {
    try {
      accessSync(join(dir, name), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

const sleep = (ms: number) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function stopServer(server: ChildProcess | null): Promise<void> {
  if (server === null) return;
  await terminateGroup(server);
  active.delete(server);
}

interface ChildOutcome {
  code: number;
  timedOut: boolean;
  error?: string;
}

function runChild(
  command: StageCommand,
  root: string,
  blank: Record<string, string>,
  timeoutMs: number,
): Promise<ChildOutcome> {
  return new Promise((resolveOutcome) => {
    const child = startTracked(command.file, command.args, {
      cwd: root,
      env: command.env ?? {},
      blank,
      unset: command.unset,
      stdio: 'inherit',
    });
    let timedOut = false;
    let termination: Promise<void> | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      termination = terminateGroup(child);
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolveOutcome({ code: FAILED, timedOut: false, error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const settle = () => resolveOutcome({ code: code ?? FAILED, timedOut });
      if (termination === undefined) settle();
      else void termination.then(settle);
    });
  });
}

const elapsed = (started: number): number => (Date.now() - started) / MS_PER_SECOND;

async function runStage(
  stage: Stage,
  options: RunnerOptions,
  workDir: string,
  blank: Record<string, string>,
): Promise<StageResult> {
  const started = Date.now();
  const result = (verdict: Verdict, note: string): StageResult => ({
    id: stage.id,
    title: stage.title,
    verdict,
    seconds: elapsed(started),
    note,
  });
  let server: ChildProcess | null = null;
  try {
    let ctx: StageContext = {
      root: options.root,
      base: options.base,
      port: null,
      origin: null,
      workDir,
    };
    if (stage.server === true) {
      try {
        verifyBuild(options.root);
      } catch (error) {
        return result('failed', error instanceof Error ? error.message : String(error));
      }
      const port = await ephemeralPort();
      ctx = { ...ctx, port, origin: `http://localhost:${port}` };
      const logPath = join(workDir, `server-${stage.id}.log`);
      const { command, portEnv } = options.server;
      server = startTracked(command.file, command.args, {
        cwd: options.root,
        env: { ...command.env, [portEnv]: String(port) },
        blank,
        stdio: { log: logPath },
      });
      try {
        await waitForOwnServer({
          url: ctx.origin ?? '',
          port,
          child: server,
          timeoutMs: options.readyTimeoutMs ?? READY_TIMEOUT_MS,
          pollMs: READY_POLL_MS,
          logPath,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return result('failed', `the server did not become ready: ${message}`);
      }
    }
    stage.prepare?.(ctx);
    const outcome = await runChild(
      stage.command(ctx),
      options.root,
      blank,
      options.stageTimeoutMs ?? STAGE_TIMEOUT_MS,
    );
    if (outcome.timedOut) return result('failed', 'timed out and was killed');
    if (outcome.error !== undefined) return result('failed', outcome.error);
    if (outcome.code !== 0) return result('failed', `exit code ${outcome.code}`);
    if (stage.produces === 'build') {
      const problem = writeBuildStamp(options.root);
      if (problem !== undefined) return result('failed', problem);
    }
    return result('passed', '');
  } catch (error) {
    return result('failed', error instanceof Error ? error.message : String(error));
  } finally {
    await stopServer(server);
  }
}

function unavailableReason(
  stage: Stage,
  options: RunnerOptions,
  workDir: string,
): string | undefined {
  return stage.unavailable?.({
    root: options.root,
    base: options.base,
    port: null,
    origin: null,
    workDir,
  });
}

export async function runStages(options: RunnerOptions): Promise<StageResult[]> {
  const { stages } = options;
  const fromIndex =
    options.from === undefined ? 0 : stages.findIndex((stage) => stage.id === options.from);
  if (fromIndex < 0) {
    throw new Error(`unknown stage ${options.from}; stages: ${stages.map((s) => s.id).join(', ')}`);
  }
  const workDir = mkdtempSync(join(tmpdir(), 'ci-full-'));
  const blank = localEnvBlanks(options.root);
  const results: StageResult[] = [];
  let firstFailure: string | undefined;
  const skipped = (stage: Stage, note: string): StageResult => ({
    id: stage.id,
    title: stage.title,
    verdict: 'not-run',
    seconds: 0,
    note,
  });
  for (const [index, stage] of stages.entries()) {
    if (index < fromIndex) {
      results.push(skipped(stage, `before --from ${options.from}`));
    } else if (firstFailure !== undefined && !options.keepGoing) {
      results.push(skipped(stage, `after the failure of ${firstFailure}`));
    } else if (stage.requires !== undefined && !hasBinary(stage.requires)) {
      results.push(skipped(stage, `${stage.requires} is not installed`));
    } else {
      const unavailable = unavailableReason(stage, options, workDir);
      if (unavailable !== undefined) {
        results.push(skipped(stage, unavailable));
      } else {
        options.log(`stage ${index + 1}/${stages.length}: ${stage.id}`);
        const result = await runStage(stage, options, workDir, blank);
        results.push(result);
        if (result.verdict === 'failed') firstFailure ??= stage.id;
      }
    }
  }
  if (results.every((result) => result.verdict === 'passed')) {
    rmSync(workDir, { recursive: true, force: true });
  } else {
    options.log(`logs and reports: ${workDir}`);
  }
  return results;
}

export function formatDuration(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = Math.floor(seconds % SECONDS_PER_MINUTE);
  return `${minutes}m${String(rest).padStart(DURATION_MINUTE_PAD, '0')}s`;
}

export function renderTable(
  results: readonly StageResult[],
  exclusions: readonly Exclusion[],
): string {
  const row = (verdict: string, duration: string, title: string, note: string): string =>
    `${verdict.padEnd(VERDICT_WIDTH)} ${duration.padStart(DURATION_WIDTH)}  ${title.padEnd(TITLE_WIDTH)} ${note}`.trimEnd();
  const lines = [
    ...results.map((result) =>
      row(
        result.verdict,
        result.verdict === 'not-run' ? '' : formatDuration(result.seconds),
        result.title,
        result.note,
      ),
    ),
    ...exclusions.map((entry) => row('not-run', '', entry.id, entry.reason)),
  ];
  const count = (verdict: Verdict): number =>
    results.filter((result) => result.verdict === verdict).length;
  const notRun = count('not-run') + exclusions.length;
  lines.push('', `${count('passed')} passed, ${count('failed')} failed, ${notRun} not-run`);
  return lines.join('\n');
}

export function exitCode(results: readonly StageResult[]): number {
  if (results.some((result) => result.verdict === 'failed')) return EXIT.FAILED;
  if (results.some((result) => result.verdict === 'not-run')) return EXIT.NOT_VERIFIED;
  return EXIT.OK;
}

export function parseArgs(argv: readonly string[], stageIds: readonly string[]): Args {
  const args: Args = { base: DEFAULT_BASE, from: undefined, keepGoing: false, list: false };
  const value = (index: number, flag: string): string => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
    return next;
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--keep-going') args.keepGoing = true;
    else if (flag === '--list') args.list = true;
    else if (flag === '--base') args.base = value(index++, flag);
    else if (flag === '--from') args.from = value(index++, flag);
    else throw new Error(`unknown argument ${flag}`);
  }
  if (args.from !== undefined && !stageIds.includes(args.from)) {
    throw new Error(`unknown stage ${args.from}; stages: ${stageIds.join(', ')}`);
  }
  return args;
}
