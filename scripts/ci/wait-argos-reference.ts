import { setTimeout as delay } from 'node:timers/promises';
import { isMain } from '../lib/is-main.ts';

export const REFERENCE_STATE = Object.freeze({
  ready: 'ready',
  pending: 'pending',
  absent: 'absent',
  timeout: 'timeout',
});

export type ReferenceState = (typeof REFERENCE_STATE)[keyof typeof REFERENCE_STATE];

interface RunInfo {
  status: string;
}

interface JobInfo {
  name: string;
  status: string;
}

export const VISUAL_JOB_PREFIX = 'e2e-visual-chromium';
export const CI_WORKFLOW_FILE = 'ci.yml';
export const POLL_INTERVAL_MS = 20_000;
export const WAIT_DEADLINE_MS = 20 * 60_000;
const COMPLETED = 'completed';
const PUSH_EVENT = 'push';
const GITHUB_API = 'https://api.github.com';
const JOBS_PAGE_SIZE = 100;
const SINGLE_RESULT = 1;
export const REQUEST_TIMEOUT_MS = 30_000;
const LOG_PREFIX = '[wait-argos-reference]';

export function referenceState(run: RunInfo | undefined, jobs: JobInfo[]): ReferenceState {
  if (!run) return REFERENCE_STATE.absent;
  if (run.status === COMPLETED) return REFERENCE_STATE.ready;
  const visualJobs = jobs.filter((job) => job.name.startsWith(VISUAL_JOB_PREFIX));
  if (visualJobs.length > 0 && visualJobs.every((job) => job.status === COMPLETED)) {
    return REFERENCE_STATE.ready;
  }
  return REFERENCE_STATE.pending;
}

export async function waitForReference({
  readState,
  now = Date.now,
  sleep = (ms: number) => delay(ms),
  intervalMs = POLL_INTERVAL_MS,
  deadlineMs = WAIT_DEADLINE_MS,
  log = console.error,
}: {
  readState: () => Promise<ReferenceState>;
  now?: () => number;
  sleep?: (ms: number) => Promise<unknown>;
  intervalMs?: number;
  deadlineMs?: number;
  log?: (message: string) => void;
}): Promise<ReferenceState> {
  const start = now();
  for (;;) {
    let state: ReferenceState = REFERENCE_STATE.pending;
    try {
      state = await readState();
    } catch (error) {
      log(
        `${LOG_PREFIX} reading the merge base run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (state !== REFERENCE_STATE.pending) return state;
    if (now() - start + intervalMs > deadlineMs) return REFERENCE_STATE.timeout;
    log(`${LOG_PREFIX} the merge base visual jobs have not uploaded yet, waiting`);
    await sleep(intervalMs);
  }
}

async function github<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} on ${path}`);
  return (await response.json()) as T;
}

export function githubReader({
  repository,
  token,
  baseRef,
  headSha,
}: {
  repository: string;
  token: string;
  baseRef: string;
  headSha: string;
}): () => Promise<ReferenceState> {
  return async () => {
    const compare = await github<{ merge_base_commit: { sha: string } }>(
      `/repos/${repository}/compare/${encodeURIComponent(baseRef)}...${headSha}?per_page=${SINGLE_RESULT}`,
      token,
    );
    const mergeBase = compare.merge_base_commit.sha;
    const runs = await github<{ workflow_runs: Array<RunInfo & { id: number }> }>(
      `/repos/${repository}/actions/workflows/${CI_WORKFLOW_FILE}/runs?head_sha=${mergeBase}&event=${PUSH_EVENT}&per_page=${SINGLE_RESULT}`,
      token,
    );
    const run = runs.workflow_runs[0];
    if (!run) return referenceState(undefined, []);
    const { jobs } = await github<{ jobs: JobInfo[] }>(
      `/repos/${repository}/actions/runs/${run.id}/jobs?per_page=${JOBS_PAGE_SIZE}`,
      token,
    );
    return referenceState(run, jobs);
  };
}

if (isMain(import.meta.url)) {
  const { GITHUB_REPOSITORY, GITHUB_TOKEN, ARGOS_BASE_REF, ARGOS_HEAD_SHA } = process.env;
  if (!GITHUB_REPOSITORY || !GITHUB_TOKEN || !ARGOS_BASE_REF || !ARGOS_HEAD_SHA) {
    console.error(`${LOG_PREFIX} not a pull request build, nothing to wait for`);
    process.exit(0);
  }
  const state = await waitForReference({
    readState: githubReader({
      repository: GITHUB_REPOSITORY,
      token: GITHUB_TOKEN,
      baseRef: ARGOS_BASE_REF,
      headSha: ARGOS_HEAD_SHA,
    }),
  });
  console.error(`${LOG_PREFIX} merge base reference: ${state}`);
  process.exit(0);
}
