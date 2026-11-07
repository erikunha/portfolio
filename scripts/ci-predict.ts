#!/usr/bin/env tsx

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { DEFAULT_REPEAT } from './lib/ci-predict-policy';
import {
  type Deps,
  dockerExecPlaywrightArgs,
  dockerSessionArgs,
  type ExecResult,
  linuxImage,
  predict,
  type RunContext,
  type ServerUrls,
  summaryTable,
} from './lib/ci-predict-run';
import { parseWorkflow } from './lib/ci-workflow';

const USAGE = `Usage: pnpm ci:predict [--base <ref>] [--branch <name>] [--linux] [--full] [--eval] [--skip-build] [--keep-going] [--repeat <n>] [--list]

Runs locally what CI will run for the commits on this branch against their base.
  --base <ref>    base to diff against (default: the open PR's base, else origin/main)
  --branch <name> branch name CI would see (needed on a detached HEAD)
  --linux         run Playwright (e2e, visual, a11y) in the official Linux image, not on this machine
  --full          run the whole e2e suite instead of new/changed specs and their co-located specs
  --eval          run the live ask:eval when ai paths changed (secrets are injected, never printed)
  --skip-build    reuse the existing .next instead of building
  --keep-going    run jobs whose needs failed too
  --repeat <n>    repeat-each for changed specs (default ${DEFAULT_REPEAT})
  --list          dry run: print what would run, execute only change detection`;

const OK = 0;
const FAILED = 1;
const MS_PER_SECOND = 1000;
const STEP_TIMEOUT_MS = 30 * 60 * MS_PER_SECOND;
const SERVER_READY_TIMEOUT_MS = 60 * MS_PER_SECOND;
const SERVER_POLL_MS = 500;
const SERVER_ERROR_STATUS = 500;
const GH_TIMEOUT_MS = 8 * MS_PER_SECOND;
const TAIL_LINES = 60;
const BYTES_PER_MIB = 1024 * 1024;
const GIT_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB;
const LIST_MAX_BUFFER_BYTES = 256 * BYTES_PER_MIB;
const ERROR_EXCERPT_CHARS = 400;
const BYTES_PER_GB = 1024 ** 3;
const DEFAULT_BASE = 'origin/main';
const DETACHED_HEAD = 'HEAD';
const CONTAINER_PORT = 3000;
const CONTAINER_ROOT = '/work';
const HOST_MOUNT = '/host';
const COPY_EXCLUDES = [
  './node_modules',
  './.next',
  './.git',
  './.vercel',
  './coverage',
  './test-results',
  './.env',
  './.env.*local',
];
const CI_WORKFLOW = '.github/workflows/ci.yml';
const SIGNAL_EXIT_BASE = 128;
const SIGINT_NUMBER = 2;
const SIGTERM_NUMBER = 15;

interface Flags {
  base: string | undefined;
  branch: string | undefined;
  linux: boolean;
  full: boolean;
  evalLive: boolean;
  skipBuild: boolean;
  keepGoing: boolean;
  list: boolean;
  repeat: number;
  help: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    base: undefined,
    branch: undefined,
    linux: false,
    full: false,
    evalLive: false,
    skipBuild: false,
    keepGoing: false,
    list: false,
    repeat: DEFAULT_REPEAT,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') flags.base = argv[++i];
    else if (arg === '--branch') flags.branch = argv[++i];
    else if (arg === '--repeat') flags.repeat = Number(argv[++i]);
    else if (arg === '--linux') flags.linux = true;
    else if (arg === '--full') flags.full = true;
    else if (arg === '--eval') flags.evalLive = true;
    else if (arg === '--skip-build') flags.skipBuild = true;
    else if (arg === '--keep-going') flags.keepGoing = true;
    else if (arg === '--list') flags.list = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else throw new Error(`unknown argument ${arg}\n${USAGE}`);
  }
  if (!Number.isInteger(flags.repeat) || flags.repeat < 1)
    throw new Error('--repeat needs a positive integer');
  return flags;
}

const out = (text: string) => process.stdout.write(`${text}\n`);
const err = (text: string) => process.stderr.write(`${text}\n`);

function git(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER_BYTES });
  if (result.status !== OK)
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function gitOk(args: string[]): boolean {
  return spawnSync('git', args, { stdio: 'ignore' }).status === OK;
}

function resolveBase(explicit: string | undefined): { ref: string; sha: string } {
  let ref = explicit;
  if (ref === undefined) {
    const pr = spawnSync('gh', ['pr', 'view', '--json', 'baseRefName', '-q', '.baseRefName'], {
      encoding: 'utf8',
      timeout: GH_TIMEOUT_MS,
    });
    const name = pr.status === OK ? pr.stdout.trim() : '';
    ref = name === '' ? DEFAULT_BASE : `origin/${name}`;
  }
  if (ref.startsWith('origin/')) {
    spawnSync('git', ['fetch', '--quiet', 'origin', ref.slice('origin/'.length)], {
      stdio: 'ignore',
    });
  }
  return { ref, sha: git(['rev-parse', '--verify', `${ref}^{commit}`]) };
}

interface PlaywrightListSuite {
  specs?: { file: string; tests: { projectName: string }[] }[];
  suites?: PlaywrightListSuite[];
}

function listSpecProjects(root: string): Map<string, Set<string>> {
  const listed = spawnSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: LIST_MAX_BUFFER_BYTES,
    env: { ...process.env, CI: 'true' },
  });
  if (listed.status !== OK)
    throw new Error(`playwright --list failed: ${listed.stderr.slice(-ERROR_EXCERPT_CHARS)}`);
  const parsed = JSON.parse(listed.stdout) as {
    config: { rootDir: string };
    suites: PlaywrightListSuite[];
  };
  const projects = new Map<string, Set<string>>();
  const visit = (suite: PlaywrightListSuite) => {
    for (const spec of suite.specs ?? []) {
      const file = relative(root, resolve(parsed.config.rootDir, spec.file));
      const set = projects.get(file) ?? new Set<string>();
      for (const test of spec.tests) set.add(test.projectName);
      projects.set(file, set);
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of parsed.suites) visit(suite);
  return projects;
}

function findLinkedCheckout(): string | null {
  const listed = git(['worktree', 'list', '--porcelain']);
  for (const line of listed.split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const path = line.slice('worktree '.length);
    if (
      existsSync(join(path, '.vercel', 'project.json')) ||
      existsSync(join(path, '.vercel', 'repo.json'))
    ) {
      return path;
    }
  }
  return null;
}

function tail(text: string): string {
  return text.split('\n').slice(-TAIL_LINES).join('\n');
}

function runProcess(
  file: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; logPath: string },
): Promise<ExecResult> {
  return new Promise((resolveResult) => {
    const chunks: Buffer[] = [];
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
        // biome-ignore lint/suspicious/noEmptyBlockStatements: the group may already be gone
      } catch {}
    }, STEP_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
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

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

async function waitForServer(url: string): Promise<boolean> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(url).catch(() => null);
    if (response !== null && response.status < SERVER_ERROR_STATUS) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, SERVER_POLL_MS));
  }
  return false;
}

function killGroup(child: ChildProcess | null) {
  if (child?.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function ensureImage(image: string): string {
  const present = spawnSync('docker', ['image', 'inspect', image, '--format', '{{.Size}}'], {
    encoding: 'utf8',
  });
  if (present.status === OK) {
    return `${image} (${(Number(present.stdout) / BYTES_PER_GB).toFixed(2)} GB, already local)`;
  }
  const started = Date.now();
  err(`[ci-predict] pulling ${image} (first --linux run on this machine)`);
  const pulled = spawnSync('docker', ['pull', image], { stdio: 'inherit' });
  if (pulled.status !== OK) throw new Error(`docker pull ${image} failed`);
  const size = spawnSync('docker', ['image', 'inspect', image, '--format', '{{.Size}}'], {
    encoding: 'utf8',
  });
  return `${image} (${(Number(size.stdout) / BYTES_PER_GB).toFixed(2)} GB, pulled in ${((Date.now() - started) / MS_PER_SECOND).toFixed(0)}s)`;
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help) {
    out(USAGE);
    return OK;
  }
  const root = git(['rev-parse', '--show-toplevel']);
  process.chdir(root);
  const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = flags.branch ?? current;
  if (branch === DETACHED_HEAD)
    throw new Error('HEAD is detached; check out a branch or pass --branch <name>');
  const headSha = git(['rev-parse', 'HEAD']);
  const base = resolveBase(flags.base);
  if (base.sha === headSha) {
    out(`ci-predict: ${branch} has no commits ahead of ${base.ref}; nothing to predict`);
    return OK;
  }
  const behind = !gitOk(['merge-base', '--is-ancestor', base.sha, headSha]);
  const dirty = git(['status', '--porcelain']) !== '';
  const changedFiles = git(['diff', '--name-only', `${base.sha}...${headSha}`])
    .split('\n')
    .filter(Boolean);
  const workflow = parseWorkflow(readFileSync(join(root, CI_WORKFLOW), 'utf8'));
  const packageManager = (
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { packageManager: string }
  ).packageManager;
  const playwrightVersion = (
    JSON.parse(
      readFileSync(join(root, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'),
    ) as {
      version: string;
    }
  ).version;

  out(
    `ci-predict: ${branch} @ ${headSha.slice(0, 7)} against ${base.ref} @ ${base.sha.slice(0, 7)}`,
  );
  out(
    `${changedFiles.length} changed file(s)${flags.list ? ' (dry run: change detection only)' : ''}`,
  );
  if (behind)
    err(
      `warning: ${branch} does not contain ${base.ref}; CI tests the merge, so rebase or merge the base first`,
    );
  if (dirty)
    err('warning: uncommitted changes are tested but not part of the predicted diff; commit first');
  if (flags.skipBuild && !existsSync(join(root, '.next')))
    throw new Error('--skip-build needs an existing .next; build once without it');

  const specProjects = listSpecProjects(root);
  const specSources = new Map<string, string>();
  for (const spec of specProjects.keys())
    specSources.set(spec, readFileSync(join(root, spec), 'utf8'));
  const linked = findLinkedCheckout();

  let imageNote = '';
  if (flags.linux && !flags.list) imageNote = ensureImage(linuxImage(playwrightVersion));

  const logDir = mkdtempSync(join(tmpdir(), 'ci-predict-logs-'));
  let logCounter = 0;
  const logPath = () => {
    logCounter += 1;
    return join(logDir, `${logCounter}.log`);
  };
  let server: { child: ChildProcess; key: string; urls: ServerUrls } | null = null;
  const stopServer = () => {
    killGroup(server?.child ?? null);
    server = null;
  };
  process.on('exit', stopServer);
  process.on('SIGINT', () => process.exit(SIGNAL_EXIT_BASE + SIGINT_NUMBER));
  process.on('SIGTERM', () => process.exit(SIGNAL_EXIT_BASE + SIGTERM_NUMBER));

  const announce = (label: string) => err(`[ci-predict] ${label}`);
  const sessionName = `ci-predict-${process.pid}`;
  let sessionUrls: ServerUrls | null = null;
  const stopSession = () => {
    if (sessionUrls !== null) spawnSync('docker', ['rm', '-f', sessionName], { stdio: 'ignore' });
    sessionUrls = null;
  };
  process.on('exit', stopSession);
  const containerRun = async (label: string, script: string, env: Record<string, string> = {}) => {
    announce(`${sessionName} > ${label}`);
    const envFlags = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const result = await runProcess(
      'docker',
      ['exec', '-w', CONTAINER_ROOT, '-e', 'CI=true', ...envFlags, sessionName, 'sh', '-c', script],
      { cwd: root, env: {}, logPath: logPath() },
    );
    if (result.code !== OK) throw new Error(`${label} failed in ${sessionName}\n${result.output}`);
  };
  const startLinuxSession = async (env: Record<string, string>): Promise<ServerUrls> => {
    if (sessionUrls !== null) return sessionUrls;
    const started = spawnSync(
      'docker',
      dockerSessionArgs({ name: sessionName, root, version: playwrightVersion }),
      { encoding: 'utf8' },
    );
    if (started.status !== OK)
      throw new Error(`could not start the Linux container: ${started.stderr}`);
    sessionUrls = {
      hostUrl: `http://localhost:${CONTAINER_PORT}`,
      containerUrl: `http://localhost:${CONTAINER_PORT}`,
    };
    const excludes = COPY_EXCLUDES.map((path) => `--exclude='${path}'`).join(' ');
    const pnpmVersion = packageManager.replace(/^pnpm@/, '').split('+')[0];
    await containerRun(
      'copy the working tree',
      `mkdir -p ${CONTAINER_ROOT} && tar -C ${HOST_MOUNT} ${excludes} -cf - . | tar -C ${CONTAINER_ROOT} -xf -`,
    );
    await containerRun('install pnpm', `npm install -g pnpm@${pnpmVersion} --silent`);
    await containerRun(
      'install dependencies',
      'pnpm config set store-dir /pnpm-store && pnpm install --frozen-lockfile',
    );
    await containerRun('build on Linux', 'pnpm build', env);
    spawnSync(
      'docker',
      [
        'exec',
        '-d',
        '-w',
        CONTAINER_ROOT,
        ...Object.entries({ ...env, PORT: String(CONTAINER_PORT) }).flatMap(([k, v]) => [
          '-e',
          `${k}=${v}`,
        ]),
        sessionName,
        'sh',
        '-c',
        'pnpm start > /tmp/server.log 2>&1',
      ],
      { stdio: 'ignore' },
    );
    await containerRun(
      'wait for the server',
      `for i in $(seq 1 60); do node -e "fetch('http://localhost:${CONTAINER_PORT}').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" && exit 0; sleep 1; done; cat /tmp/server.log; exit 1`,
    );
    return sessionUrls;
  };

  const dryResult: ExecResult = { code: OK, output: '' };
  const deps: Deps = {
    exec: async ({ cmd, env, label }) => {
      if (flags.list && !cmd.includes('detect-changes.mjs')) {
        announce(`would run: ${label}: ${cmd.trim().split('\n')[0]}`);
        return dryResult;
      }
      announce(label);
      return runProcess('sh', ['-c', cmd], { cwd: root, env, logPath: logPath() });
    },
    playwright: async ({ args, env, label, server: urls }) => {
      const display = `playwright test ${args.join(' ')}`;
      if (flags.list) {
        announce(`would run: ${label}: ${display}${flags.linux ? ' (linux image)' : ''}`);
        return dryResult;
      }
      announce(`${label}${flags.linux ? ' [linux image]' : ''}`);
      if (flags.linux) {
        return runProcess(
          'docker',
          dockerExecPlaywrightArgs({ name: sessionName, baseUrl: urls.containerUrl, args }),
          { cwd: root, env: {}, logPath: logPath() },
        );
      }
      return runProcess('pnpm', ['playwright', 'test', ...args], {
        cwd: root,
        env,
        logPath: logPath(),
      });
    },
    ensureServer: async (env) => {
      const key = JSON.stringify(Object.entries(env).sort());
      if (flags.list) return { hostUrl: 'http://localhost:0', containerUrl: 'http://localhost:0' };
      if (flags.linux) return startLinuxSession(env);
      if (server?.key === key) return server.urls;
      stopServer();
      const port = await freePort();
      if ((await fetch(`http://localhost:${port}`).catch(() => null)) !== null) {
        throw new Error(
          `port ${port} answered before the server started; refusing to test another server`,
        );
      }
      announce(`starting the production server on :${port}`);
      const child = spawn('pnpm', ['start'], {
        cwd: root,
        env: { ...process.env, ...env, PORT: String(port) },
        stdio: 'ignore',
        detached: true,
      });
      const url = `http://localhost:${port}`;
      const urls = { hostUrl: url, containerUrl: url };
      server = { child, key, urls };
      if (!(await waitForServer(urls.hostUrl)))
        throw new Error(`the production server did not answer on :${port} (is .next built?)`);
      return urls;
    },
    fileExists: (path) => existsSync(join(root, path)),
    commandExists: (name) =>
      spawnSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' }).status === OK,
    now: () => Date.now(),
  };

  const context: RunContext = {
    workflow,
    github: { baseSha: base.sha, headSha, branch, repository: 'local/repository' },
    options: {
      full: flags.full,
      linux: flags.linux,
      skipBuild: flags.skipBuild,
      evalLive: flags.evalLive,
      keepGoing: flags.keepGoing,
      repeat: flags.repeat,
    },
    changedFiles,
    specProjects,
    specSources,
    evalRun: linked === null ? null : { linkedCheckout: linked, workdir: root },
  };

  const started = Date.now();
  const prediction = await predict(context, deps);
  out('');
  out(summaryTable(prediction.rows));
  out('');
  out(
    `total ${((Date.now() - started) / MS_PER_SECOND).toFixed(1)}s${imageNote === '' ? '' : `, Linux image ${imageNote}`}`,
  );
  for (const note of prediction.notes) out(`note: ${note}`);
  if (
    !flags.full &&
    prediction.rows.some(
      (row) =>
        row.job.startsWith('e2e-functional') && (row.verdict === 'pass' || row.verdict === 'fail'),
    )
  ) {
    out(
      'note: e2e ran new/changed specs and co-located specs; CI runs the whole suite (--full to match).',
    );
  }
  for (const row of prediction.rows.filter((r) => r.verdict === 'fail' && r.detail !== undefined)) {
    out(`\n--- ${row.job}: ${row.why}\n${row.detail}`);
  }
  out(prediction.failed ? '\nPREDICTED CI: FAIL' : '\nPREDICTED CI: no failure found');
  return prediction.failed ? FAILED : OK;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    err(`[ci-predict] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(FAILED);
  },
);
