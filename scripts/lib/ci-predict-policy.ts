import type { Workflow } from './ci-workflow';

export type JobPolicy = 'run' | 'e2e-narrowed' | 'ai-eval' | 'github-only' | 'report-only' | 'gate';

export const JOB_POLICIES: Record<string, JobPolicy> = {
  'detect-changes': 'run',
  'quality-fast': 'run',
  typecheck: 'run',
  test: 'run',
  'dependency-review': 'github-only',
  build: 'run',
  performance: 'run',
  'e2e-functional': 'e2e-narrowed',
  'ai-eval': 'ai-eval',
  'e2e-visual-chromium': 'run',
  'ci-gate': 'gate',
  semgrep: 'report-only',
  gitleaks: 'run',
};

export const POLICY_REASONS: Record<'github-only' | 'report-only', string> = {
  'github-only': 'needs the GitHub dependency graph, not reproducible locally',
  'report-only': 'report-only in CI and outside ci-gate',
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
  'pnpm check': 'pnpm biome ci .',
  'pnpm test': 'pnpm test:coverage',
};

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
export const VERCEL_CLI_VERSION = '65.2.0';
export const DEFAULT_REPEAT = 3;
