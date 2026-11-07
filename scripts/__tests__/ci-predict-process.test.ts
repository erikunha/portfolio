import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  activeGroupIds,
  envKeyNames,
  gitFilesMatch,
  killAllChildren,
  localEnvBlanks,
  runProcess,
  runShell,
  shellCommand,
  staleSessions,
  startTracked,
  waitForOwnServer,
} from '../lib/ci-predict-process';

const dirs: string[] = [];
const servers: Server[] = [];
const children: ChildProcess[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ci-predict-test-'));
  dirs.push(dir);
  return dir;
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
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return check();
}

afterEach(() => {
  killAllChildren();
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const server of servers.splice(0)) server.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('shellCommand', () => {
  it('stops at the first failing line by default, the way a GitHub run step does', () => {
    expect(shellCommand(undefined, 'x')).toEqual({ file: 'bash', args: ['-e', '-c', 'x'] });
  });

  it('adds pipefail for an explicit bash shell and keeps sh strict', () => {
    expect(shellCommand('bash', 'x')?.args).toEqual([
      '--noprofile',
      '--norc',
      '-eo',
      'pipefail',
      '-c',
      'x',
    ]);
    expect(shellCommand('sh', 'x')).toEqual({ file: 'sh', args: ['-e', '-c', 'x'] });
  });

  it('refuses a shell it cannot reproduce instead of running the script in another one', () => {
    expect(shellCommand('pwsh', 'x')).toBeUndefined();
    expect(shellCommand('python', 'x')).toBeUndefined();
  });
});

describe('runShell', () => {
  it('fails a multi-line step whose first line fails, instead of reporting the last line', async () => {
    const dir = scratch();
    const result = await runShell('false\necho reached-the-second-line', {
      shell: undefined,
      cwd: dir,
      env: {},
      logPath: join(dir, 'log'),
    });
    expect(result.code).not.toBe(0);
    expect(readFileSync(join(dir, 'log'), 'utf8')).not.toContain('reached-the-second-line');
  });

  it('fails a pipeline whose first command fails under an explicit bash shell', async () => {
    const dir = scratch();
    const result = await runShell('false | cat\necho reached', {
      shell: 'bash',
      cwd: dir,
      env: {},
      logPath: join(dir, 'log'),
    });
    expect(result.code).not.toBe(0);
  });

  it('runs in the requested working directory', async () => {
    const dir = scratch();
    mkdirSync(join(dir, 'sub'));
    const result = await runShell('basename "$PWD"', {
      shell: undefined,
      cwd: join(dir, 'sub'),
      env: {},
      logPath: join(dir, 'log'),
    });
    expect(result.code).toBe(0);
    expect(readFileSync(join(dir, 'log'), 'utf8').trim()).toBe('sub');
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

  it('gives a child the blank instead of the inherited real value, and lets a step env win', async () => {
    const dir = scratch();
    const previous = process.env.CI_PREDICT_SECRET;
    process.env.CI_PREDICT_SECRET = 'real-value';
    try {
      const run = async (env: Record<string, string>) => {
        const logPath = join(dir, `log-${Object.keys(env).length}`);
        await runShell('printf "[%s]" "$CI_PREDICT_SECRET"', {
          shell: undefined,
          cwd: dir,
          env,
          blank: { CI_PREDICT_SECRET: '' },
          logPath,
        });
        return readFileSync(logPath, 'utf8');
      };
      expect(await run({})).toBe('[]');
      expect(await run({ CI_PREDICT_SECRET: 'from-step' })).toBe('[from-step]');
    } finally {
      if (previous === undefined) delete process.env.CI_PREDICT_SECRET;
      else process.env.CI_PREDICT_SECRET = previous;
    }
  });

  it('keeps the real value out of the app: Next does not reload a key that the process already blanked', async () => {
    const dir = scratch();
    writeFileSync(join(dir, '.env.local'), 'LEAK_PROBE=real-value\n');
    const nextRequire = createRequire(require.resolve('next/package.json'));
    const envModule = nextRequire.resolve('@next/env');
    const probe = (env: Record<string, string>) =>
      new Promise<string>((resolve) => {
        const child = spawn(
          process.execPath,
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
});

describe('child cleanup', () => {
  it('kills the whole process group of a running step', async () => {
    const dir = scratch();
    const running = runProcess('sh', ['-c', 'sleep 300 & wait'], {
      cwd: dir,
      env: {},
      logPath: join(dir, 'log'),
    });
    expect(await waitUntil(() => activeGroupIds().length === 1, 2000)).toBe(true);
    const [group] = activeGroupIds();
    killAllChildren();
    await running;
    expect(await waitUntil(() => !alive(group ?? 0), 2000)).toBe(true);
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'leaves no child behind when the predictor receives %s',
    async (signal) => {
      const dir = scratch();
      const parent = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          join(process.cwd(), 'scripts/__tests__/fixtures/ci-predict-signal-child.ts'),
          join(dir, 'log'),
        ],
        { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'inherit'] },
      );
      children.push(parent);
      let out = '';
      parent.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
      });
      expect(await waitUntil(() => /group \d+/.test(out), 15000)).toBe(true);
      const group = Number(/group (\d+)/.exec(out)?.[1]);
      expect(alive(group)).toBe(true);
      parent.kill(signal);
      await new Promise((resolve) => parent.on('close', resolve));
      expect(await waitUntil(() => !alive(group), 3000)).toBe(true);
    },
    30000,
  );
});

describe('waitForOwnServer', () => {
  const OPTIONS = { timeoutMs: 4000, pollMs: 25 };

  it('resolves for the server the child started', async () => {
    const dir = scratch();
    const port = await freePort();
    const child = startTracked(
      process.execPath,
      ['-e', `require('http').createServer((q, r) => r.end('ok')).listen(${port})`],
      { cwd: dir, env: {}, logPath: join(dir, 'server.log') },
    );
    await expect(
      waitForOwnServer({ url: `http://localhost:${port}`, port, child, ...OPTIONS }),
    ).resolves.toBeUndefined();
  });

  it('fails as soon as the child exits, even when another process answers on that port', async () => {
    const dir = scratch();
    const rogue = createServer((_req, res) => res.end('rogue'));
    servers.push(rogue);
    const port = await new Promise<number>((resolve) =>
      rogue.listen(0, () => resolve((rogue.address() as { port: number }).port)),
    );
    const child = startTracked(process.execPath, ['-e', 'process.exit(3)'], {
      cwd: dir,
      env: {},
      logPath: join(dir, 'server.log'),
    });
    await expect(
      waitForOwnServer({ url: `http://localhost:${port}`, port, child, ...OPTIONS }),
    ).rejects.toThrow(/exited with code 3/);
  });

  it('does not accept another process answering while the child is still alive', async () => {
    const dir = scratch();
    const rogue = createServer((_req, res) => res.end('rogue'));
    servers.push(rogue);
    const port = await new Promise<number>((resolve) =>
      rogue.listen(0, () => resolve((rogue.address() as { port: number }).port)),
    );
    const child = startTracked(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], {
      cwd: dir,
      env: {},
      logPath: join(dir, 'server.log'),
    });
    await expect(
      waitForOwnServer({
        url: `http://localhost:${port}`,
        port,
        child,
        timeoutMs: 600,
        pollMs: 25,
      }),
    ).rejects.toThrow(/not the server this run started/);
  });
});

describe('staleSessions', () => {
  it('lists the containers whose owning predictor is gone and keeps the live one', () => {
    const listing = ['ci-predict-111 111', 'ci-predict-222 222', 'ci-predict-333 not-a-pid'];
    expect(staleSessions(listing, (pid) => pid === 111)).toEqual([
      'ci-predict-222',
      'ci-predict-333',
    ]);
  });
});

describe('gitFilesMatch', () => {
  it('matches a glob against tracked and untracked files and ignores ignored ones', () => {
    const dir = scratch();
    const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '--quiet');
    mkdirSync(join(dir, 'app/deep'), { recursive: true });
    writeFileSync(join(dir, 'app/deep/a.ts'), '');
    writeFileSync(join(dir, 'semgrep.sarif'), '');
    writeFileSync(join(dir, '.gitignore'), 'ignored.txt\n');
    writeFileSync(join(dir, 'ignored.txt'), '');
    expect(gitFilesMatch(dir, 'app/**')).toBe(true);
    expect(gitFilesMatch(dir, 'semgrep.sarif')).toBe(true);
    expect(gitFilesMatch(dir, 'tsconfig*.json')).toBe(false);
    expect(gitFilesMatch(dir, 'ignored.txt')).toBe(false);
  });
});
