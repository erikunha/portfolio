import type { Workflow } from './ci-workflow';

export type JobPolicy = 'run' | 'e2e-narrowed' | 'ai-eval' | 'github-only' | 'report-only' | 'gate';

export const JOB_POLICIES: Record<string, JobPolicy> = {
  'detect-changes': 'run',
  'quality-fast': 'run',
  typecheck: 'run',
  test: 'run',
  'dependency-review': 'github-only',
  'coverage-comment': 'github-only',
  build: 'run',
  'attest-build': 'github-only',
  performance: 'run',
  'e2e-functional': 'e2e-narrowed',
  'ai-eval': 'ai-eval',
  'e2e-visual-chromium': 'run',
  'ci-gate': 'gate',
  semgrep: 'report-only',
  gitleaks: 'run',
};

export const POLICY_REASONS: Record<'github-only' | 'report-only', string> = {
  'github-only':
    'needs a GitHub-side service (dependency graph, OIDC, comments), not reproducible locally',
  'report-only': 'findings scan is report-only in CI and needs the pinned Semgrep install',
};

export type ActionClass = 'infra' | 'publish' | 'unreproducible';

export const ACTION_CLASSES: Record<string, ActionClass> = {
  'actions/checkout': 'infra',
  'pnpm/action-setup': 'infra',
  'actions/setup-node': 'infra',
  'actions/setup-python': 'infra',
  'actions/cache': 'infra',
  'actions/upload-artifact': 'infra',
  'actions/download-artifact': 'infra',
  'actions/github-script': 'publish',
  'actions/attest-build-provenance': 'publish',
  'github/codeql-action/upload-sarif': 'publish',
  'actions/dependency-review-action': 'unreproducible',
};

export const actionName = (uses: string): string => uses.split('@')[0] ?? uses;

export function unmappedJobs(
  workflow: Workflow,
  policies: Record<string, JobPolicy>,
): { missing: string[]; stale: string[] } {
  const present = Object.keys(workflow.jobs);
  return {
    missing: present.filter((id) => !(id in policies)),
    stale: Object.keys(policies).filter((id) => !present.includes(id)),
  };
}

export function unclassifiedActions(workflow: Workflow): string[] {
  const found = new Set<string>();
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) {
      if (step.uses !== undefined && !(actionName(step.uses) in ACTION_CLASSES)) {
        found.add(actionName(step.uses));
      }
    }
  }
  return [...found];
}

const SUPERSEDED_BY: Record<string, string> = {
  'pnpm check': 'pnpm biome ci --error-on-warnings .',
  'pnpm test': 'pnpm test:coverage',
};

export const QUALITY_FAST_CI_ONLY_STEPS: ReadonlyMap<string, string> = new Map([
  ['Install', 'the local checkout already has its dependencies installed'],
  ['Lint branch name', 'the pre-push hook enforces the branch name before the push leaves'],
  ['Lint commit messages', 'the commit-msg hook runs commitlint on every local commit'],
]);

const COMPOUND = '&&';
const PNPM_PREFIX = 'pnpm ';

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

export const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright';
export const PLAYWRIGHT_IMAGE_SUFFIX = 'noble';
export const AI_EVAL_LABEL = 'ai-eval';
export const VERCEL_CLI_VERSION = '65.2.0';
export const DEFAULT_REPEAT = 3;

export const HOST_MOUNT = '/host';
export const CONTAINER_ROOT = '/work';
export const CONTAINER_PORT = 3000;
export const SESSION_OWNER_LABEL = 'ci-predict.owner';
export const SESSION_NAME_PREFIX = 'ci-predict-';
export const SERVER_LOG_PATH = '/tmp/server.log';
export const SERVER_PID_PATH = '/tmp/server.pid';
export const DRY_SERVER_URL = 'http://localhost:0';
export const LOCAL_REPOSITORY = 'local/repository';
export const CI_ARCH = 'x64';
export const MAIN_BASE = 'origin/main';
export const INTEGRATION_BASE_PREFIX = 'origin/feat/';

export const EXIT = { OK: 0, FAILED: 1, DRY_RUN: 2, NOT_VERIFIED: 3 } as const;

export const serverKey = (env: Record<string, string>): string =>
  JSON.stringify(Object.entries(env).sort(([a], [b]) => a.localeCompare(b)));

export function chooseBase(candidates: { ref: string; ahead: number }[]): string | undefined {
  let best: { ref: string; ahead: number } | undefined;
  for (const candidate of candidates) {
    if (best === undefined || candidate.ahead < best.ahead) best = candidate;
  }
  return best?.ref;
}

export function archCaveat(arch: string): string | undefined {
  if (arch === CI_ARCH) return undefined;
  return `this machine is ${arch} and CI runs ${CI_ARCH}: the Linux container runs ${arch} too, so font metrics, WebKit rendering and timing can differ from CI`;
}
export const BUILD_COMMAND = 'pnpm build';

export const FORECAST_JOBS = ['e2e-functional', 'e2e-visual-chromium'];
export const FORECAST_BUDGET_SHARE = 0.8;
export const SECONDS_PER_MINUTE = 60;

export interface RateSample {
  run: number;
  job: number;
  tests: number;
  seconds: number;
}

const RUN_PR_421 = 43589844151;
const RUN_MAIN = 43399768414;

export const RATE_SAMPLES: Record<string, Record<string, RateSample[]>> = {
  'e2e-functional': {
    chromium: [
      { run: RUN_PR_421, job: 132433950666, tests: 1809, seconds: 616.8 },
      { run: RUN_MAIN, job: 131802593841, tests: 1307, seconds: 433.0 },
    ],
    'chromium-mobile': [
      { run: RUN_PR_421, job: 132433950678, tests: 1115, seconds: 348.8 },
      { run: RUN_MAIN, job: 131802593898, tests: 653, seconds: 214.0 },
    ],
    'webkit-desktop': [
      { run: RUN_PR_421, job: 132433950815, tests: 1094, seconds: 1444.9 },
      { run: RUN_MAIN, job: 131802594035, tests: 653, seconds: 539.3 },
    ],
    'webkit-mobile': [
      { run: RUN_PR_421, job: 132433950694, tests: 1090, seconds: 1420.0 },
      { run: RUN_MAIN, job: 131802593868, tests: 653, seconds: 924.8 },
    ],
    'chromium-components': [
      { run: RUN_PR_421, job: 132433950789, tests: 160, seconds: 69.1 },
      { run: RUN_MAIN, job: 131802593817, tests: 160, seconds: 66.9 },
    ],
    'chromium-mobile-components': [
      { run: RUN_PR_421, job: 132433950748, tests: 160, seconds: 96.3 },
      { run: RUN_MAIN, job: 131802593839, tests: 160, seconds: 78.2 },
    ],
    'webkit-desktop-components': [
      { run: RUN_PR_421, job: 132433950794, tests: 160, seconds: 243.0 },
      { run: RUN_MAIN, job: 131802593899, tests: 160, seconds: 176.2 },
    ],
    'webkit-mobile-components': [
      { run: RUN_PR_421, job: 132433950784, tests: 160, seconds: 311.6 },
      { run: RUN_MAIN, job: 131802593840, tests: 160, seconds: 224.5 },
    ],
  },
  'e2e-visual-chromium': {
    chromium: [
      { run: RUN_PR_421, job: 132433950662, tests: 10, seconds: 14.8 },
      { run: RUN_MAIN, job: 131802593763, tests: 6, seconds: 8.7 },
    ],
    'chromium-mobile': [
      { run: RUN_PR_421, job: 132433950596, tests: 10, seconds: 26.5 },
      { run: RUN_MAIN, job: 131802593650, tests: 6, seconds: 6.2 },
    ],
  },
};

export function secondsPerTest(job: string, project: string): number {
  const samples = RATE_SAMPLES[job]?.[project];
  if (samples === undefined || samples.length === 0) {
    throw new Error(`no CI timing sample for ${job} (${project}); add one to RATE_SAMPLES`);
  }
  return Math.max(...samples.map((sample) => sample.seconds / sample.tests));
}
