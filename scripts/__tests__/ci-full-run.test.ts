import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { createServer as createTcpServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeGroupIds,
  allowedEnv,
  checkStamp,
  envKeyNames,
  exitCode,
  fingerprint,
  formatDuration,
  isRunning,
  killAllChildren,
  killGroup,
  localEnvBlanks,
  parseArgs,
  readTree,
  renderTable,
  runStages,
  type StageResult,
  stampText,
  startTracked,
  waitForOwnServer,
} from '../lib/ci-full-run';
import type { ServerSpec, Stage } from '../lib/ci-full-stages';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const NODE = process.execPath;
const POLL_MS = 25;

const dirs: string[] = [];
const servers: Server[] = [];
const children: ChildProcess[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ci-full-test-'));
  dirs.push(dir);
  return dir;
}

const side = (root: string, name: string): string => join(dirname(root), name);

function repo(): string {
  const dir = join(scratch(), 'repo');
  mkdirSync(dir);
  const git = (...args: string[]) =>
    spawnSync(
      'git',
      [
        '-c',
        'user.email=t@t',
        '-c',
        'user.name=t',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd: dir, encoding: 'utf8' },
    );
  git('init', '--quiet');
  writeFileSync(join(dir, '.gitignore'), '.next\n');
  writeFileSync(join(dir, 'tracked.ts'), 'export {};\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  return dir;
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function waitUntil(check: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return check();
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const stage = (id: string, code: string, extra: Partial<Stage> = {}): Stage => ({
  id,
  title: `title of ${id}`,
  jobs: [],
  mirrors: [],
  steps: [],
  command: () => ({ file: NODE, args: ['-e', code] }),
  ...extra,
});

const append = (file: string, text: string): string =>
  `require('fs').appendFileSync(${JSON.stringify(file)}, ${JSON.stringify(`${text}\n`)})`;

const SERVER_CODE = `
  const fs = require('fs');
  fs.appendFileSync(process.env.PID_FILE, process.pid + '\\n');
  require('http').createServer((q, r) => r.end('ok')).listen(Number(process.env.PORT));
`;

const serverSpec = (pidFile: string, code = SERVER_CODE): ServerSpec => ({
  command: { file: NODE, args: ['-e', code], env: { PID_FILE: pidFile } },
  portEnv: 'PORT',
});

const BUILD_CODE =
  "require('fs').mkdirSync('.next', {recursive: true}); require('fs').writeFileSync('.next/BUILD_ID', 'b1')";

const buildStage = (): Stage => stage('build', BUILD_CODE, { produces: 'build' });

const servedStage = (id: string, out: string, extra: Partial<Stage> = {}): Stage => ({
  ...stage(id, ''),
  server: true,
  command: (ctx) => ({
    file: NODE,
    args: [
      '-e',
      `fetch(process.env.ORIGIN).then((r) => r.text()).then((t) => require('fs').appendFileSync(${JSON.stringify(out)}, ${JSON.stringify(id)} + ':' + t + '\\n')).catch(() => process.exit(7))`,
    ],
    env: { ORIGIN: ctx.origin ?? '' },
  }),
  ...extra,
});

const OPTIONS = { keepGoing: false, readyTimeoutMs: 5000, log: () => undefined };

afterEach(() => {
  killAllChildren();
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const server of servers.splice(0)) server.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const verdicts = (results: StageResult[]) =>
  Object.fromEntries(results.map((result) => [result.id, result.verdict]));
const pidsOf = (file: string): number[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(Number) : [];

describe('runStages order and failure', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('runs one stage at a time, never overlapping the next', async () => {
    const root = repo();
    const trace = side(root, 'trace');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [
        stage(
          'a',
          `${append(trace, 'a-start')}; setTimeout(() => { ${append(trace, 'a-end')} }, 400)`,
        ),
        stage('b', `${append(trace, 'b-start')}; ${append(trace, 'b-end')}`),
      ],
    });
    expect(readFileSync(trace, 'utf8').trim().split('\n')).toEqual([
      'a-start',
      'a-end',
      'b-start',
      'b-end',
    ]);
    expect(verdicts(results)).toEqual({ a: 'passed', b: 'passed' });
  });

  it('stops at the first failure and reports every later stage as not-run, naming the failure', async () => {
    const root = repo();
    const trace = side(root, 'trace');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [
        stage('a', append(trace, 'a')),
        stage('b', 'process.exit(4)'),
        stage('c', append(trace, 'c')),
      ],
    });
    expect(verdicts(results)).toEqual({ a: 'passed', b: 'failed', c: 'not-run' });
    expect(results[1]?.note).toContain('exit code 4');
    expect(results[2]?.note).toContain('after the failure of b');
    expect(readFileSync(trace, 'utf8')).toBe('a\n');
  });

  it('continues past a failure with keepGoing and still reports the failure', async () => {
    const root = repo();
    const results = await runStages({
      ...OPTIONS,
      keepGoing: true,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [stage('a', 'process.exit(1)'), stage('b', '')],
    });
    expect(verdicts(results)).toEqual({ a: 'failed', b: 'passed' });
    expect(exitCode(results)).toBe(1);
  });

  it('records how long each stage took', async () => {
    const root = repo();
    const [result] = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [stage('a', 'setTimeout(() => {}, 300)')],
    });
    expect(result?.seconds).toBeGreaterThanOrEqual(0.25);
  });

  it('resumes from a stage and reports the earlier ones as not-run', async () => {
    const root = repo();
    const trace = side(root, 'trace');
    const results = await runStages({
      ...OPTIONS,
      from: 'b',
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [stage('a', append(trace, 'a')), stage('b', append(trace, 'b'))],
    });
    expect(verdicts(results)).toEqual({ a: 'not-run', b: 'passed' });
    expect(results[0]?.note).toContain('before --from b');
    expect(readFileSync(trace, 'utf8')).toBe('b\n');
    expect(exitCode(results)).toBe(3);
  });

  it('refuses a resume point that is no stage', async () => {
    const root = repo();
    await expect(
      runStages({
        ...OPTIONS,
        from: 'nope',
        root,
        base: 'HEAD',
        server: serverSpec(side(root, 'pids')),
        stages: [stage('a', '')],
      }),
    ).rejects.toThrow(/nope/);
  });

  it('reports a missing binary as not-run with the reason, and keeps going', async () => {
    const root = repo();
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [
        stage('scan', 'process.exit(9)', { requires: 'definitely-not-installed-binary-xyz' }),
        stage('b', ''),
      ],
    });
    expect(verdicts(results)).toEqual({ scan: 'not-run', b: 'passed' });
    expect(results[0]?.note).toContain('definitely-not-installed-binary-xyz is not installed');
    expect(exitCode(results)).toBe(3);
  });

  it('kills a stage that outlives its time limit and fails it', async () => {
    const root = repo();
    const pidFile = side(root, 'sleeper');
    const [result] = await runStages({
      ...OPTIONS,
      stageTimeoutMs: 400,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [
        stage(
          'slow',
          `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 60000)`,
        ),
      ],
    });
    expect(result?.verdict).toBe('failed');
    expect(result?.note).toContain('timed out');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(await waitUntil(() => !alive(pid), 3000)).toBe(true);
  });

  it('hands the stage its context and lets it prepare files first', async () => {
    const root = repo();
    const seen = side(root, 'seen');
    await runStages({
      ...OPTIONS,
      root,
      base: 'origin/feat/x',
      server: serverSpec(side(root, 'pids')),
      stages: [
        {
          ...stage('a', ''),
          prepare: (ctx) => writeFileSync(join(ctx.workDir, 'prepared'), ctx.base),
          command: (ctx) => ({
            file: NODE,
            args: [
              '-e',
              `require('fs').copyFileSync(${JSON.stringify(join(ctx.workDir, 'prepared'))}, ${JSON.stringify(seen)})`,
            ],
          }),
        },
      ],
    });
    expect(readFileSync(seen, 'utf8')).toBe('origin/feat/x');
  });
});

describe('runStages environment', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const PROBE = (out: string) =>
    `require('fs').writeFileSync(${JSON.stringify(out)}, '[' + (process.env.CI_FULL_SECRET ?? '') + ']')`;

  it('keeps a shell-exported secret out of every stage', async () => {
    const root = repo();
    const out = side(root, 'out');
    process.env.CI_FULL_SECRET = 'exported-in-the-shell';
    try {
      await runStages({
        ...OPTIONS,
        root,
        base: 'HEAD',
        server: serverSpec(side(root, 'pids')),
        stages: [stage('a', PROBE(out))],
      });
    } finally {
      delete process.env.CI_FULL_SECRET;
    }
    expect(readFileSync(out, 'utf8')).toBe('[]');
  });

  it('keeps a key from .env.local out of a stage that loads env files the way Next does', async () => {
    const root = repo();
    writeFileSync(join(root, '.env.local'), 'CI_FULL_LEAK=real-value\n');
    const out = side(root, 'out');
    const nextRequire = createRequire(require.resolve('next/package.json'));
    const code = `const { loadEnvConfig } = require(${JSON.stringify(nextRequire.resolve('@next/env'))});
      loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
      require('fs').writeFileSync(${JSON.stringify(out)}, '[' + (process.env.CI_FULL_LEAK ?? '') + ']');`;
    await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [stage('a', code)],
    });
    expect(readFileSync(out, 'utf8')).toBe('[]');
  });

  it('gives the stage the blank for a key named in .env.local, and lets the stage env win', async () => {
    const root = repo();
    writeFileSync(join(root, '.env.local'), 'CI_FULL_SECRET=real-value\n');
    const out = side(root, 'out');
    await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [stage('a', PROBE(out))],
    });
    expect(readFileSync(out, 'utf8')).toBe('[]');
    await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(side(root, 'pids')),
      stages: [
        {
          ...stage('a', PROBE(out)),
          command: () => ({
            file: NODE,
            args: ['-e', PROBE(out)],
            env: { CI_FULL_SECRET: 'from-stage' },
          }),
        },
      ],
    });
    expect(readFileSync(out, 'utf8')).toBe('[from-stage]');
  });
});

describe('runStages server', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('serves each server stage on its own port and stops the server by pid afterwards', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const out = side(root, 'out');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(pids),
      stages: [buildStage(), servedStage('one', out), servedStage('two', out)],
    });
    expect(verdicts(results)).toEqual({ build: 'passed', one: 'passed', two: 'passed' });
    expect(readFileSync(out, 'utf8')).toContain('one:ok');
    expect(readFileSync(out, 'utf8')).toContain('two:ok');
    const started = pidsOf(pids);
    expect(started.length, 'a fresh server for each stage, as each CI job has').toBe(2);
    expect(new Set(started).size).toBe(2);
    for (const pid of started) expect(await waitUntil(() => !alive(pid), 3000)).toBe(true);
  });

  it('stops the server when the stage that used it failed', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(pids),
      stages: [
        buildStage(),
        { ...stage('bad', 'process.exit(2)'), server: true },
        stage('later', ''),
      ],
    });
    expect(verdicts(results)).toEqual({ build: 'passed', bad: 'failed', later: 'not-run' });
    const [pid] = pidsOf(pids);
    expect(pid).toBeDefined();
    expect(await waitUntil(() => !alive(pid ?? 0), 3000)).toBe(true);
  });

  it('fails the stage when the server never answers, and leaves no server behind', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const [, served] = await runStages({
      ...OPTIONS,
      readyTimeoutMs: 800,
      root,
      base: 'HEAD',
      server: serverSpec(
        pids,
        `require('fs').appendFileSync(process.env.PID_FILE, process.pid + '\\n'); setTimeout(() => {}, 60000)`,
      ),
      stages: [buildStage(), servedStage('one', side(root, 'out'))],
    });
    expect(served?.verdict).toBe('failed');
    expect(served?.note).toContain('server');
    const [pid] = pidsOf(pids);
    expect(await waitUntil(() => !alive(pid ?? 0), 3000)).toBe(true);
  });

  it('refuses to serve a build that was never made, without starting a server', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const [result] = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(pids),
      stages: [servedStage('one', side(root, 'out'))],
    });
    expect(result?.verdict).toBe('failed');
    expect(result?.note).toContain('build');
    expect(pidsOf(pids)).toEqual([]);
  });

  it('refuses to serve a build made from another tree than the one being verified', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: serverSpec(pids),
      stages: [
        buildStage(),
        stage('edit', `require('fs').appendFileSync('tracked.ts', '// changed\\n')`),
        servedStage('one', side(root, 'out')),
      ],
    });
    expect(verdicts(results)).toEqual({ build: 'passed', edit: 'passed', one: 'failed' });
    expect(results[2]?.note).toContain('another tree');
    expect(pidsOf(pids)).toEqual([]);
  });

  it('leaves the server and the running stage dead when the run is interrupted', async () => {
    const root = repo();
    const pids = side(root, 'pids');
    const sleeper = side(root, 'sleeper');
    const waitCode = `require('fs').writeFileSync(${JSON.stringify(sleeper)}, String(process.pid)); setTimeout(() => {}, 60000)`;
    const script = `
      import { runStages } from ${JSON.stringify(join(process.cwd(), 'scripts/lib/ci-full-run.ts'))};
      const node = process.execPath;
      const stage = (id, code, extra = {}) => ({ id, title: id, jobs: [], mirrors: [], steps: [], command: () => ({ file: node, args: ['-e', code] }), ...extra });
      await runStages({
        root: ${JSON.stringify(root)}, base: 'HEAD', keepGoing: false, log: () => {},
        server: { command: { file: node, args: ['-e', ${JSON.stringify(SERVER_CODE)}], env: { PID_FILE: ${JSON.stringify(pids)} } }, portEnv: 'PORT' },
        stages: [
          stage('build', ${JSON.stringify(BUILD_CODE)}, { produces: 'build' }),
          stage('wait', ${JSON.stringify(waitCode)}, { server: true }),
        ],
      });
    `;
    const parent = spawn(NODE, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    children.push(parent);
    expect(await waitUntil(() => existsSync(sleeper) && pidsOf(pids).length === 1, 30000)).toBe(
      true,
    );
    const server = pidsOf(pids)[0] ?? 0;
    const waiting = Number(readFileSync(sleeper, 'utf8'));
    expect(alive(server) && alive(waiting)).toBe(true);
    parent.kill('SIGINT');
    await new Promise((resolve) => parent.on('close', resolve));
    expect(await waitUntil(() => !alive(server) && !alive(waiting), 5000)).toBe(true);
  }, 60000);
});

describe('parseArgs', () => {
  const STAGE_IDS = ['ci-local', 'build'];

  it('defaults to the remote main branch, every stage, stopping at the first failure', () => {
    expect(parseArgs([], STAGE_IDS)).toEqual({
      base: 'origin/main',
      from: undefined,
      keepGoing: false,
      list: false,
    });
  });

  it('reads --base, --from, --keep-going and --list', () => {
    expect(
      parseArgs(
        ['--base', 'origin/feat/x', '--from', 'build', '--keep-going', '--list'],
        STAGE_IDS,
      ),
    ).toEqual({ base: 'origin/feat/x', from: 'build', keepGoing: true, list: true });
  });

  it('refuses an unknown flag instead of ignoring it', () => {
    expect(() => parseArgs(['--lnux'], STAGE_IDS)).toThrow('unknown argument --lnux');
  });

  it('refuses a flag that is missing its value', () => {
    expect(() => parseArgs(['--base'], STAGE_IDS)).toThrow('--base needs a value');
  });

  it('refuses a resume point that is no stage and names the stages', () => {
    expect(() => parseArgs(['--from', 'nope'], STAGE_IDS)).toThrow(/nope.*ci-local, build/);
  });
});

describe('report', () => {
  const RESULTS: StageResult[] = [
    { id: 'ci-local', title: 'Verify chain', verdict: 'passed', seconds: 75.4, note: '' },
    { id: 'build', title: 'Production build', verdict: 'failed', seconds: 12, note: 'exit code 1' },
    {
      id: 'a11y',
      title: 'Accessibility scan',
      verdict: 'not-run',
      seconds: 0,
      note: 'after the failure of build',
    },
  ];

  it('formats durations in seconds and minutes', () => {
    expect(formatDuration(0.04)).toBe('0.0s');
    expect(formatDuration(12.34)).toBe('12.3s');
    expect(formatDuration(75.4)).toBe('1m15s');
    expect(formatDuration(3725)).toBe('62m05s');
  });

  it('lists passed, failed and not-run apart, each with its duration and note', () => {
    const table = renderTable(RESULTS, [{ id: 'ai-eval', reason: 'spends model credits' }]);
    expect(table).toMatch(/passed\s+1m15s\s+Verify chain/);
    expect(table).toMatch(/failed\s+12\.0s\s+Production build\s+exit code 1/);
    expect(table).toMatch(/not-run\s+Accessibility scan\s+after the failure of build/);
    expect(table).toMatch(/not-run\s+ai-eval\s+spends model credits/);
    expect(table).toContain('1 passed, 1 failed, 2 not-run');
  });

  it('exits 0 only when every stage passed, whatever the declared exclusions', () => {
    const passed = RESULTS.slice(0, 1);
    expect(exitCode(passed)).toBe(0);
    expect(exitCode(RESULTS)).toBe(1);
    expect(exitCode([...passed, { ...(RESULTS[2] as StageResult) }])).toBe(3);
  });
});

describe('local env blanking', () => {
  const FILE = [
    '# comment',
    'RESEND_API_KEY=re_live_secret_value',
    'export UPSTASH_REDIS_REST_TOKEN="tok en"',
    "AI_GATEWAY_API_KEY='abc' # trailing",
    '',
    'not a key line',
  ].join('\n');

  it('reads only the key names and never carries a value', () => {
    const names = envKeyNames(FILE);
    expect(names).toEqual(['RESEND_API_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'AI_GATEWAY_API_KEY']);
    expect(JSON.stringify(names)).not.toContain('re_live_secret_value');
  });

  it('blanks the keys of every .env*.local file and ignores committed env files', () => {
    const dir = scratch();
    writeFileSync(join(dir, '.env.local'), FILE);
    writeFileSync(join(dir, '.env.production.local'), 'ONLY_IN_PROD=1\n');
    writeFileSync(join(dir, '.env'), 'COMMITTED=1\n');
    writeFileSync(join(dir, '.env.example'), 'EXAMPLE=1\n');
    const blanks = localEnvBlanks(dir);
    expect(Object.keys(blanks).sort()).toEqual([
      'AI_GATEWAY_API_KEY',
      'ONLY_IN_PROD',
      'RESEND_API_KEY',
      'UPSTASH_REDIS_REST_TOKEN',
    ]);
    expect(Object.values(blanks).every((value) => value === '')).toBe(true);
  });

  it('keeps the real value out of the app: Next does not reload a key that the process already blanked', async () => {
    const dir = scratch();
    writeFileSync(join(dir, '.env.local'), 'LEAK_PROBE=real-value\n');
    const nextRequire = createRequire(require.resolve('next/package.json'));
    const envModule = nextRequire.resolve('@next/env');
    const probe = (env: Record<string, string>) =>
      new Promise<string>((resolve) => {
        const child = spawn(
          NODE,
          [
            '-e',
            `const { loadEnvConfig } = require(${JSON.stringify(envModule)});
             loadEnvConfig(${JSON.stringify(dir)}, false, { info() {}, error() {} });
             process.stdout.write('[' + (process.env.LEAK_PROBE ?? '') + ']');`,
          ],
          {
            env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production', ...env },
            stdio: ['ignore', 'pipe', 'inherit'],
          },
        );
        children.push(child);
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
        });
        child.on('close', () => resolve(out));
      });
    expect(await probe({})).toBe('[real-value]');
    expect(await probe({ LEAK_PROBE: '' })).toBe('[]');
  });

  it('allows the names a toolchain needs and drops everything else', () => {
    const env = allowedEnv({
      PATH: '/bin',
      HOME: '/h',
      LC_ALL: 'C',
      XDG_CACHE_HOME: '/c',
      PLAYWRIGHT_BROWSERS_PATH: '/p',
      RESEND_API_KEY: 'secret',
      GITHUB_TOKEN: 'secret',
    });
    expect(Object.keys(env).sort()).toEqual([
      'HOME',
      'LC_ALL',
      'PATH',
      'PLAYWRIGHT_BROWSERS_PATH',
      'XDG_CACHE_HOME',
    ]);
  });
});

describe('child cleanup', () => {
  it('kills the whole process group of a running child, the background sleep included', async () => {
    const dir = scratch();
    const pidFile = join(dir, 'sleep.pid');
    startTracked('sh', ['-c', `sleep 300 & echo $! > ${pidFile}; wait`], {
      cwd: dir,
      env: {},
      stdio: 'inherit',
    });
    expect(await waitUntil(() => activeGroupIds().length === 1, 2000)).toBe(true);
    const [group] = activeGroupIds();
    expect(
      await waitUntil(() => existsSync(pidFile) && readFileSync(pidFile, 'utf8') !== '', 2000),
    ).toBe(true);
    const sleeper = Number(readFileSync(pidFile, 'utf8'));
    expect(alive(sleeper)).toBe(true);
    killAllChildren();
    expect(await waitUntil(() => !alive(group ?? 0), 2000)).toBe(true);
    expect(await waitUntil(() => !alive(sleeper), 2000)).toBe(true);
  });

  it('sends no signal for a child that already exited, whose pid the system may have reused', async () => {
    const dir = scratch();
    const child = startTracked(NODE, ['-e', ''], { cwd: dir, env: {}, stdio: 'inherit' });
    await new Promise((resolve) => child.on('close', resolve));
    expect(isRunning(child)).toBe(false);
    const kill = vi.spyOn(process, 'kill');
    try {
      killGroup(child);
      expect(kill).not.toHaveBeenCalled();
    } finally {
      kill.mockRestore();
    }
  });
});

describe('waitForOwnServer', () => {
  const WAIT = { timeoutMs: 4000, pollMs: POLL_MS };

  const listening = async (): Promise<number> => {
    const rogue = createServer((_req, res) => res.end('rogue'));
    servers.push(rogue);
    return new Promise<number>((resolve) =>
      rogue.listen(0, () => resolve((rogue.address() as { port: number }).port)),
    );
  };

  it('resolves for the server the child started', async () => {
    const dir = scratch();
    const port = await freePort();
    const child = startTracked(
      NODE,
      ['-e', `require('http').createServer((q, r) => r.end('ok')).listen(${port})`],
      { cwd: dir, env: {}, stdio: { log: join(dir, 'server.log') } },
    );
    await expect(
      waitForOwnServer({ url: `http://localhost:${port}`, port, child, ...WAIT }),
    ).resolves.toBeUndefined();
  });

  it('accepts a server the child started in its own process group, as pnpm start does', async () => {
    const dir = scratch();
    const port = await freePort();
    const grandchild = `require('http').createServer((q, r) => r.end('ok')).listen(${port})`;
    const child = startTracked(
      NODE,
      [
        '-e',
        `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { detached: true, stdio: 'ignore' }); setTimeout(() => {}, 30000)`,
      ],
      { cwd: dir, env: {}, stdio: { log: join(dir, 'server.log') } },
    );
    await expect(
      waitForOwnServer({ url: `http://localhost:${port}`, port, child, ...WAIT }),
    ).resolves.toBeUndefined();
    killAllChildren();
    const gone = await waitUntil(
      () => spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).stdout.length === 0,
      3000,
    );
    expect(gone, 'the server the child started must not outlive the cleanup').toBe(true);
  });

  it('fails as soon as the child exits, even when another process answers on that port', async () => {
    const dir = scratch();
    const port = await listening();
    const child = startTracked(NODE, ['-e', 'process.exit(3)'], {
      cwd: dir,
      env: {},
      stdio: { log: join(dir, 'server.log') },
    });
    await expect(
      waitForOwnServer({ url: `http://localhost:${port}`, port, child, ...WAIT }),
    ).rejects.toThrow(/exited with code 3/);
  });

  it('does not accept another process answering while the child is still alive', async () => {
    const dir = scratch();
    const port = await listening();
    const child = startTracked(NODE, ['-e', 'setTimeout(() => {}, 20000)'], {
      cwd: dir,
      env: {},
      stdio: { log: join(dir, 'server.log') },
    });
    await expect(
      waitForOwnServer({
        url: `http://localhost:${port}`,
        port,
        child,
        timeoutMs: 600,
        pollMs: POLL_MS,
      }),
    ).rejects.toThrow(/not the server this run started/);
  });

  it('gives up at its deadline against a server that accepts and never answers', async () => {
    const dir = scratch();
    const held: Socket[] = [];
    const hangs = createTcpServer((socket) => held.push(socket));
    const port = await new Promise<number>((resolve) =>
      hangs.listen(0, () => resolve((hangs.address() as { port: number }).port)),
    );
    const child = startTracked(NODE, ['-e', 'setTimeout(() => {}, 20000)'], {
      cwd: dir,
      env: {},
      stdio: { log: join(dir, 'server.log') },
    });
    try {
      await expect(
        waitForOwnServer({
          url: `http://localhost:${port}`,
          port,
          child,
          timeoutMs: 600,
          pollMs: POLL_MS,
        }),
      ).rejects.toThrow(/did not answer/);
    } finally {
      for (const socket of held) socket.destroy();
      hangs.close();
    }
  }, 3000);
});

describe('build stamp', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  const TREE = { head: 'a'.repeat(40), diff: '', untracked: [] as string[] };
  const stamp = stampText({ fingerprint: fingerprint(TREE), buildId: 'build-1' });

  it('accepts a .next that was built from this exact tree', () => {
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: 'build-1' })).toEqual({
      valid: true,
      reason: '',
    });
  });

  it('refuses a .next with no stamp, such as one a dev server wrote', () => {
    const result = checkStamp(undefined, { fingerprint: fingerprint(TREE), buildId: 'build-1' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('build stage');
  });

  it('refuses a .next built from another commit, a tracked edit or a new untracked file', () => {
    for (const changed of [
      { ...TREE, head: 'b'.repeat(40) },
      { ...TREE, diff: '+edit' },
      { ...TREE, untracked: ['new-file.ts'] },
    ]) {
      const result = checkStamp(stamp, { fingerprint: fingerprint(changed), buildId: 'build-1' });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('another tree');
    }
  });

  it('refuses a .next whose build id changed after the stamp, or that has none, or a stamp it cannot read', () => {
    const current = { fingerprint: fingerprint(TREE) };
    expect(checkStamp(stamp, { ...current, buildId: 'build-2' }).valid).toBe(false);
    expect(checkStamp(stamp, { ...current, buildId: undefined }).valid).toBe(false);
    expect(checkStamp('{not json', { ...current, buildId: 'build-1' }).valid).toBe(false);
  });

  it('changes when an untracked file is edited after the stamp, not only when one appears', () => {
    const dir = repo();
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).stdout.trim();
    writeFileSync(join(dir, 'new.ts'), 'one');
    const before = fingerprint(readTree(dir, head));
    writeFileSync(join(dir, 'new.ts'), 'two');
    expect(fingerprint(readTree(dir, head))).not.toBe(before);
  });

  it('changes when a tracked file is edited and ignores a file git ignores', () => {
    const dir = repo();
    mkdirSync(join(dir, '.next'));
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).stdout.trim();
    const before = fingerprint(readTree(dir, head));
    writeFileSync(join(dir, '.next', 'noise'), 'x');
    expect(fingerprint(readTree(dir, head))).toBe(before);
    writeFileSync(join(dir, 'tracked.ts'), 'export const x = 1;\n');
    expect(fingerprint(readTree(dir, head))).not.toBe(before);
  });
});
