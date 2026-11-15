import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { afterEach, describe, expect, it } from 'vitest';
import { exitCode, runStages, type StageResult } from '../lib/ci-full-run';
import {
  commandText,
  STAGES,
  type Stage,
  type StageContext,
  semgrepVersionProblem,
} from '../lib/ci-full-stages';
import { parseWorkflow } from '../lib/ci-workflow';

const ROOT = process.cwd();
const NODE = process.execPath;
const FIXTURE = join(ROOT, 'scripts/__tests__/fixtures/ci-full-sigterm-ignorer.ts');
const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const POLL_MS = 25;
const DEAD_WITHIN_MS = 2000;
const STAGE_TIMEOUT_MS = 5000;
const READY_TIMEOUT_MS = 10_000;
const CTX: StageContext = {
  root: ROOT,
  base: 'origin/main',
  port: 4321,
  origin: 'http://localhost:4321',
  workDir: '/tmp/ci-full-test',
};
const OPTIONS = { keepGoing: false, readyTimeoutMs: READY_TIMEOUT_MS, log: () => undefined };

const dirs: string[] = [];
const spawned: number[] = [];

const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-full-fixes-'));
  dirs.push(dir);
  return dir;
};

const stage = (id: string): Stage => {
  const found = STAGES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no stage ${id}`);
  return found;
};

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

const pidsOf = (file: string): number[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(Number) : [];

function git(dir: string, ...args: string[]): void {
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
}

function repo(): string {
  const dir = join(scratch(), 'repo');
  mkdirSync(dir);
  git(dir, 'init', '--quiet');
  writeFileSync(join(dir, '.gitignore'), '.next\n');
  writeFileSync(join(dir, 'tracked.ts'), 'export {};\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'init');
  return dir;
}

afterEach(() => {
  for (const pid of spawned.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL');
      // biome-ignore lint/suspicious/noEmptyBlockStatements: the process is already gone
    } catch {}
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const verdicts = (results: StageResult[]) =>
  Object.fromEntries(results.map((result) => [result.id, result.verdict]));

describe('gitleaks scans what the CI job scans', () => {
  const ci = parseWorkflow(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
  const scanRun =
    (ci.jobs.gitleaks?.steps ?? []).find((step) => step.name?.startsWith('Scan the history'))
      ?.run ?? '';
  const flagValue = (flag: string): string | undefined =>
    new RegExp(`${flag}[= ]"?([^"\\s\\\\][^"\\\\\\n]*?)"?(?:\\s*\\\\|\\s*$)`, 'm').exec(
      scanRun,
    )?.[1];

  it('reads the scan flags out of ci.yml', () => {
    expect(flagValue('--log-opts')).toBe('--full-history HEAD');
    expect(flagValue('--config')).toBe('.gitleaks.toml');
  });

  it('scans the full history reachable from HEAD with the same config, whatever the base', () => {
    const args = stage('gitleaks').command({ ...CTX, base: 'origin/some-other-base' }).args;
    expect(args).toContain(`--log-opts=${flagValue('--log-opts')}`);
    expect(args.join(' ')).toContain(`--config ${flagValue('--config')}`);
    expect(args.join(' ')).not.toContain('some-other-base');
  });

  it('runs the fixture self-test before the scan, with the binary it needs', () => {
    const ids = STAGES.map((candidate) => candidate.id);
    const selfTest = stage('gitleaks-selftest');
    expect(commandText(selfTest.command(CTX))).toBe(
      'pnpm exec tsx scripts/gates/check-gitleaks-fixture.ts',
    );
    expect(selfTest.requires).toBe('gitleaks');
    expect(ids.indexOf('gitleaks-selftest')).toBeLessThan(ids.indexOf('gitleaks'));
  });

  it('keeps every fake token still in the published history allowlisted by value', () => {
    const config = parseToml(readFileSync(join(ROOT, '.gitleaks.toml'), 'utf8')) as {
      allowlists?: { regexes?: string[]; paths?: string[] }[];
    };
    const regexes = (config.allowlists ?? []).flatMap((entry) => entry.regexes ?? []);
    const historyTokens = ['ghp', 'ghs', 'gho', 'ghu', 'ghr'].map(
      (prefix) => `${prefix}_AbCdEf0123456789012345`,
    );
    for (const token of historyTokens) {
      expect(
        regexes.some((pattern) => new RegExp(pattern).test(token)),
        `${token} is in the history; a full-history scan reports it unless a value allowlist names it`,
      ).toBe(true);
    }
    expect((config.allowlists ?? []).filter((entry) => entry.paths !== undefined)).toEqual([]);
  });
});

describe('a descendant that ignores SIGTERM does not outlive its stage', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  const ignorer = (pidFile: string) => ({
    file: NODE,
    args: [FIXTURE, 'parent', pidFile],
  });

  it('kills it when the stage serving it ends', async () => {
    const root = repo();
    const pidFile = join(scratch(), 'child.pid');
    mkdirSync(join(root, '.next'));
    writeFileSync(join(root, '.next/BUILD_ID'), 'b1');
    const build: Stage = {
      id: 'build',
      title: 'build',
      jobs: [],
      mirrors: [],
      steps: [],
      produces: 'build',
      command: () => ({ file: NODE, args: ['-e', ''] }),
    };
    const served: Stage = {
      id: 'served',
      title: 'served',
      jobs: [],
      mirrors: [],
      steps: [],
      server: true,
      command: () => ({ file: NODE, args: ['-e', ''] }),
    };
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: { command: ignorer(pidFile), portEnv: 'PORT' },
      stages: [build, served],
    });
    spawned.push(...pidsOf(pidFile));
    expect(verdicts(results)).toEqual({ build: 'passed', served: 'passed' });
    const [orphan] = pidsOf(pidFile);
    expect(orphan, 'the fixture child recorded its pid').toBeGreaterThan(0);
    expect(await waitUntil(() => !alive(orphan ?? 0), DEAD_WITHIN_MS)).toBe(true);
  });

  it('kills it when the stage that timed out leaves it behind', async () => {
    const root = repo();
    const pidFile = join(scratch(), 'child.pid');
    const hung: Stage = {
      id: 'hung',
      title: 'hung',
      jobs: [],
      mirrors: [],
      steps: [],
      command: () => ignorer(pidFile),
    };
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      stageTimeoutMs: STAGE_TIMEOUT_MS,
      server: { command: ignorer(pidFile), portEnv: 'PORT' },
      stages: [hung],
    });
    await waitUntil(() => pidsOf(pidFile).length > 0, DEAD_WITHIN_MS);
    spawned.push(...pidsOf(pidFile));
    expect(results[0]?.verdict).toBe('failed');
    expect(results[0]?.note).toContain('timed out');
    const [orphan] = pidsOf(pidFile);
    expect(orphan, 'the fixture child recorded its pid').toBeGreaterThan(0);
    expect(await waitUntil(() => !alive(orphan ?? 0), DEAD_WITHIN_MS)).toBe(true);
  });
});

describe('the design-system stage runs without CI even when the shell exports it', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  it('hands its command an environment with no CI', async () => {
    const root = repo();
    const out = join(scratch(), 'ci.txt');
    const real = stage('design-system-components').command(CTX);
    const probe: Stage = {
      id: 'probe',
      title: 'probe',
      jobs: [],
      mirrors: [],
      steps: [],
      command: () => ({
        ...real,
        file: NODE,
        args: ['-e', `require('fs').writeFileSync(${JSON.stringify(out)}, String(process.env.CI))`],
      }),
    };
    process.env.CI = 'true';
    try {
      await runStages({
        ...OPTIONS,
        root,
        base: 'HEAD',
        server: { command: { file: NODE, args: [] }, portEnv: 'PORT' },
        stages: [probe],
      });
    } finally {
      delete process.env.CI;
    }
    expect(readFileSync(out, 'utf8')).toBe('undefined');
  });
});

describe('semgrep: the blocking steps of the job run when the install matches the pin', () => {
  const PINNED = '1.185.0';

  it('has no problem when the installed version is the pinned one', () => {
    expect(semgrepVersionProblem('1.185.0', PINNED)).toBeUndefined();
  });

  it('names the installed and the pinned version when they differ', () => {
    const problem = semgrepVersionProblem('1.169.0', PINNED) ?? '';
    expect(problem).toContain('1.169.0');
    expect(problem).toContain(PINNED);
  });

  it('says so when the installed version cannot be read', () => {
    expect(semgrepVersionProblem(undefined, PINNED)).toContain(PINNED);
  });

  it('says so when the pin cannot be read', () => {
    expect(semgrepVersionProblem('1.185.0', undefined)).toContain('pin');
  });

  it('runs the self-test and the false-positive baseline, each needing semgrep', () => {
    expect(commandText(stage('semgrep-selftest').command(CTX))).toBe(
      'node scripts/check-semgrep-fixture.mjs',
    );
    expect(commandText(stage('semgrep-fp-baseline').command(CTX))).toBe(
      'node scripts/measure-semgrep-fp.mjs',
    );
    expect(stage('semgrep-selftest').requires).toBe('semgrep');
    expect(stage('semgrep-fp-baseline').requires).toBe('semgrep');
  });

  it('reads the pin from ci.yml and reports a mismatch as the reason the stage is unavailable', {
    timeout: SUBPROCESS_TEST_TIMEOUT_MS,
  }, () => {
    const root = scratch();
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(join(root, '.github/workflows/ci.yml'), 'run: pip install semgrep==0.0.1\n');
    const reason = stage('semgrep-selftest').unavailable?.({ ...CTX, root });
    expect(reason).toContain('0.0.1');
  });

  it('reports a stage that is unavailable as not-run with its reason, and the run is not verified', async () => {
    const root = repo();
    const out = join(scratch(), 'ran.txt');
    const results = await runStages({
      ...OPTIONS,
      root,
      base: 'HEAD',
      server: { command: { file: NODE, args: [] }, portEnv: 'PORT' },
      stages: [
        {
          id: 'gated',
          title: 'gated',
          jobs: [],
          mirrors: [],
          steps: [],
          unavailable: () => 'semgrep 1.169.0 is installed but CI pins 1.185.0',
          command: () => ({
            file: NODE,
            args: ['-e', `require('fs').writeFileSync(${JSON.stringify(out)}, 'ran')`],
          }),
        },
      ],
    });
    expect(results[0]?.verdict).toBe('not-run');
    expect(results[0]?.note).toBe('semgrep 1.169.0 is installed but CI pins 1.185.0');
    expect(existsSync(out)).toBe(false);
    expect(exitCode(results)).toBe(3);
  });
});
