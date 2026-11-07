import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ProcessResult {
  code: number;
  output: string;
}

export interface ShellInvocation {
  file: string;
  args: string[];
}

export interface RunOptions {
  cwd: string;
  env: Record<string, string>;
  blank?: Record<string, string>;
  logPath: string;
}

const MS_PER_SECOND = 1000;
const FAILED = 1;
const TAIL_LINES = 60;
const STEP_TIMEOUT_MS = 30 * 60 * MS_PER_SECOND;
const SIGNAL_EXIT_BASE = 128;
const SIGNALS: [NodeJS.Signals, number][] = [
  ['SIGHUP', 1],
  ['SIGINT', 2],
  ['SIGTERM', 15],
];
const BASH = 'bash';
const SH = 'sh';
const BASH_DEFAULT_FLAGS = ['-e'];
const BASH_EXPLICIT_FLAGS = ['--noprofile', '--norc', '-eo', 'pipefail'];
const SH_FLAGS = ['-e'];
const COMMAND_FLAG = '-c';
const LOCAL_ENV_FILE = /^\.env(\..+)?\.local$/;
const ENV_KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=/;
const LSOF_PID_PREFIX = 'p';
const LISTENER_PID_FLAG = '-Fp';
const SERVER_ERROR_STATUS = 500;
const SESSION_FIELD_SEPARATOR = ' ';
const ERROR_EXCERPT_LINES = 20;

const active = new Set<ChildProcess>();

export const activeGroupIds = (): number[] =>
  [...active].flatMap((child) => (child.pid === undefined ? [] : [child.pid]));

export function tail(text: string, lines: number = TAIL_LINES): string {
  return text.split('\n').slice(-lines).join('\n');
}

export function killGroup(child: ChildProcess | null, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (child?.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: the child may already be gone
    } catch {}
  }
}

export function killAllChildren(): void {
  for (const child of active) killGroup(child, 'SIGKILL');
  active.clear();
}

export function installCleanup(onCleanup: () => void): void {
  let done = false;
  process.on('exit', () => {
    if (done) return;
    done = true;
    killAllChildren();
    onCleanup();
  });
  for (const [signal, number] of SIGNALS) {
    process.on(signal, () => process.exit(SIGNAL_EXIT_BASE + number));
  }
}

export function startTracked(
  file: string,
  args: string[],
  options: RunOptions & { stdio?: 'pipe' | 'log' },
): ChildProcess {
  const logFd = options.stdio === 'pipe' ? undefined : openSync(options.logPath, 'a');
  const child = spawn(file, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.blank, ...options.env },
    stdio: logFd === undefined ? ['ignore', 'pipe', 'pipe'] : ['ignore', logFd, logFd],
    detached: true,
  });
  if (logFd !== undefined) closeSync(logFd);
  active.add(child);
  child.on('close', () => active.delete(child));
  child.on('error', () => active.delete(child));
  return child;
}

export function runProcess(
  file: string,
  args: string[],
  options: RunOptions,
): Promise<ProcessResult> {
  return new Promise((resolveResult) => {
    const chunks: Buffer[] = [];
    const child = startTracked(file, args, { ...options, stdio: 'pipe' });
    const timer = setTimeout(() => killGroup(child), STEP_TIMEOUT_MS);
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolveResult({ code: FAILED, output: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString();
      writeFileSync(options.logPath, output);
      resolveResult({
        code: code ?? FAILED,
        output: `${tail(output)}\n(full log: ${options.logPath})`,
      });
    });
  });
}

export function shellCommand(
  shell: string | undefined,
  script: string,
): ShellInvocation | undefined {
  if (shell === undefined)
    return { file: BASH, args: [...BASH_DEFAULT_FLAGS, COMMAND_FLAG, script] };
  if (shell === BASH) return { file: BASH, args: [...BASH_EXPLICIT_FLAGS, COMMAND_FLAG, script] };
  if (shell === SH) return { file: SH, args: [...SH_FLAGS, COMMAND_FLAG, script] };
  return undefined;
}

export function runShell(
  script: string,
  options: RunOptions & { shell: string | undefined },
): Promise<ProcessResult> {
  const invocation = shellCommand(options.shell, script);
  if (invocation === undefined) {
    return Promise.resolve({ code: FAILED, output: `shell ${options.shell} is not reproducible` });
  }
  return runProcess(invocation.file, invocation.args, options);
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

export function gitFilesMatch(cwd: string, pattern: string): boolean {
  const listed = spawnSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '--', `:(glob)${pattern}`],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  return listed.status === 0 && listed.stdout.trim() !== '';
}

export function listenerGroupIds(port: number): Set<number> | null {
  const listing = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', LISTENER_PID_FLAG], {
    encoding: 'utf8',
  });
  if (listing.error !== undefined) return null;
  const groups = new Set<number>();
  for (const line of listing.stdout.split('\n')) {
    if (!line.startsWith(LSOF_PID_PREFIX)) continue;
    const group = spawnSync('ps', ['-o', 'pgid=', '-p', line.slice(LSOF_PID_PREFIX.length)], {
      encoding: 'utf8',
    });
    const id = Number(group.stdout.trim());
    if (Number.isInteger(id) && id > 0) groups.add(id);
  }
  return groups;
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
    const response = await fetch(options.url).catch(() => null);
    if (response !== null && response.status < SERVER_ERROR_STATUS) {
      const groups = listenerGroupIds(port);
      if (groups === null) {
        throw new Error(`cannot tell which process answers on :${port} (lsof is not available)`);
      }
      if (child.pid !== undefined && groups.has(child.pid)) return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, options.pollMs));
  }
  throw new Error(
    `:${port} did not answer from the server this run started; the answering process is not the server this run started${excerpt()}`,
  );
}

export function staleSessions(listing: string[], isAlive: (pid: number) => boolean): string[] {
  return listing.flatMap((line) => {
    const [name, owner] = line.trim().split(SESSION_FIELD_SEPARATOR);
    if (name === undefined || name === '') return [];
    const pid = Number(owner);
    return Number.isInteger(pid) && isAlive(pid) ? [] : [name];
  });
}
