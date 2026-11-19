import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTAINER_CPUS,
  CONTAINER_SCRIPT,
  changedSpecs,
  containerEnv,
  containerLabel,
  containerName,
  DOCKER_PULL_TIMEOUT_MS,
  type DockerCallOptions,
  type DockerRun,
  type DockerRunOptions,
  dockerProblem,
  dockerRunArgs,
  dockerStageCommand,
  escapeSpec,
  forgetPulledImages,
  keepsSpec,
  type ListOutcome,
  linuxImage,
  listedSpecs,
  lockfileHash,
  mergeSpecs,
  nodeModulesVolume,
  playwrightVersion,
  pnpmVersion,
  pruneStaleVolumes,
  readPnpmVersion,
  removeContainer,
  staleVolumes,
  sweepContainers,
} from '../ci/ci-full-linux';

const ROOT = process.cwd();
const LOCKFILE = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
const PLAYWRIGHT_RANGE = /^~?(\d+\.\d+\.\d+)$/;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};
const RUN_ID = 4242;
const ORIGIN = 'http://localhost:4321';

const OPTIONS: DockerRunOptions = {
  root: '/repo',
  workDir: '/tmp/ci-full-x',
  stageId: 'linux-e2e-webkit-desktop',
  project: 'webkit-desktop',
  image: linuxImage(playwrightVersion(LOCKFILE)),
  volume: nodeModulesVolume(lockfileHash(LOCKFILE)),
  runId: RUN_ID,
  origin: ORIGIN,
  env: containerEnv({ APT_CACHE_DIR: '/var/cache/ci-apt' }, '10.1.2'),
  specs: ['tests/e2e/drawer-dialog.spec.ts', 'app/(en)/x/Y.e2e.ts'],
};

const argv = (extra: Partial<DockerRunOptions> = {}): string[] =>
  dockerRunArgs({ ...OPTIONS, ...extra });
const valueAfter = (args: string[], flag: string): string[] =>
  args.flatMap((arg, index) => (arg === flag ? [args[index + 1] ?? ''] : []));

describe('docker argv', () => {
  it('pulls the image tagged with the Playwright version the lockfile resolves', () => {
    const image = argv().find((arg) => arg.startsWith('mcr.microsoft.com/playwright:'));
    expect(image).toBe(`mcr.microsoft.com/playwright:v${playwrightVersion(LOCKFILE)}-noble`);
    const declared = PLAYWRIGHT_RANGE.exec(pkg.devDependencies['@playwright/test'] ?? '')?.[1];
    const [major, minor] = (declared ?? '').split('.');
    expect(playwrightVersion(LOCKFILE).startsWith(`${major}.${minor}.`)).toBe(true);
  });

  it('reads the version from a lockfile entry and refuses a lockfile without one', () => {
    expect(playwrightVersion("packages:\n\n  '@playwright/test@9.8.7':\n    resolution:")).toBe(
      '9.8.7',
    );
    expect(() => playwrightVersion('lockfileVersion: 9\n')).toThrow('@playwright/test');
  });

  it('installs the pnpm the repository pins, because the image ships no corepack', () => {
    expect(pnpmVersion('{ "packageManager": "pnpm@9.8.7" }')).toBe('9.8.7');
    expect(() => pnpmVersion('{}')).toThrow('packageManager');
    expect(valueAfter(argv(), '-e')).toContain('PNPM_VERSION=10.1.2');
    expect(readPnpmVersion(ROOT)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CONTAINER_SCRIPT).not.toContain('corepack');
  });

  it('limits the container to two cpus, shares the host ipc and starts an init', () => {
    const args = argv();
    expect(args).toContain(`--cpus=${CONTAINER_CPUS}`);
    expect(args).toContain('--cpus=2');
    expect(args).toContain('--ipc=host');
    expect(args).toContain('--init');
    expect(args).toContain('--rm');
  });

  it('never forces a platform, so an arm64 host runs the arm64 image natively', () => {
    const text = argv().join(' ');
    expect(text).not.toContain('--platform');
    expect(text).not.toContain('amd64');
  });

  it('mounts the repository read-only and the caches and results as volumes, results outside the read-only tree', () => {
    const mounts = valueAfter(argv(), '-v');
    expect(mounts).toContain('/repo:/work:ro');
    expect(mounts).toContain(`${OPTIONS.volume}:/work/node_modules`);
    expect(mounts).toContain('ci-full-pnpm-store:/pnpm');
    expect(mounts).toContain('/work/.next');
    expect(mounts).toContain(`/tmp/ci-full-x/linux-results/${OPTIONS.stageId}:/results`);
    expect(mounts.filter((mount) => mount.endsWith(':ro'))).toEqual(['/repo:/work:ro']);
  });

  it('keys the node_modules volume by the lockfile content', () => {
    expect(nodeModulesVolume(lockfileHash(LOCKFILE))).toMatch(/^ci-full-nm-[0-9a-f]{12}$/);
    expect(lockfileHash(LOCKFILE)).not.toBe(lockfileHash(`${LOCKFILE}\n# edit`));
  });

  it('passes an explicit environment: CI, the workflow env and the origin, nothing from the shell', () => {
    const env = valueAfter(argv(), '-e');
    expect(env).toContain('CI=true');
    expect(env).toContain('APT_CACHE_DIR=/var/cache/ci-apt');
    expect(env).toContain(`E2E_BASE_URL=${ORIGIN}`);
    expect(env.every((entry) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(entry))).toBe(true);
    expect(env.some((entry) => entry.startsWith('DEPLOY_SALT') || entry.includes('TOKEN'))).toBe(
      false,
    );
  });

  it('lets the origin override a workflow value of the same name', () => {
    const env = valueAfter(argv({ env: { E2E_BASE_URL: 'http://elsewhere' } }), '-e');
    expect(env.filter((entry) => entry.startsWith('E2E_BASE_URL='))).toEqual([
      `E2E_BASE_URL=${ORIGIN}`,
    ]);
  });

  it('names the container and labels it by run, and reaches the host by its alias', () => {
    const args = argv();
    expect(args).toContain(`--name=ci-full-${RUN_ID}-linux-e2e-webkit-desktop`);
    expect(args).toContain(`--label=ci-full.run=${RUN_ID}`);
    expect(args).toContain('--add-host=host.docker.internal:host-gateway');
    expect(containerName(RUN_ID, 'x')).toBe(`ci-full-${RUN_ID}-x`);
    expect(containerLabel(RUN_ID)).toBe(`ci-full.run=${RUN_ID}`);
  });

  it('forwards localhost to the host, installs from the lockfile without scripts, then runs playwright', () => {
    expect(CONTAINER_SCRIPT).toContain('host.docker.internal');
    expect(CONTAINER_SCRIPT).toContain('npm install --global');
    expect(CONTAINER_SCRIPT).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(CONTAINER_SCRIPT.indexOf('npm install --global')).toBeLessThan(
      CONTAINER_SCRIPT.indexOf('pnpm install'),
    );
    expect(CONTAINER_SCRIPT.endsWith('exec pnpm playwright test "$@"')).toBe(true);
  });

  it('is a script the shell parses, with the forwarder in the background', () => {
    const parsed = spawnSync('sh', ['-n'], { input: CONTAINER_SCRIPT, encoding: 'utf8' });
    expect(parsed.stderr).toBe('');
    expect(parsed.status).toBe(0);
    expect(CONTAINER_SCRIPT.startsWith("(node -e '")).toBe(true);
  });

  it('hands the project, the workers and the specs to playwright as arguments, specs escaped', () => {
    const args = argv();
    const tail = args.slice(args.indexOf('sh', args.indexOf('-c')) + 1);
    expect(tail.slice(0, 4)).toEqual([
      '--project=webkit-desktop',
      '--workers=2',
      '--output=/results',
      'tests/e2e/drawer-dialog\\.spec\\.ts',
    ]);
    expect(tail).toContain('app/\\(en\\)/x/Y\\.e2e\\.ts');
  });

  it('puts no visual or accessibility spec on the command line', () => {
    const text = argv().join(' ');
    expect(text).not.toContain('tests/visual');
    expect(text).not.toContain('tests/a11y');
  });

  it('describes the container so the runner can remove it', () => {
    const command = dockerStageCommand(OPTIONS);
    expect(command.file).toBe('docker');
    expect(command.container).toEqual({
      name: `ci-full-${RUN_ID}-linux-e2e-webkit-desktop`,
      label: `ci-full.run=${RUN_ID}`,
    });
  });

  it('escapes the characters a file name shares with a regular expression', () => {
    expect(escapeSpec('a/(b)/c.e2e.ts')).toBe('a/\\(b\\)/c\\.e2e\\.ts');
    expect(new RegExp(escapeSpec('app/(en)/x.ts')).test('app/(en)/x.ts')).toBe(true);
    expect(new RegExp(escapeSpec('x.ts')).test('xyts')).toBe(false);
  });
});

describe('changed specs', () => {
  const listing = (files: string[], rootDir = ROOT): string =>
    JSON.stringify({ config: { rootDir }, suites: files.map((file) => ({ file })) });
  const cleanExit = (stdout: string): ListOutcome => ({ status: 0, stdout, stderr: '' });

  beforeEach(() => forgetPulledImages());

  it('resolves the paths against the config root and drops visual and accessibility specs', () => {
    const output = listing(
      ['e2e/a.spec.ts', 'visual/visual.spec.ts', 'a11y/a.spec.ts'],
      join(ROOT, 'tests'),
    );
    expect(listedSpecs(output, ROOT)).toEqual([
      'tests/e2e/a.spec.ts',
      'tests/visual/visual.spec.ts',
      'tests/a11y/a.spec.ts',
    ]);
    expect(keepsSpec('webkit-desktop', 'tests/visual/visual.spec.ts')).toBe(false);
    expect(keepsSpec('webkit-desktop', 'tests/a11y/a.spec.ts')).toBe(false);
    expect(keepsSpec('webkit-desktop', 'components/x/Y.e2e.ts')).toBe(false);
    expect(keepsSpec('webkit-desktop', 'tests/e2e/a.spec.ts')).toBe(true);
    expect(keepsSpec('webkit-desktop-components', 'components/x/Y.e2e.ts')).toBe(true);
  });

  it('asks playwright for the specs changed since the merge base, on the project, in CI mode', () => {
    const seen: { args: string[]; env: Record<string, string> }[] = [];
    const specs = changedSpecs(ROOT, 'HEAD', 'webkit-mobile', (args, _cwd, env) => {
      seen.push({ args, env });
      return cleanExit(
        listing(['e2e/drawer-dialog.spec.ts', 'visual/visual.spec.ts'], join(ROOT, 'tests')),
      );
    });
    expect(specs).toEqual(['tests/e2e/drawer-dialog.spec.ts']);
    expect(seen[0]?.args).toEqual([
      'test',
      expect.stringMatching(/^--only-changed=[0-9a-f]{40}$/),
      '--project=webkit-mobile',
      '--list',
      '--reporter=json',
    ]);
    expect(seen[0]?.env).toEqual({ CI: 'true' });
  });

  it('keeps a genuinely empty listing as an empty changed set and says how many it added', () => {
    const empty = JSON.stringify({ config: { rootDir: ROOT }, suites: [], errors: [] });
    const notes: string[] = [];
    const note = (line: string): void => void notes.push(line);
    expect(changedSpecs(ROOT, 'HEAD', 'empty-json', () => cleanExit(empty), note)).toEqual([]);
    expect(
      changedSpecs(ROOT, 'HEAD', 'empty-text', () => cleanExit('No tests found\n'), note),
    ).toEqual([]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('empty-json');
    expect(notes[0]).toContain('0 changed specs');
    const two = listing(['e2e/a.spec.ts', 'e2e/b.spec.ts'], join(ROOT, 'tests'));
    changedSpecs(ROOT, 'HEAD', 'two-specs', () => cleanExit(two), note);
    expect(notes[2]).toContain('two-specs');
    expect(notes[2]).toContain('2 changed specs');
  });

  it.each<[string, Partial<ListOutcome>, RegExp]>([
    [
      'times out',
      {
        status: null,
        error: Object.assign(new Error('spawnSync pnpm ETIMEDOUT'), { code: 'ETIMEDOUT' }),
      },
      /timed out after 120s/,
    ],
    [
      'overflows the buffer',
      {
        status: null,
        error: Object.assign(new Error('spawnSync pnpm ENOBUFS'), { code: 'ENOBUFS' }),
      },
      /more output than the 256 MiB buffer/,
    ],
    [
      'cannot start',
      {
        status: null,
        error: Object.assign(new Error('spawnSync pnpm ENOENT'), { code: 'ENOENT' }),
      },
      /could not run: spawnSync pnpm ENOENT/,
    ],
    ['is killed by a signal', { status: null, signal: 'SIGKILL' }, /killed by SIGKILL/],
    [
      'exits non-zero with no listing',
      { status: 1, stderr: 'noise\nError: config failed to load\n' },
      /exited with code 1: Error: config failed to load/,
    ],
    ['prints no JSON on a clean exit', { stdout: 'garbage' }, /printed no parseable JSON/],
    ['prints JSON of another shape', { stdout: '{"suites":"x"}' }, /printed no parseable JSON/],
    [
      'reports an error with an empty suite list',
      {
        status: 1,
        stdout: JSON.stringify({
          config: { rootDir: ROOT },
          suites: [],
          errors: [
            { message: 'Error: Cannot detect changed files for --only-changed mode:\ngit diff x' },
          ],
        }),
      },
      /reported Error: Cannot detect changed files for --only-changed mode:/,
    ],
    [
      'reports an error even on a clean exit',
      {
        stdout: JSON.stringify({
          config: { rootDir: ROOT },
          suites: [],
          errors: [{ message: 'Error: bad config' }],
        }),
      },
      /reported Error: bad config/,
    ],
    ['prints a listing with no config', { stdout: '{"suites":[]}' }, /printed no parseable JSON/],
    ['prints a JSON null', { stdout: 'null' }, /printed no parseable JSON/],
    [
      'lists no suite and no error but exits non-zero',
      {
        status: 2,
        stdout: JSON.stringify({ config: { rootDir: ROOT }, suites: [], errors: [] }),
        stderr: 'killed by the host',
      },
      /exited with code 2: killed by the host/,
    ],
    [
      'says no tests found but exits non-zero',
      { status: 1, stdout: 'No tests found' },
      /exited with code 1: No tests found/,
    ],
  ])('fails the stage, naming the cause, when the listing %s', (name, outcome, message) => {
    const project = `failing-${name.replaceAll(' ', '-')}`;
    const run = () => changedSpecs(ROOT, 'HEAD', project, () => ({ ...cleanExit(''), ...outcome }));
    expect(run).toThrow(message);
    expect(run).toThrow(project);
  });

  it('does not cache a failed listing, so a later run lists again', () => {
    let calls = 0;
    const flaky = () => {
      calls += 1;
      return calls === 1
        ? { ...cleanExit(''), status: 1, stderr: 'first run failed' }
        : cleanExit(listing(['e2e/a.spec.ts'], join(ROOT, 'tests')));
    };
    expect(() => changedSpecs(ROOT, 'HEAD', 'flaky', flaky)).toThrow('first run failed');
    expect(changedSpecs(ROOT, 'HEAD', 'flaky', flaky)).toEqual(['tests/e2e/a.spec.ts']);
  });

  it('refuses a base git does not know', () => {
    expect(() =>
      changedSpecs(ROOT, 'refs/heads/no-such-base', 'chromium', () => cleanExit('')),
    ).toThrow('merge-base');
  });

  it('merges the gate and the changed specs without a duplicate', () => {
    expect(mergeSpecs(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('docker availability', () => {
  const IMAGE = 'mcr.microsoft.com/playwright:v0.0.0-noble';
  const stub = (
    failing: string[],
    timedOut = false,
  ): { run: DockerRun; calls: string[][]; options: Map<string, DockerCallOptions | undefined> } => {
    const calls: string[][] = [];
    const options = new Map<string, DockerCallOptions | undefined>();
    const run: DockerRun = (args, callOptions) => {
      calls.push(args);
      options.set(args[0] ?? '', callOptions);
      const failed =
        failing.includes(args[0] ?? '') || failing.includes(args.slice(0, 2).join(' '));
      return { status: failed ? 1 : 0, stdout: '', timedOut: failed && timedOut };
    };
    return { run, calls, options };
  };

  beforeEach(() => forgetPulledImages());

  it('reports a daemon that is down without trying to pull', () => {
    const { run, calls } = stub(['info']);
    expect(dockerProblem(IMAGE, run)).toBe('the Docker daemon is not running');
    expect(calls.map((call) => call[0])).toEqual(['info']);
  });

  it('pulls the image only when inspect fails, and only once per run', () => {
    const present = stub([]);
    expect(dockerProblem(IMAGE, present.run)).toBeUndefined();
    expect(present.calls.some((call) => call[0] === 'pull')).toBe(false);
    forgetPulledImages();
    const missing = stub(['image inspect']);
    expect(dockerProblem(IMAGE, missing.run)).toBeUndefined();
    expect(missing.calls.filter((call) => call[0] === 'pull')).toEqual([['pull', IMAGE]]);
    dockerProblem(IMAGE, missing.run);
    expect(missing.calls.filter((call) => call[0] === 'pull')).toHaveLength(1);
  });

  it('reports a failed pull as the reason the stage cannot run', () => {
    const { run } = stub(['image inspect', 'pull']);
    expect(dockerProblem(IMAGE, run)).toBe(`docker pull ${IMAGE} failed`);
  });

  it('bounds the pull by a named timeout and streams its progress, and nothing else', () => {
    const { run, options } = stub(['image inspect']);
    expect(dockerProblem(IMAGE, run)).toBeUndefined();
    expect(options.get('pull')).toEqual({ timeoutMs: DOCKER_PULL_TIMEOUT_MS, stream: true });
    expect(options.get('info')).toBeUndefined();
    expect(options.get('image')).toBeUndefined();
  });

  it('says the pull timed out, not that it failed, when it outlives its limit', () => {
    const { run } = stub(['image inspect', 'pull'], true);
    expect(dockerProblem(IMAGE, run)).toBe(`docker pull ${IMAGE} timed out after 20 minutes`);
  });

  it('keeps the node_modules volume of the current lockfile and prunes the older ones', () => {
    const listed = 'ci-full-nm-aaa\nci-full-nm-bbb\nci-full-pnpm-store\nother\n';
    expect(staleVolumes(listed, 'ci-full-nm-bbb')).toEqual(['ci-full-nm-aaa']);
    const calls: string[][] = [];
    const run: DockerRun = (args) => {
      calls.push(args);
      return { status: 0, stdout: listed };
    };
    expect(pruneStaleVolumes('ci-full-nm-bbb', run)).toEqual(['ci-full-nm-aaa']);
    expect(calls).toContainEqual(['volume', 'rm', 'ci-full-nm-aaa']);
    expect(calls).not.toContainEqual(['volume', 'rm', 'ci-full-pnpm-store']);
    expect(calls).not.toContainEqual(['volume', 'rm', 'ci-full-nm-bbb']);
  });

  it('removes a container by name and sweeps the containers of a label', () => {
    const calls: string[][] = [];
    const run: DockerRun = (args) => {
      calls.push(args);
      return { status: 0, stdout: args[0] === 'ps' ? 'id1\nid2\n' : '' };
    };
    removeContainer('ci-full-1-x', run);
    expect(calls[0]).toEqual(['rm', '--force', '--volumes', 'ci-full-1-x']);
    sweepContainers('ci-full.run=1', run);
    expect(calls[1]).toEqual(['ps', '--all', '--quiet', '--filter', 'label=ci-full.run=1']);
    expect(calls[2]).toEqual(['rm', '--force', '--volumes', 'id1', 'id2']);
  });

  it('removes nothing when no container carries the label', () => {
    const calls: string[][] = [];
    sweepContainers('ci-full.run=9', (args) => {
      calls.push(args);
      return { status: 0, stdout: '' };
    });
    expect(calls).toHaveLength(1);
  });
});
