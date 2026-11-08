#!/usr/bin/env tsx

import { type ChildProcess, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import {
  archCaveat,
  BUILD_COMMAND,
  CONTAINER_PORT,
  CONTAINER_ROOT,
  chooseBase,
  DEFAULT_REPEAT,
  DRY_SERVER_URL,
  EXIT,
  HOST_MOUNT,
  INTEGRATION_BASE_PREFIX,
  LOCAL_REPOSITORY,
  MAIN_BASE,
  SERVER_LOG_PATH,
  SERVER_PID_PATH,
  SESSION_NAME_PREFIX,
  serverKey,
} from './lib/ci-predict-policy';
import {
  allowedEnv,
  createSessionKeeper,
  gitFilesMatch,
  installCleanup,
  isRunning,
  killGroup,
  localEnvBlanks,
  type ProcessResult,
  REQUEST_TIMEOUT_MS,
  runProcess,
  runShell,
  startTracked,
  sweepStaleSessions,
  waitForOwnServer,
} from './lib/ci-predict-process';
import {
  type Deps,
  dockerExecPlaywrightArgs,
  dockerSessionArgs,
  linuxImage,
  predict,
  type RunContext,
  type ServerUrls,
  summaryTable,
} from './lib/ci-predict-run';
import {
  BUILD_ID_FILE,
  checkStamp,
  fingerprint,
  readTree,
  STAMP_FILE,
  type StampCheck,
  stampText,
} from './lib/ci-predict-stamp';
import { parseWorkflow } from './lib/ci-workflow';

const USAGE = `Usage: pnpm ci:predict [--base <ref>] [--branch <name>] [--linux] [--full] [--eval] [--skip-build] [--keep-going] [--repeat <n>] [--list]

Runs locally what CI will run for the commits on this branch against their base.
  --base <ref>    base to diff against (default: the open PR's base, else the nearest of origin/main and origin/feat/*)
  --branch <name> branch name CI would see (needed on a detached HEAD)
  --linux         run Playwright (e2e, visual, a11y) in the official Linux image, not on this machine
  --full          run the whole e2e suite instead of new/changed specs and their co-located specs
  --eval          run the live ask:eval when ai paths changed (secrets are injected, never printed)
  --skip-build    reuse the .next this command built for the same tree; refuses to call it verified otherwise
  --keep-going    run jobs whose needs failed too
  --repeat <n>    repeat-each for changed specs (default ${DEFAULT_REPEAT})
  --list          dry run: print what would run, execute only change detection; exits ${EXIT.DRY_RUN}

Exit code: ${EXIT.OK} no failure found and every job verified, ${EXIT.FAILED} a job failed, ${EXIT.DRY_RUN} dry run (nothing verified), ${EXIT.NOT_VERIFIED} no failure found but nothing was verified: some job did not run or ran only in part, or the branch has no commits ahead of its base.`;

const OK = EXIT.OK;
const FAILED = EXIT.FAILED;
const MS_PER_SECOND = 1000;
const SERVER_READY_TIMEOUT_MS = 60 * MS_PER_SECOND;
const SERVER_POLL_MS = 500;
const GH_TIMEOUT_MS = 8 * MS_PER_SECOND;
const BYTES_PER_MIB = 1024 * 1024;
const GIT_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB;
const LIST_MAX_BUFFER_BYTES = 256 * BYTES_PER_MIB;
const ERROR_EXCERPT_CHARS = 400;
const BYTES_PER_GB = 1024 ** 3;
const DETACHED_HEAD = 'HEAD';
const REMOTE_PREFIX = 'origin/';
const REMOTE_FEATURE_REFS = 'refs/remotes/origin/feat';
const SERVER_READY_SECONDS = SERVER_READY_TIMEOUT_MS / MS_PER_SECOND;
const SERVER_LOG_NAME = 'server';
const SHORT_SHA_LENGTH = 7;
const SECONDS_DECIMALS = 1;
const WHOLE_SECONDS_DECIMALS = 0;
const GB_DECIMALS = 2;
const NO_COMMITS_HEADLINE = 'PREDICTED CI: NOT VERIFIED, nothing ran';
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
const SESSION_STORE_DIR = '/pnpm-store';

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

function gitLines(args: string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER_BYTES });
  return result.status === OK ? result.stdout.split('\n').filter(Boolean) : [];
}

function nearestBase(branch: string): string {
  spawnSync('git', ['fetch', '--quiet', 'origin'], { stdio: 'ignore', timeout: GH_TIMEOUT_MS });
  const candidates = [
    MAIN_BASE,
    ...gitLines(['for-each-ref', '--format=%(refname:short)', REMOTE_FEATURE_REFS]),
  ]
    .filter((ref) => ref.startsWith(MAIN_BASE) || ref.startsWith(INTEGRATION_BASE_PREFIX))
    .filter((ref) => ref !== `${REMOTE_PREFIX}${branch}`)
    .filter((ref) => gitOk(['merge-base', ref, DETACHED_HEAD]))
    .map((ref) => ({
      ref,
      ahead: Number(git(['rev-list', '--count', `${ref}..${DETACHED_HEAD}`])),
    }));
  const chosen = chooseBase(candidates);
  if (chosen === undefined) {
    throw new Error(
      'no open PR and no origin/main or origin/feat/* to compare with; pass --base <ref>',
    );
  }
  err(
    `[ci-predict] no open PR for this branch; base ${chosen} is the nearest of ${candidates.map((c) => `${c.ref} (${c.ahead} ahead)`).join(', ')}; pass --base to override`,
  );
  return chosen;
}

function resolveBase(explicit: string | undefined, branch: string): { ref: string; sha: string } {
  let ref = explicit;
  if (ref === undefined) {
    const pr = spawnSync('gh', ['pr', 'view', '--json', 'baseRefName', '-q', '.baseRefName'], {
      encoding: 'utf8',
      timeout: GH_TIMEOUT_MS,
    });
    const name = pr.status === OK ? pr.stdout.trim() : '';
    ref = name === '' ? nearestBase(branch) : `${REMOTE_PREFIX}${name}`;
  }
  if (ref.startsWith(REMOTE_PREFIX)) {
    spawnSync('git', ['fetch', '--quiet', 'origin', ref.slice(REMOTE_PREFIX.length)], {
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
    env: { ...allowedEnv(), CI: 'true' },
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

function ensureImage(image: string): string {
  const present = spawnSync('docker', ['image', 'inspect', image, '--format', '{{.Size}}'], {
    encoding: 'utf8',
  });
  if (present.status === OK) {
    return `${image} (${(Number(present.stdout) / BYTES_PER_GB).toFixed(GB_DECIMALS)} GB, already local)`;
  }
  const started = Date.now();
  err(`[ci-predict] pulling ${image} (first --linux run on this machine)`);
  const pulled = spawnSync('docker', ['pull', image], { stdio: 'inherit' });
  if (pulled.status !== OK) throw new Error(`docker pull ${image} failed`);
  const size = spawnSync('docker', ['image', 'inspect', image, '--format', '{{.Size}}'], {
    encoding: 'utf8',
  });
  return `${image} (${(Number(size.stdout) / BYTES_PER_GB).toFixed(GB_DECIMALS)} GB, pulled in ${((Date.now() - started) / MS_PER_SECOND).toFixed(WHOLE_SECONDS_DECIMALS)}s)`;
}

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const treeFingerprint = (headSha: string): string => fingerprint(readTree(process.cwd(), headSha));

function readIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return undefined;
  }
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
  const base = resolveBase(flags.base, branch);
  if (base.sha === headSha) {
    out(`ci-predict: ${branch} has no commits ahead of ${base.ref}; nothing to predict`);
    out(`\n${NO_COMMITS_HEADLINE}`);
    return EXIT.NOT_VERIFIED;
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
    `ci-predict: ${branch} @ ${headSha.slice(0, SHORT_SHA_LENGTH)} against ${base.ref} @ ${base.sha.slice(0, SHORT_SHA_LENGTH)}`,
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
  const caveat = flags.linux ? archCaveat(process.arch) : undefined;
  if (caveat !== undefined) err(`warning: ${caveat}`);

  let stamp: StampCheck = { valid: true, reason: '' };
  if (flags.skipBuild) {
    stamp = checkStamp(readIfPresent(join(root, STAMP_FILE)), {
      fingerprint: treeFingerprint(headSha),
      buildId: readIfPresent(join(root, BUILD_ID_FILE)),
    });
    if (!stamp.valid)
      err(`warning: ${stamp.reason}; the build and the servers on it are not verified`);
  }

  const specProjects = listSpecProjects(root);
  const specSources = new Map<string, string>();
  for (const spec of specProjects.keys())
    specSources.set(spec, readFileSync(join(root, spec), 'utf8'));
  const linked = findLinkedCheckout();
  const blank = localEnvBlanks(root);

  let imageNote = '';
  if (flags.linux && !flags.list) {
    sweepStaleSessions({
      isAlive: pidAlive,
      log: (line) => err(`[ci-predict] ${line}`),
    });
    imageNote = ensureImage(linuxImage(playwrightVersion));
  }

  const logDir = mkdtempSync(join(tmpdir(), 'ci-predict-logs-'));
  let logCounter = 0;
  const logPath = (name = String(logCounter + 1)) => {
    logCounter += 1;
    return join(logDir, `${name}.log`);
  };
  let server: { child: ChildProcess; key: string; urls: ServerUrls } | null = null;
  const stopServer = () => {
    killGroup(server?.child ?? null);
    server = null;
  };
  const sessionName = `${SESSION_NAME_PREFIX}${process.pid}`;
  const sessions = createSessionKeeper<ServerUrls>(sessionName, (args) => {
    spawnSync('docker', args, { stdio: 'ignore' });
  });
  const stopSession = sessions.stop;
  installCleanup(() => {
    stopServer();
    stopSession();
  });

  const announce = (label: string) => err(`[ci-predict] ${label}`);
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
  const createLinuxSession = async (env: Record<string, string>): Promise<ServerUrls> => {
    const started = spawnSync(
      'docker',
      dockerSessionArgs({
        name: sessionName,
        root,
        version: playwrightVersion,
        owner: process.pid,
      }),
      { encoding: 'utf8' },
    );
    if (started.status !== OK)
      throw new Error(`could not start the Linux container: ${started.stderr}`);
    const urls = {
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
      `pnpm config set store-dir ${SESSION_STORE_DIR} && pnpm install --frozen-lockfile`,
    );
    await containerRun('build on Linux', BUILD_COMMAND, env);
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
        `echo $$ > ${SERVER_PID_PATH} && exec pnpm start > ${SERVER_LOG_PATH} 2>&1`,
      ],
      { stdio: 'ignore' },
    );
    const probe = `fetch('${urls.containerUrl}').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))`;
    await containerRun(
      'wait for the server',
      `for i in $(seq 1 ${SERVER_READY_SECONDS}); do node -e "${probe}" && exit 0; kill -0 $(cat ${SERVER_PID_PATH}) 2>/dev/null || { echo 'the server exited before it answered'; cat ${SERVER_LOG_PATH}; exit 1; }; sleep 1; done; cat ${SERVER_LOG_PATH}; exit 1`,
    );
    return urls;
  };
  const startLinuxSession = (env: Record<string, string>): Promise<ServerUrls> =>
    sessions.ensure(serverKey(env), () => createLinuxSession(env));

  const dryResult: ProcessResult & { dry: true } = { code: OK, output: '', dry: true };
  const stampBuild = () => {
    writeFileSync(
      join(root, STAMP_FILE),
      stampText({
        fingerprint: treeFingerprint(headSha),
        buildId: readIfPresent(join(root, BUILD_ID_FILE)) ?? '',
      }),
    );
  };
  const deps: Deps = {
    exec: async ({ cmd, env, label, shell, cwd }) => {
      if (flags.list && !cmd.includes('detect-changes.mjs')) {
        announce(`would run: ${label}: ${cmd.trim().split('\n')[0]}`);
        return dryResult;
      }
      announce(label);
      const result = await runShell(cmd, {
        shell,
        cwd: cwd === undefined ? root : resolve(root, cwd),
        env,
        blank,
        logPath: logPath(),
      });
      if (cmd.trim() === BUILD_COMMAND && result.code === OK) stampBuild();
      return result;
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
          dockerExecPlaywrightArgs({ name: sessionName, baseUrl: urls.containerUrl, args, env }),
          { cwd: root, env: {}, logPath: logPath() },
        );
      }
      return runProcess('pnpm', ['playwright', 'test', ...args], {
        cwd: root,
        env,
        blank,
        logPath: logPath(),
      });
    },
    ensureServer: async (env) => {
      const key = serverKey(env);
      if (flags.list) return { hostUrl: DRY_SERVER_URL, containerUrl: DRY_SERVER_URL };
      if (flags.linux) return startLinuxSession(env);
      if (server?.key === key && isRunning(server.child)) return server.urls;
      stopServer();
      const port = await freePort();
      if (
        (await fetch(`http://localhost:${port}`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }).catch(() => null)) !== null
      ) {
        throw new Error(
          `port ${port} answered before the server started; refusing to test another server`,
        );
      }
      announce(`starting the production server on :${port}`);
      const serverLog = logPath(SERVER_LOG_NAME);
      const child = startTracked('pnpm', ['start'], {
        cwd: root,
        env: { ...env, PORT: String(port) },
        blank,
        logPath: serverLog,
        stdio: 'log',
      });
      const url = `http://localhost:${port}`;
      const urls = { hostUrl: url, containerUrl: url };
      server = { child, key, urls };
      try {
        await waitForOwnServer({
          url,
          port,
          child,
          timeoutMs: SERVER_READY_TIMEOUT_MS,
          pollMs: SERVER_POLL_MS,
          logPath: serverLog,
        });
      } catch (error) {
        stopServer();
        throw error;
      }
      return urls;
    },
    anyFileMatches: (pattern) => gitFilesMatch(root, pattern),
    commandExists: (name) =>
      spawnSync('sh', ['-c', `command -v ${name}`], { stdio: 'ignore' }).status === OK,
    now: () => Date.now(),
  };

  const context: RunContext = {
    workflow,
    github: { baseSha: base.sha, headSha, branch, repository: LOCAL_REPOSITORY },
    options: {
      full: flags.full,
      linux: flags.linux,
      skipBuild: flags.skipBuild,
      evalLive: flags.evalLive,
      keepGoing: flags.keepGoing,
      repeat: flags.repeat,
      dryRun: flags.list,
      stamp,
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
    `total ${((Date.now() - started) / MS_PER_SECOND).toFixed(SECONDS_DECIMALS)}s${imageNote === '' ? '' : `, Linux image ${imageNote}`}`,
  );
  for (const note of prediction.notes) out(`note: ${note}`);
  if (caveat !== undefined) out(`note: ${caveat}`);
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
  out(`\n${prediction.outcome.headline}`);
  return prediction.outcome.code;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    err(`[ci-predict] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(FAILED);
  },
);
