import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  changedSpecs,
  containerEnv,
  dockerProblem,
  dockerStageCommand,
  isComponentProject,
  LINUX_RESULTS_DIR,
  type LinuxScope,
  linuxImage,
  lockfileHash,
  mergeSpecs,
  nodeModulesVolume,
  playwrightVersion,
  pruneStaleVolumes,
  readLockfile,
  readPnpmVersion,
} from './ci-full-linux';
import { verifyLeaves } from './verify';

export interface StageContext {
  root: string;
  base: string;
  port: number | null;
  origin: string | null;
  workDir: string;
  workflowEnv?: Record<string, string>;
  listing?: boolean;
}

export interface ContainerSpec {
  name: string;
  label: string;
}

export interface StageCommand {
  file: string;
  args: string[];
  env?: Record<string, string>;
  unset?: string[];
  container?: ContainerSpec;
}

export interface Stage {
  id: string;
  title: string;
  jobs: readonly string[];
  mirrors: readonly string[];
  steps: readonly string[];
  server?: boolean;
  requires?: string;
  unavailable?: (ctx: StageContext) => string | undefined;
  produces?: 'build';
  prepare?: (ctx: StageContext) => void;
  command: (ctx: StageContext) => StageCommand;
}

export interface ServerSpec {
  command: StageCommand;
  portEnv: string;
}

export interface Exclusion {
  id: string;
  reason: string;
  job?: string;
}

export const DEFAULT_BASE = 'origin/main';
export const WORKERS = 2;

export const CI_BUILD_ENV = {
  DEPLOY_SALT: 'ci-build-salt',
  E2E_LINKS_FEED_FIXTURE: 'tests/e2e/fixtures/links-feed.json',
};
const PLAYWRIGHT_CI_ENV = { CI: 'true' };
const LOCAL_ORIGIN = /^http:\/\/localhost:3000/;
const COMPONENTS_SUFFIX = '-components';
const PAGE_SPECS = 'tests/e2e/';
const VISUAL_SPEC = 'tests/visual/visual.spec.ts';
const A11Y_SPECS = 'tests/a11y';
const DESIGN_SYSTEM_SPEC = 'tests/e2e/design-system-components.spec.ts';
const GITLEAKS_FIXTURE_SCRIPT = 'scripts/gates/check-gitleaks-fixture.ts';
const GITLEAKS_HISTORY = '--full-history HEAD';
const SEMGREP_FIXTURE_SCRIPT = 'scripts/gates/check-semgrep-fixture.ts';
const SEMGREP_FP_SCRIPT = 'scripts/gates/measure-semgrep-fp.ts';
const CI_WORKFLOW_FILE = '.github/workflows/ci.yml';
const SEMGREP_PIN = /semgrep==(\d+\.\d+\.\d+)/;
const SEMGREP_VERSION_LINE = /^(\d+\.\d+\.\d+)\s*$/m;
const SEMGREP_PROBE_TIMEOUT_MS = 30_000;
const COMPOUND = '&&';
const PNPM_PREFIX = 'pnpm ';
const VERIFY_RUNNER = 'tsx scripts/ci/verify.ts';

export const SERVER: ServerSpec = {
  command: { file: 'pnpm', args: ['start'], env: { ...CI_BUILD_ENV } },
  portEnv: 'PORT',
};

export function semgrepVersionProblem(
  installed: string | undefined,
  pinned: string | undefined,
): string | undefined {
  if (pinned === undefined) return `the semgrep pin could not be read from ${CI_WORKFLOW_FILE}`;
  if (installed === undefined) return `semgrep did not report a version; CI pins ${pinned}`;
  if (installed !== pinned) {
    return `semgrep ${installed} is installed but CI pins ${pinned}; the blocking steps run only on the pinned version`;
  }
  return undefined;
}

let probedSemgrepVersion: { value: string | undefined } | undefined;

function installedSemgrepVersion(): string | undefined {
  if (probedSemgrepVersion === undefined) {
    const probe = spawnSync('semgrep', ['--version'], {
      encoding: 'utf8',
      timeout: SEMGREP_PROBE_TIMEOUT_MS,
      env: { ...process.env, SEMGREP_ENABLE_VERSION_CHECK: '0' },
    });
    probedSemgrepVersion = {
      value: probe.error === undefined ? SEMGREP_VERSION_LINE.exec(probe.stdout)?.[1] : undefined,
    };
  }
  return probedSemgrepVersion.value;
}

function pinnedSemgrepVersion(root: string): string | undefined {
  try {
    return SEMGREP_PIN.exec(readFileSync(join(root, CI_WORKFLOW_FILE), 'utf8'))?.[1];
  } catch {
    return undefined;
  }
}

const semgrepUnavailable = (ctx: StageContext): string | undefined =>
  semgrepVersionProblem(installedSemgrepVersion(), pinnedSemgrepVersion(ctx.root));

export const commandText = (command: StageCommand): string =>
  [command.file, ...command.args].join(' ');

const plain = (
  id: string,
  title: string,
  jobs: readonly string[],
  file: string,
  args: string[],
  extra: Partial<Stage> = {},
): Stage => ({
  id,
  title,
  jobs,
  mirrors: extra.mirrors ?? [commandText({ file, args })],
  steps: [],
  command: () => ({ file, args }),
  ...extra,
});

const playwrightEnv = (ctx: StageContext): Record<string, string> => ({
  ...PLAYWRIGHT_CI_ENV,
  E2E_BASE_URL: ctx.origin ?? '',
});

const playwright = (
  id: string,
  title: string,
  jobs: readonly string[],
  mirror: string,
  env: (ctx: StageContext) => Record<string, string> = playwrightEnv,
): Stage => {
  const [file = '', ...args] = mirror.split(' ');
  return {
    id,
    title,
    jobs,
    mirrors: [mirror],
    steps: [],
    server: true,
    command: (ctx) => ({ file, args: [...args, `--workers=${WORKERS}`], env: env(ctx) }),
  };
};

const withoutCi = (stage: Stage): Stage => ({
  ...stage,
  command: (ctx) => ({ ...stage.command(ctx), unset: ['CI'] }),
});

const E2E_PROJECTS = [
  'chromium',
  'chromium-mobile',
  'webkit-desktop',
  'webkit-mobile',
  'chromium-components',
  'chromium-mobile-components',
  'webkit-desktop-components',
  'webkit-mobile-components',
];

const e2eMirror = (project: string): string =>
  project.endsWith(COMPONENTS_SUFFIX)
    ? `pnpm playwright test --project=${project}`
    : `pnpm playwright test --project=${project} ${PAGE_SPECS}`;

const lighthouse = (id: string, title: string, configFile: string, mirror: string): Stage => ({
  id,
  title,
  jobs: ['performance'],
  mirrors: [mirror],
  steps: [],
  server: true,
  prepare: (ctx) => {
    const source = JSON.parse(readFileSync(join(ctx.root, configFile), 'utf8'));
    const derived = lighthouseConfig(source, ctx.port ?? 0, join(ctx.workDir, `${id}-report`));
    writeFileSync(join(ctx.workDir, configFile), JSON.stringify(derived, null, 2));
  },
  command: (ctx) => ({
    file: 'pnpm',
    args: ['exec', 'lhci', 'autorun', `--config=${join(ctx.workDir, configFile)}`],
  }),
});

interface LighthouseConfig {
  ci: {
    collect: { url: string[]; [key: string]: unknown };
    [key: string]: unknown;
  };
}

export function lighthouseConfig<T extends LighthouseConfig>(
  config: T,
  port: number,
  outputDir: string,
): T {
  const copy = JSON.parse(JSON.stringify(config)) as T;
  copy.ci.collect.url = copy.ci.collect.url.map((url) =>
    url.replace(LOCAL_ORIGIN, `http://localhost:${port}`),
  );
  copy.ci.upload = { target: 'filesystem', outputDir };
  return copy;
}

export const STAGES: readonly Stage[] = [
  plain('ci-local', 'Verify chain (pnpm ci:local)', ['quality-fast', 'typecheck', 'test'], 'pnpm', [
    'ci:local',
  ]),
  {
    id: 'commitlint',
    title: 'Commit messages',
    jobs: [],
    mirrors: [],
    steps: ['Lint commit messages'],
    command: (ctx) => ({
      file: 'pnpm',
      args: ['exec', 'commitlint', '--from', ctx.base, '--to', 'HEAD', '--verbose'],
    }),
  },
  plain(
    'gitleaks-selftest',
    'Gitleaks fires on its fixture',
    ['gitleaks'],
    'pnpm',
    ['exec', 'tsx', GITLEAKS_FIXTURE_SCRIPT],
    { requires: 'gitleaks' },
  ),
  {
    id: 'gitleaks',
    title: 'Secret scan of the full history',
    jobs: ['gitleaks'],
    mirrors: [],
    steps: ['Scan the history reachable from the checked-out commit'],
    requires: 'gitleaks',
    command: () => ({
      file: 'gitleaks',
      args: [
        'git',
        '.',
        '--no-banner',
        '--redact',
        '--config',
        '.gitleaks.toml',
        `--log-opts=${GITLEAKS_HISTORY}`,
      ],
    }),
  },
  plain('audit', 'Dependency vulnerability audit', ['test'], 'pnpm', [
    'audit',
    '--audit-level=moderate',
  ]),
  plain('tool-pins', 'Scanner pins are current', [], 'pnpm', ['check:tool-pins']),
  plain('mutation-canary', 'Mutation runner canary', ['test'], 'pnpm', [
    'exec',
    'tsx',
    'scripts/gates/check-mutation-kills.ts',
    '--canary',
  ]),
  plain(
    'semgrep-selftest',
    'Semgrep vendored rules fire on the fixture',
    ['semgrep'],
    'node',
    [SEMGREP_FIXTURE_SCRIPT],
    { requires: 'semgrep', unavailable: semgrepUnavailable },
  ),
  plain(
    'semgrep-fp-baseline',
    'Semgrep false-positive baseline',
    ['semgrep'],
    'node',
    [SEMGREP_FP_SCRIPT],
    { requires: 'semgrep', unavailable: semgrepUnavailable },
  ),
  {
    ...plain('build', 'Production build', ['build'], 'pnpm', ['build']),
    produces: 'build',
    command: () => ({ file: 'pnpm', args: ['build'], env: { ...CI_BUILD_ENV } }),
  },
  plain('bundle-check', 'Bundle size gate', ['build'], 'pnpm', [
    'exec',
    'tsx',
    'scripts/gates/check-bundle-size.ts',
    '--max-client-kb=220',
  ]),
  plain('route-js-check', 'Per-route JS budget gate', ['build'], 'pnpm', [
    'exec',
    'tsx',
    'scripts/gates/check-route-js.ts',
  ]),
  playwright(
    'a11y',
    'Accessibility scan (tests/a11y)',
    ['performance'],
    `pnpm playwright test ${A11Y_SPECS}`,
  ),
  ...E2E_PROJECTS.map((project) =>
    playwright(
      `e2e-${project}`,
      `Functional e2e on ${project}`,
      ['e2e-functional'],
      e2eMirror(project),
    ),
  ),
  ...['chromium', 'chromium-mobile'].map((project) =>
    playwright(
      `visual-${project}`,
      `Visual regression on ${project}`,
      ['e2e-visual-chromium'],
      `pnpm playwright test --project=${project} ${VISUAL_SPEC}`,
    ),
  ),
  withoutCi({
    ...playwright(
      'design-system-components',
      'Design-system components spec on chromium (macOS baselines)',
      [],
      `pnpm playwright test --project=chromium ${DESIGN_SYSTEM_SPEC}`,
      (ctx) => ({ E2E_BASE_URL: ctx.origin ?? '' }),
    ),
    mirrors: [],
  }),
  lighthouse('lhci-desktop', 'Lighthouse desktop', 'lighthouserc.json', 'pnpm lhci'),
  lighthouse('lhci-mobile', 'Lighthouse mobile', 'lighthouserc.mobile.json', 'pnpm lhci:mobile'),
];

export const LINUX_GATE_SPECS: readonly string[] = [
  'tests/e2e/drawer-exit-interactive.spec.ts',
  'tests/e2e/drawer-dialog.spec.ts',
  'tests/e2e/drawer-dock-narrow.spec.ts',
  'tests/e2e/motion-switch.spec.ts',
  'tests/e2e/section-navigation.spec.ts',
  'tests/e2e/streamed-settle.spec.ts',
];

export const LINUX_GATE_COMPONENT_SPECS: readonly string[] = [
  'components/sections/Hero/Hero.e2e.ts',
  'components/sections/Footer/Footer.e2e.ts',
  'components/client/ContactForm/ContactForm.e2e.ts',
  'components/sections/ContactSection/ContactSection.e2e.ts',
];

export const LINUX_PROJECTS = [
  'webkit-desktop',
  'webkit-mobile',
  'webkit-desktop-components',
  'webkit-mobile-components',
  'chromium',
];

export const LINUX_ALL_ONLY_PROJECTS = [
  'chromium-mobile',
  'chromium-components',
  'chromium-mobile-components',
];

export const CHANGED_PLACEHOLDER = '<specs-changed-since-the-merge-base>';
export const LINUX_STAGE_PREFIX = 'linux-e2e-';

function linuxSpecs(scope: LinuxScope, project: string, ctx: StageContext): string[] {
  if (scope === 'all') return isComponentProject(project) ? [] : [PAGE_SPECS];
  const gate = isComponentProject(project) ? LINUX_GATE_COMPONENT_SPECS : LINUX_GATE_SPECS;
  if (scope === 'gate') return [...gate];
  const changed =
    ctx.listing === true ? [CHANGED_PLACEHOLDER] : changedSpecs(ctx.root, ctx.base, project);
  return mergeSpecs(gate, changed);
}

function linuxStage(scope: LinuxScope, project: string, runId: number): Stage {
  const id = `${LINUX_STAGE_PREFIX}${project}`;
  const lockfile = (ctx: StageContext): string => readLockfile(ctx.root);
  const image = (ctx: StageContext): string => linuxImage(playwrightVersion(lockfile(ctx)));
  const volume = (ctx: StageContext): string => nodeModulesVolume(lockfileHash(lockfile(ctx)));
  return {
    id,
    title: `Linux e2e on ${project} (Docker, CI image)`,
    jobs: ['e2e-functional'],
    mirrors: [e2eMirror(project)],
    steps: [],
    server: true,
    requires: 'docker',
    unavailable: (ctx) => dockerProblem(image(ctx)),
    prepare: (ctx) => {
      mkdirSync(join(ctx.workDir, LINUX_RESULTS_DIR, id), { recursive: true });
      pruneStaleVolumes(volume(ctx));
    },
    command: (ctx) =>
      dockerStageCommand({
        root: ctx.root,
        workDir: ctx.workDir,
        stageId: id,
        project,
        image: image(ctx),
        volume: volume(ctx),
        runId,
        origin: ctx.origin ?? '',
        env: containerEnv(ctx.workflowEnv ?? {}, readPnpmVersion(ctx.root)),
        specs: linuxSpecs(scope, project, ctx),
      }),
  };
}

export const linuxStages = (scope: LinuxScope, runId: number = process.pid): readonly Stage[] =>
  (scope === 'all' ? [...LINUX_PROJECTS, ...LINUX_ALL_ONLY_PROJECTS] : LINUX_PROJECTS).map(
    (project) => linuxStage(scope, project, runId),
  );

export const LINUX_STAGES: readonly Stage[] = linuxStages('gate');

export const LINUX_NOT_RUN: Exclusion = {
  id: 'linux e2e',
  reason:
    'pass --linux[=gate|changed|all] to run the WebKit and Chromium e2e stages in the CI Linux image',
};

export const NOT_RUN: readonly Exclusion[] = [
  {
    id: 'ci-gate',
    job: 'ci-gate',
    reason: 'aggregates the results of the other jobs; ci:full reports them itself',
  },
  {
    id: 'ai-eval',
    job: 'ai-eval',
    reason: 'spends model gateway credits and runs only for a PR labelled ai-eval',
  },
  {
    id: 'ask:eval',
    reason: 'spends model gateway credits; run pnpm ask:eval by hand after editing its inputs',
  },
  {
    id: 'detect-changes',
    job: 'detect-changes',
    reason: 'decides which jobs a PR runs; ci:full runs every stage whatever changed',
  },
  {
    id: 'dependency-review',
    job: 'dependency-review',
    reason: 'reads the GitHub dependency graph of a pull request',
  },
  {
    id: 'coverage-comment',
    job: 'coverage-comment',
    reason: 'posts a comment on a GitHub pull request',
  },
  {
    id: 'attest-build',
    job: 'attest-build',
    reason: 'signs the build with GitHub OIDC on main only',
  },
  {
    id: 'semgrep',
    job: 'semgrep',
    reason:
      'the scan is report-only in CI; pnpm lint:semgrep runs it on request. The blocking self-test and false-positive baseline have their own stages',
  },
];

export const UNMIRRORED_CI_STEPS: ReadonlyMap<string, string> = new Map([
  ['Install', 'the local checkout already has its dependencies installed'],
  ['Check if pnpm-lock.yaml changed', 'ci:full runs the audit whatever changed'],
  ['Check if the mutation runner surface changed', 'ci:full runs the canary whatever changed'],
  ['Download gitleaks release tarball', 'the local gitleaks is the one installed on this machine'],
  [
    'Install gitleaks (checksum-verified, exact-pinned)',
    'the local gitleaks is the one installed on this machine',
  ],
  ['Fail on findings', 'the gitleaks stage fails on any non-zero exit of the scan'],
  [
    'Install Semgrep (exact-pinned) and resolve its path',
    'the semgrep stages compare the installed version with the pin and report a difference as not-run',
  ],
  ['Run Semgrep (SARIF, report-only)', 'report-only in CI; pnpm lint:semgrep runs it on request'],
  ['Assert Semgrep produced a report', 'the scan that writes the report is not run'],
  ['Write the build provenance manifest', 'only the attestation on main reads it'],
  ['Runner image version', 'names the GitHub runner image for the browser cache key'],
  ['Playwright version', 'names the Playwright release for the apt cache key'],
  [
    'Prepare apt cache directory',
    'a local machine installs browser dependencies through its own package manager',
  ],
  ['Install Playwright Chromium (for axe-core scan)', 'browsers are installed once per machine'],
  ['Install Playwright browsers', 'browsers are installed once per machine'],
  ['Start preview server', 'the runner starts a fresh server for each stage that serves'],
  ['Wait for server', 'the runner waits for the server it started before each stage'],
  ['Wait for the Argos reference of the merge base', 'needs a pull request and the Argos token'],
  ['Regenerate visual baselines (workflow_dispatch only)', 'runs only on a manual dispatch'],
]);

const SUPERSEDED_BY: Record<string, string> = {
  'pnpm check': 'pnpm biome ci --error-on-warnings .',
  'pnpm test': 'pnpm test:coverage',
};

export const QUALITY_FAST_CI_ONLY_STEPS: ReadonlyMap<string, string> = new Map([
  ['Install', 'the local checkout already has its dependencies installed'],
  ['Lint branch name', 'the pre-push hook enforces the branch name before the push leaves'],
  ['Lint commit messages', 'the commit-msg hook runs commitlint on every local commit'],
]);

export function chainLeaves(scripts: Record<string, string>, name: string): string[] {
  const body = scripts[name] ?? '';
  if (body.trim() === VERIFY_RUNNER) return verifyLeaves();
  return body
    .split(COMPOUND)
    .map((part) => part.trim())
    .flatMap((part) => {
      const target = part.startsWith(PNPM_PREFIX) ? part.slice(PNPM_PREFIX.length) : undefined;
      const nested = target === undefined ? undefined : scripts[target];
      return target !== undefined &&
        (nested?.includes(COMPOUND) || nested?.trim() === VERIFY_RUNNER)
        ? chainLeaves(scripts, target)
        : [part];
    });
}

export function coveredByCi(
  leaf: string,
  ciCommands: string[],
  scripts: Record<string, string>,
): boolean {
  const target = leaf.startsWith(PNPM_PREFIX) ? leaf.slice(PNPM_PREFIX.length) : undefined;
  const spelled = target === undefined ? undefined : scripts[target];
  const accepted = new Set([leaf, spelled, SUPERSEDED_BY[leaf]].filter((v) => v !== undefined));
  return ciCommands.some((command) => accepted.has(command.trim()));
}
