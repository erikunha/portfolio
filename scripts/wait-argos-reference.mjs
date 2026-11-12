#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const REFERENCE_STATE = Object.freeze({
  ready: 'ready',
  pending: 'pending',
  absent: 'absent',
  timeout: 'timeout',
});

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

export function referenceState(run, jobs) {
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
  sleep = (ms) => delay(ms),
  intervalMs = POLL_INTERVAL_MS,
  deadlineMs = WAIT_DEADLINE_MS,
  log = console.error,
}) {
  const start = now();
  for (;;) {
    let state = REFERENCE_STATE.pending;
    try {
      state = await readState();
    } catch (error) {
      log(`${LOG_PREFIX} reading the merge base run failed: ${error.message}`);
    }
    if (state !== REFERENCE_STATE.pending) return state;
    if (now() - start + intervalMs > deadlineMs) return REFERENCE_STATE.timeout;
    log(`${LOG_PREFIX} the merge base visual jobs have not uploaded yet, waiting`);
    await sleep(intervalMs);
  }
}

async function github(path, token) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} on ${path}`);
  return response.json();
}

export function githubReader({ repository, token, baseRef, headSha }) {
  return async () => {
    const compare = await github(
      `/repos/${repository}/compare/${encodeURIComponent(baseRef)}...${headSha}?per_page=${SINGLE_RESULT}`,
      token,
    );
    const mergeBase = compare.merge_base_commit.sha;
    const runs = await github(
      `/repos/${repository}/actions/workflows/${CI_WORKFLOW_FILE}/runs?head_sha=${mergeBase}&event=${PUSH_EVENT}&per_page=${SINGLE_RESULT}`,
      token,
    );
    const run = runs.workflow_runs[0];
    if (!run) return referenceState(undefined, []);
    const { jobs } = await github(
      `/repos/${repository}/actions/runs/${run.id}/jobs?per_page=${JOBS_PAGE_SIZE}`,
      token,
    );
    return referenceState(run, jobs);
  };
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
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
