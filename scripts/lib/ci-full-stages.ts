import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface StageContext {
  root: string;
  base: string;
  port: number | null;
  origin: string | null;
  workDir: string;
}

export interface StageCommand {
  file: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Stage {
  id: string;
  title: string;
  jobs: readonly string[];
  mirrors: readonly string[];
  steps: readonly string[];
  server?: boolean;
  requires?: string;
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

const CI_BUILD_ENV = {
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
const COMPOUND = '&&';
const PNPM_PREFIX = 'pnpm ';

export const SERVER: ServerSpec = {
  command: { file: 'pnpm', args: ['start'], env: { ...CI_BUILD_ENV } },
  portEnv: 'PORT',
};

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
  {
    id: 'gitleaks',
    title: 'Secret scan of the branch commits',
    jobs: ['gitleaks'],
    mirrors: [],
    steps: [],
    requires: 'gitleaks',
    command: (ctx) => ({
      file: 'gitleaks',
      args: [
        'git',
        '.',
        '--no-banner',
        '--redact',
        '--config',
        '.gitleaks.toml',
        `--log-opts=${ctx.base}..HEAD`,
      ],
    }),
  },
  plain('audit', 'Dependency vulnerability audit', ['test'], 'pnpm', [
    'audit',
    '--audit-level=moderate',
  ]),
  plain('tool-pins', 'Scanner pins are current', [], 'pnpm', ['check:tool-pins']),
  plain('mutation-canary', 'Mutation runner canary', ['test'], 'node', [
    'scripts/check-mutation-kills.mjs',
    '--canary',
  ]),
  {
    ...plain('build', 'Production build', ['build'], 'pnpm', ['build']),
    produces: 'build',
    command: () => ({ file: 'pnpm', args: ['build'], env: { ...CI_BUILD_ENV } }),
  },
  plain('bundle-check', 'Bundle size gate', ['build'], 'node', [
    'scripts/check-bundle-size.mjs',
    '--max-client-kb=220',
  ]),
  plain('route-js-check', 'Per-route JS budget gate', ['build'], 'node', [
    'scripts/check-route-js.mjs',
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
  {
    ...playwright(
      'design-system-components',
      'Design-system components spec on chromium (macOS baselines)',
      [],
      `pnpm playwright test --project=chromium ${DESIGN_SYSTEM_SPEC}`,
      (ctx) => ({ E2E_BASE_URL: ctx.origin ?? '' }),
    ),
    mirrors: [],
  },
  lighthouse('lhci-desktop', 'Lighthouse desktop', 'lighthouserc.json', 'pnpm lhci'),
  lighthouse('lhci-mobile', 'Lighthouse mobile', 'lighthouserc.mobile.json', 'pnpm lhci:mobile'),
];

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
    id: 'eval:agents',
    reason: 'spends model credits; run pnpm eval:agents by hand after editing AGENTS.md',
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
      'report-only in CI and needs the pinned Semgrep install; pnpm lint:semgrep runs it on request',
  },
];

export const UNMIRRORED_CI_STEPS: ReadonlyMap<string, string> = new Map([
  ['Install', 'the local checkout already has its dependencies installed'],
  ['pnpm install --frozen-lockfile', 'the local checkout already has its dependencies installed'],
  ['Check if pnpm-lock.yaml changed', 'ci:full runs the audit whatever changed'],
  ['Check if the mutation runner surface changed', 'ci:full runs the canary whatever changed'],
  ['Write the build provenance manifest', 'only the attestation on main reads it'],
  ['Runner image version', 'names the GitHub runner image for the browser cache key'],
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
  return body
    .split(COMPOUND)
    .map((part) => part.trim())
    .flatMap((part) => {
      const target = part.startsWith(PNPM_PREFIX) ? part.slice(PNPM_PREFIX.length) : undefined;
      const nested = target === undefined ? undefined : scripts[target];
      return target !== undefined && nested?.includes(COMPOUND)
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
