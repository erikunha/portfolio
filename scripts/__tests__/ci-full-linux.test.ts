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
  type DockerRun,
  type DockerRunOptions,
  dockerProblem,
  dockerRunArgs,
  dockerStageCommand,
  escapeSpec,
  forgetPulledImages,
  keepsSpec,
  linuxImage,
  listedSpecs,
  lockfileHash,
  mergeSpecs,
  nodeModulesVolume,
  playwrightVersion,
  pruneStaleVolumes,
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
  env: containerEnv({ APT_CACHE_DIR: '/var/cache/ci-apt' }),
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
    expect(CONTAINER_SCRIPT).toContain('corepack enable');
    expect(CONTAINER_SCRIPT).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(CONTAINER_SCRIPT.indexOf('corepack enable')).toBeLessThan(
      CONTAINER_SCRIPT.indexOf('pnpm install'),
    );
    expect(CONTAINER_SCRIPT.endsWith('exec pnpm playwright test "$@"')).toBe(true);
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
      return listing(['e2e/drawer-dialog.spec.ts', 'visual/visual.spec.ts'], join(ROOT, 'tests'));
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

  it('treats unreadable playwright output as no changed spec', () => {
    expect(listedSpecs('', ROOT)).toEqual([]);
    expect(changedSpecs(ROOT, 'HEAD', 'chromium', () => 'Error: no tests found')).toEqual([]);
  });

  it('refuses a base git does not know', () => {
    expect(() => changedSpecs(ROOT, 'refs/heads/no-such-base', 'chromium', () => '')).toThrow(
      'merge-base',
    );
  });

  it('merges the gate and the changed specs without a duplicate', () => {
    expect(mergeSpecs(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('docker availability', () => {
  const IMAGE = 'mcr.microsoft.com/playwright:v0.0.0-noble';
  const stub = (failing: string[]): { run: DockerRun; calls: string[][] } => {
    const calls: string[][] = [];
    const run: DockerRun = (args) => {
      calls.push(args);
      return {
        status:
          failing.includes(args[0] ?? '') || failing.includes(args.slice(0, 2).join(' ')) ? 1 : 0,
        stdout: '',
      };
    };
    return { run, calls };
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
