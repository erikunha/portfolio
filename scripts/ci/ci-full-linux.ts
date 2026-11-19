import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gitText } from '../lib/git';
import type { StageCommand } from './ci-full-stages';

export const LINUX_SCOPES = ['gate', 'changed', 'all'] as const;
export type LinuxScope = (typeof LINUX_SCOPES)[number];
export const DEFAULT_LINUX_SCOPE: LinuxScope = 'changed';

export const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright';
export const PLAYWRIGHT_IMAGE_SUFFIX = 'noble';
export const NODE_MODULES_VOLUME_PREFIX = 'ci-full-nm-';
export const PNPM_VOLUME = 'ci-full-pnpm-store';
export const CONTAINER_LABEL_KEY = 'ci-full.run';
export const CONTAINER_NAME_PREFIX = 'ci-full-';
export const HOST_ALIAS = 'host.docker.internal';
export const CONTAINER_WORKDIR = '/work';
export const CONTAINER_PNPM_HOME = '/pnpm';
export const CONTAINER_RESULTS = '/results';
export const CONTAINER_CPUS = 2;
export const CONTAINER_WORKERS = 2;

export const LINUX_RESULTS_DIR = 'linux-results';
const LOCKFILE = 'pnpm-lock.yaml';
const LOCKFILE_HASH_LENGTH = 12;
const HASH = 'sha256';
const PLAYWRIGHT_LOCK_ENTRY = /^ {2}'@playwright\/test@(\d+\.\d+\.\d+)':/m;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const SPEC_ROOT_PAGES = 'tests/e2e/';
const SPEC_EXCLUDED_ROOTS = ['tests/visual/', 'tests/a11y/'];
const COMPONENTS_SUFFIX = '-components';
const DOCKER = 'docker';
const DOCKER_OK = 0;
const PLAYWRIGHT_LIST_BUFFER_BYTES = 256 * 1024 * 1024;
const PLAYWRIGHT_LIST_TIMEOUT_MS = 120_000;

const FORWARDER_SOURCE = [
  'const net = require("net");',
  'const origin = new URL(process.env.E2E_BASE_URL);',
  'const port = Number(origin.port);',
  'net.createServer((client) => {',
  `const upstream = net.connect(port, "${HOST_ALIAS}");`,
  'client.pipe(upstream);',
  'upstream.pipe(client);',
  'client.on("error", () => upstream.destroy());',
  'upstream.on("error", () => client.destroy());',
  '}).listen(port);',
].join(' ');

export const CONTAINER_SCRIPT = [
  `node -e '${FORWARDER_SOURCE}' &`,
  'corepack enable',
  'pnpm install --frozen-lockfile --ignore-scripts',
  'exec pnpm playwright test "$@"',
].join(' && ');

export interface DockerRunOptions {
  root: string;
  workDir: string;
  stageId: string;
  project: string;
  image: string;
  volume: string;
  runId: number;
  origin: string;
  env: Record<string, string>;
  specs: readonly string[];
}

export function playwrightVersion(lockfile: string): string {
  const version = PLAYWRIGHT_LOCK_ENTRY.exec(lockfile)?.[1];
  if (version === undefined) {
    throw new Error(`${LOCKFILE} has no resolved @playwright/test entry to pick the image from`);
  }
  return version;
}

export const lockfileHash = (lockfile: string): string =>
  createHash(HASH).update(lockfile).digest('hex').slice(0, LOCKFILE_HASH_LENGTH);

export const linuxImage = (version: string): string =>
  `${PLAYWRIGHT_IMAGE}:v${version}-${PLAYWRIGHT_IMAGE_SUFFIX}`;

export const nodeModulesVolume = (hash: string): string => `${NODE_MODULES_VOLUME_PREFIX}${hash}`;

export const containerName = (runId: number, stageId: string): string =>
  `${CONTAINER_NAME_PREFIX}${runId}-${stageId}`;

export const containerLabel = (runId: number): string => `${CONTAINER_LABEL_KEY}=${runId}`;

export const escapeSpec = (spec: string): string => spec.replace(REGEX_SPECIALS, '\\$&');

export const isComponentProject = (project: string): boolean => project.endsWith(COMPONENTS_SUFFIX);

export function dockerRunArgs(options: DockerRunOptions): string[] {
  const name = containerName(options.runId, options.stageId);
  const env = Object.entries({ ...options.env, E2E_BASE_URL: options.origin }).flatMap(
    ([key, value]) => ['-e', `${key}=${value}`],
  );
  return [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    `--cpus=${CONTAINER_CPUS}`,
    `--name=${name}`,
    `--label=${containerLabel(options.runId)}`,
    `--add-host=${HOST_ALIAS}:host-gateway`,
    ...env,
    '-v',
    `${options.root}:${CONTAINER_WORKDIR}:ro`,
    '-v',
    `${options.volume}:${CONTAINER_WORKDIR}/node_modules`,
    '-v',
    `${PNPM_VOLUME}:${CONTAINER_PNPM_HOME}`,
    '-v',
    `${CONTAINER_WORKDIR}/.next`,
    '-v',
    `${join(options.workDir, LINUX_RESULTS_DIR, options.stageId)}:${CONTAINER_RESULTS}`,
    '-w',
    CONTAINER_WORKDIR,
    options.image,
    'sh',
    '-c',
    CONTAINER_SCRIPT,
    'sh',
    `--project=${options.project}`,
    `--workers=${CONTAINER_WORKERS}`,
    `--output=${CONTAINER_RESULTS}`,
    ...options.specs.map(escapeSpec),
  ];
}

export function dockerStageCommand(options: DockerRunOptions): StageCommand {
  return {
    file: DOCKER,
    args: dockerRunArgs(options),
    container: {
      name: containerName(options.runId, options.stageId),
      label: containerLabel(options.runId),
    },
  };
}

export const containerEnv = (workflowEnv: Record<string, string>): Record<string, string> => ({
  CI: 'true',
  ...workflowEnv,
  COREPACK_HOME: `${CONTAINER_PNPM_HOME}/corepack`,
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  npm_config_store_dir: `${CONTAINER_PNPM_HOME}/store`,
});

export function readLockfile(root: string): string {
  return readFileSync(join(root, LOCKFILE), 'utf8');
}

export interface PlaywrightListing {
  config: { rootDir: string };
  suites: { file: string }[];
}

export type ListRunner = (args: string[], cwd: string, env: Record<string, string>) => string;

const runPlaywrightList: ListRunner = (args, cwd, env) => {
  const run = spawnSync('pnpm', ['playwright', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: PLAYWRIGHT_LIST_BUFFER_BYTES,
    timeout: PLAYWRIGHT_LIST_TIMEOUT_MS,
  });
  return run.stdout;
};

export function listedSpecs(output: string, root: string): string[] {
  let listing: PlaywrightListing;
  try {
    listing = JSON.parse(output) as PlaywrightListing;
  } catch {
    return [];
  }
  return [
    ...new Set(
      listing.suites.map((suite) => relative(root, resolve(listing.config.rootDir, suite.file))),
    ),
  ];
}

export function keepsSpec(project: string, spec: string): boolean {
  if (SPEC_EXCLUDED_ROOTS.some((excluded) => spec.startsWith(excluded))) return false;
  return isComponentProject(project) || spec.startsWith(SPEC_ROOT_PAGES);
}

const changedCache = new Map<string, string[]>();

export function changedSpecs(
  root: string,
  base: string,
  project: string,
  list: ListRunner = runPlaywrightList,
): string[] {
  const mergeBase = gitText(['merge-base', 'HEAD', base], { cwd: root });
  const key = `${root}|${mergeBase}|${project}`;
  const cached = changedCache.get(key);
  if (cached !== undefined) return cached;
  const output = list(
    ['test', `--only-changed=${mergeBase}`, `--project=${project}`, '--list', '--reporter=json'],
    root,
    { CI: 'true' },
  );
  const specs = listedSpecs(output, root).filter((spec) => keepsSpec(project, spec));
  changedCache.set(key, specs);
  return specs;
}

export function mergeSpecs(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())];
}

export type DockerRun = (args: string[]) => { status: number | null; stdout: string };

const dockerRun: DockerRun = (args) => {
  const run = spawnSync(DOCKER, args, { encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout ?? '' };
};

const pulled = new Map<string, string | undefined>();

export function dockerProblem(image: string, run: DockerRun = dockerRun): string | undefined {
  if (run(['info']).status !== DOCKER_OK) return 'the Docker daemon is not running';
  if (pulled.has(image)) return pulled.get(image);
  let problem: string | undefined;
  if (run(['image', 'inspect', image]).status !== DOCKER_OK) {
    problem = run(['pull', image]).status === DOCKER_OK ? undefined : `docker pull ${image} failed`;
  }
  pulled.set(image, problem);
  return problem;
}

export function forgetPulledImages(): void {
  pulled.clear();
}

export function staleVolumes(listed: string, current: string): string[] {
  return listed
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name.startsWith(NODE_MODULES_VOLUME_PREFIX) && name !== current);
}

export function pruneStaleVolumes(current: string, run: DockerRun = dockerRun): string[] {
  const listed = run(['volume', 'ls', '--quiet', '--filter', `name=${NODE_MODULES_VOLUME_PREFIX}`]);
  const stale = staleVolumes(listed.stdout, current);
  for (const name of stale) run(['volume', 'rm', name]);
  return stale;
}

export function removeContainer(name: string, run: DockerRun = dockerRun): void {
  run(['rm', '--force', '--volumes', name]);
}

export function sweepContainers(label: string, run: DockerRun = dockerRun): void {
  const listed = run(['ps', '--all', '--quiet', '--filter', `label=${label}`]);
  const ids = listed.stdout.split('\n').filter(Boolean);
  if (ids.length > 0) run(['rm', '--force', '--volumes', ...ids]);
}
