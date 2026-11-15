import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMain } from '../lib/is-main.ts';
import type { GithubClient, HttpError } from './github.ts';
import { createGithubClient, resolveRepo, resolveToken } from './github.ts';

export interface WeekWindow {
  start: Date;
  end: Date;
  weekStart: string;
  weekEnd: string;
}

export interface PullRequestNode {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  author?: { __typename?: string; login?: string } | null;
  commits?: { nodes?: { commit?: { authoredDate?: string | null } | null }[] } | null;
}

export interface PullRequest {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  authorIsBot: boolean;
  firstCommitAt: string | null;
}

export interface WeekMetrics {
  deploymentFrequency: number;
  deploymentFailureRate: number | null;
  leadTimeHoursMedian: number | null;
  prCycleTimeHoursMedian: number | null;
  ciMainFailureRate: number | null;
  flakyPerE2eJob: number | null;
}

export interface WeekCounts {
  prsMerged: number;
  productionDeploys: number;
  failedDeploys: number;
  ciMainRuns: number;
  e2eJobsInspected: number;
  flakyTests: number;
  distinctFlakyTests: number;
  logsTruncated: boolean;
  logErrors: number;
  logsExpired: number;
}

export interface CollectedWeek {
  weekStart: string;
  weekEnd: string;
  collectedAt: string;
  metrics: WeekMetrics;
  counts: WeekCounts;
  topFlaky: { test: string; count: number }[];
  skipped: Record<string, string>;
}

export interface CollectOptions {
  repo: string;
  windows: WeekWindow[];
  maxLogsPerWeek?: number;
  skipLogs?: boolean;
  now?: Date;
}

type DeployOutcomeName = 'success' | 'failure' | 'pending';

interface DeploymentRecord {
  createdAt: string;
  outcome: string;
}

interface CiRun {
  id: number;
  createdAt: string;
  conclusion: string;
}

interface FlakyJob {
  flaky: string[];
}

interface FlakyInspection {
  jobs: FlakyJob[];
  truncated: boolean;
  logErrors: number;
  logsExpired: number;
}

interface FlakySummary {
  e2eJobsInspected: number;
  flakyTests: number;
  distinctFlakyTests: number;
  flakyPerE2eJob: number | null;
  topFlaky: { test: string; count: number }[];
}

interface PullRequestSearch {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: (PullRequestNode | null)[];
  };
}

interface DeploymentApi {
  id: number;
  created_at: string;
}

interface WorkflowRunApi {
  id: number;
  created_at: string;
  conclusion: string;
}

interface JobApi {
  id: number;
  name: string;
  conclusion: string | null;
}

interface HistoryFile {
  schemaVersion: number;
  repo: string;
  weeks: CollectedWeek[];
}

interface CollectArgs {
  weeks: string;
  history: string;
  repo: string | undefined;
  maxLogsPerWeek: string;
  now: string | undefined;
  skipLogs: boolean;
}

type ValuedKey = 'weeks' | 'history' | 'repo' | 'maxLogsPerWeek' | 'now';
type MergedPullRequest = PullRequest & { mergedAt: string };

export const SCHEMA_VERSION = 1;
export const CI_WORKFLOW = 'ci.yml';
export const MAIN_BRANCH = 'main';
export const PRODUCTION_ENVIRONMENT = 'Production';
export const E2E_JOB_PREFIX = 'e2e-';
export const LIGHTHOUSE_SKIP_REASON =
  'Lighthouse CI uploads to temporary-public-storage and CI keeps no result file, so no per-route LCP survives a run. Collecting it needs a ci.yml step that uploads .lighthouseci as an artifact.';
export const FLAKY_SKIP_REASON = 'job logs skipped by --skip-logs';

const MS_PER_HOUR = 3_600_000;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const WEEK_MS = DAYS_PER_WEEK * MS_PER_DAY;
const MONDAY_OFFSET_FROM_SUNDAY_START = 6;
const BACKFILL_WEEKS = 13;
const MAX_HISTORY_WEEKS = 104;
const DEFAULT_MAX_LOGS_PER_WEEK = 150;
const LOG_CONCURRENCY = 6;
const STATUS_CONCURRENCY = 8;
const PAGE_SIZE = 100;
const STATUS_PAGE_SIZE = 10;
const TOP_FLAKY_COUNT = 5;
const MAX_TEST_NAME_LENGTH = 200;
const ROUND_DIGITS = 4;
const DEFAULT_HISTORY_PATH = 'metrics/weekly.json';
const CONCLUSION = Object.freeze({ SUCCESS: 'success', FAILURE: 'failure' } as const);
const COMPLETED_CONCLUSIONS: readonly string[] = [CONCLUSION.SUCCESS, CONCLUSION.FAILURE];
const DEPLOY_STATE = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  ERROR: 'error',
} as const);
const FAILED_DEPLOY_STATES: readonly string[] = [DEPLOY_STATE.FAILURE, DEPLOY_STATE.ERROR];
const DEPLOY_OUTCOME = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  PENDING: 'pending',
} as const);
const RUN_STATUS_COMPLETED = 'completed';
const EVENT_PUSH = 'push';
const ACTOR_TYPE_BOT = 'Bot';
const WEEKS_AUTO = 'auto';
const LOG_GONE_STATUSES = [404, 410];
const RESULT_CAP = 1000;
const ISO_DATE_LENGTH = 10;
const SKIP_LOGS_FLAG = '--skip-logs';
const LINE_BREAKS = /[\r\n]+/g;
const VALUED_FLAGS = new Map<string, ValuedKey>([
  ['--weeks', 'weeks'],
  ['--history', 'history'],
  ['--repo', 'repo'],
  ['--max-logs-per-week', 'maxLogsPerWeek'],
  ['--now', 'now'],
]);

const ESCAPE_CODE = 27;
const DELETE_CODE = 127;
const SPACE_CODE = 32;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(ESCAPE_CODE)}\\[[0-9;]*[A-Za-z]`, 'g');
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;
const FLAKY_HEADER_PATTERN = /^\s+(\d+) flaky\s*$/;
const SUMMARY_COUNT_PATTERN = /^\s+\d+ (?:flaky|skipped|passed|failed|did not run|interrupted)\b/;
const INDENTED_LINE_PATTERN = /^\s+\S/;
const WORKFLOW_COMMAND_PATTERN = /::/g;
const MARKUP_CHARACTERS_PATTERN = /[<>@]/g;
const BACKTICK_PATTERN = /`/g;
const WHITESPACE_RUN_PATTERN = /\s+/g;
const CARRIAGE_RETURN_END_PATTERN = /\r$/;

const PULL_REQUESTS_QUERY = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number createdAt mergedAt
        author { __typename login }
        commits(first: 1) { nodes { commit { authoredDate } } }
      }
    }
  }
}`;

const toIso = (date: Date): string => date.toISOString().replace('.000Z', 'Z');
const toDay = (date: Date): string => date.toISOString().slice(0, ISO_DATE_LENGTH);
const round = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10 ** ROUND_DIGITS) / 10 ** ROUND_DIGITS;
const hoursBetween = (from: string, to: string): number =>
  Math.max(0, (Date.parse(to) - Date.parse(from)) / MS_PER_HOUR);

function startOfWeek(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + MONDAY_OFFSET_FROM_SUNDAY_START) % DAYS_PER_WEEK;
  return new Date(day.getTime() - sinceMonday * MS_PER_DAY);
}

export function weekWindows(now: Date, count: number): WeekWindow[] {
  const current = startOfWeek(now).getTime();
  const windows: WeekWindow[] = [];
  for (let back = count; back >= 1; back -= 1) {
    const start = new Date(current - back * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    windows.push({ start, end, weekStart: toDay(start), weekEnd: toDay(end) });
  }
  return windows;
}

export function weeksToCollect({
  weeks,
  now,
  explicit,
}: {
  weeks: { weekStart: string }[];
  now: Date;
  explicit?: number | undefined;
}): number {
  if (explicit !== undefined) return explicit;
  const last = weeks
    .map((w) => w.weekStart)
    .sort()
    .at(-1);
  if (last === undefined) return BACKFILL_WEEKS;
  const gap = (startOfWeek(now).getTime() - Date.parse(last)) / WEEK_MS - 1;
  return Math.min(BACKFILL_WEEKS, Math.max(1, Math.round(gap)));
}

export function parseWeeksArg(raw: string): number | undefined {
  if (raw === WEEKS_AUTO) return undefined;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > MAX_HISTORY_WEEKS) {
    throw new Error(
      `--weeks must be "auto" or an integer from 1 to ${MAX_HISTORY_WEEKS}, got "${raw}"`,
    );
  }
  return count;
}

const inWindow = (iso: string, window: WeekWindow): boolean => {
  const at = Date.parse(iso);
  return at >= window.start.getTime() && at < window.end.getTime();
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as number;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as number) + upper) / 2;
}

export function normalizePullRequest(node: PullRequestNode): PullRequest {
  return {
    number: node.number,
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    authorIsBot: node.author?.__typename === ACTOR_TYPE_BOT,
    firstCommitAt: node.commits?.nodes?.[0]?.commit?.authoredDate ?? null,
  };
}

export function summarizePullRequests(
  prs: PullRequest[],
  window: WeekWindow,
): {
  prsMerged: number;
  leadTimeHoursMedian: number | null;
  prCycleTimeHoursMedian: number | null;
} {
  const merged = prs.filter(
    (pr): pr is MergedPullRequest =>
      typeof pr.mergedAt === 'string' && pr.mergedAt !== '' && inWindow(pr.mergedAt, window),
  );
  const human = merged.filter((pr) => !pr.authorIsBot);
  return {
    prsMerged: merged.length,
    leadTimeHoursMedian: median(
      human.map((pr) => hoursBetween(pr.firstCommitAt ?? pr.createdAt, pr.mergedAt)),
    ),
    prCycleTimeHoursMedian: median(human.map((pr) => hoursBetween(pr.createdAt, pr.mergedAt))),
  };
}

export function deploymentOutcome(statuses: { state: string }[]): DeployOutcomeName {
  const states = statuses.map((s) => s.state);
  if (states.includes(DEPLOY_STATE.SUCCESS)) return DEPLOY_OUTCOME.SUCCESS;
  if (states.some((state) => FAILED_DEPLOY_STATES.includes(state))) return DEPLOY_OUTCOME.FAILURE;
  return DEPLOY_OUTCOME.PENDING;
}

export function summarizeDeployments(
  deployments: DeploymentRecord[],
  window: WeekWindow,
): {
  productionDeploys: number;
  failedDeploys: number;
  deploymentFrequency: number;
  deploymentFailureRate: number | null;
} {
  const inRange = deployments.filter((d) => inWindow(d.createdAt, window));
  const succeeded = inRange.filter((d) => d.outcome === DEPLOY_OUTCOME.SUCCESS).length;
  const failed = inRange.filter((d) => d.outcome === DEPLOY_OUTCOME.FAILURE).length;
  const decided = succeeded + failed;
  return {
    productionDeploys: succeeded,
    failedDeploys: failed,
    deploymentFrequency: succeeded,
    deploymentFailureRate: decided === 0 ? null : failed / decided,
  };
}

export function summarizeCiRuns(
  runs: { createdAt: string; conclusion: string }[],
  window: WeekWindow,
): { ciMainRuns: number; ciMainFailureRate: number | null } {
  const completed = runs.filter(
    (run) => inWindow(run.createdAt, window) && COMPLETED_CONCLUSIONS.includes(run.conclusion),
  );
  const failed = completed.filter((run) => run.conclusion === CONCLUSION.FAILURE).length;
  return {
    ciMainRuns: completed.length,
    ciMainFailureRate: completed.length === 0 ? null : failed / completed.length,
  };
}

const isControl = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code < SPACE_CODE || code === DELETE_CODE;
};

export function sanitizeTestName(name: string): string {
  return [...String(name)]
    .map((char) => (isControl(char) ? ' ' : char))
    .join('')
    .replace(BACKTICK_PATTERN, '')
    .replace(WORKFLOW_COMMAND_PATTERN, ': :')
    .replace(MARKUP_CHARACTERS_PATTERN, '')
    .replace(WHITESPACE_RUN_PATTERN, ' ')
    .trim()
    .slice(0, MAX_TEST_NAME_LENGTH);
}

const hasTotals = (lines: string[]): boolean =>
  lines.some((line) => SUMMARY_COUNT_PATTERN.test(line));

export function parsePlaywrightFlaky(logText: string): string[] {
  const lines = String(logText)
    .split('\n')
    .map((line) =>
      line
        .replace(ANSI_PATTERN, '')
        .replace(TIMESTAMP_PATTERN, '')
        .replace(CARRIAGE_RETURN_END_PATTERN, ''),
    );
  if (!hasTotals(lines)) {
    throw new Error('the log has no Playwright totals line, so flaky tests cannot be read from it');
  }
  const names: string[] = [];
  for (const [i, headerLine] of lines.entries()) {
    const header = FLAKY_HEADER_PATTERN.exec(headerLine);
    if (header === null) continue;
    const expected = Number(header[1]);
    let taken = 0;
    for (const line of lines.slice(i + 1)) {
      if (taken >= expected) break;
      if (!INDENTED_LINE_PATTERN.test(line) || SUMMARY_COUNT_PATTERN.test(line)) break;
      names.push(sanitizeTestName(line));
      taken += 1;
    }
  }
  return names;
}

export function summarizeFlaky(jobs: FlakyJob[]): FlakySummary {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const test of job.flaky) counts.set(test, (counts.get(test) ?? 0) + 1);
  }
  const occurrences = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const topFlaky = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_FLAKY_COUNT)
    .map(([test, count]) => ({ test, count }));
  return {
    e2eJobsInspected: jobs.length,
    flakyTests: occurrences,
    distinctFlakyTests: counts.size,
    flakyPerE2eJob: jobs.length === 0 ? null : occurrences / jobs.length,
    topFlaky,
  };
}

export function upsertWeeks<T extends { weekStart: string }>(existing: T[], fresh: T[]): T[] {
  const byStart = new Map(existing.map((week) => [week.weekStart, week]));
  for (const week of fresh) byStart.set(week.weekStart, week);
  return [...byStart.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-MAX_HISTORY_WEEKS);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const queue = items.entries();
  async function worker(): Promise<void> {
    for (const [index, item] of queue) {
      results[index] = await task(item, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function assertComplete({
  what,
  window,
  fetched,
  reported,
}: {
  what: string;
  window: WeekWindow;
  fetched: number;
  reported: number | undefined;
}): void {
  if (typeof reported !== 'number') {
    throw new Error(`${what} for the week starting ${window.weekStart} reported no total`);
  }
  if (reported > fetched || fetched >= RESULT_CAP) {
    throw new Error(
      `${what} for the week starting ${window.weekStart} is incomplete: ${fetched} fetched of ${reported} reported, and the API returns at most ${RESULT_CAP} results per query`,
    );
  }
}

async function fetchPullRequests(
  client: GithubClient,
  repo: string,
  window: WeekWindow,
): Promise<PullRequest[]> {
  const q = `repo:${repo} is:pr is:merged merged:${toIso(window.start)}..${toIso(window.end)}`;
  const prs: PullRequest[] = [];
  let reported: number | undefined;
  let after: string | null = null;
  do {
    const data: PullRequestSearch = await client.graphql<PullRequestSearch>(PULL_REQUESTS_QUERY, {
      q,
      after,
    });
    reported = data.search.issueCount;
    prs.push(
      ...data.search.nodes
        .filter((node): node is PullRequestNode => node?.number !== undefined)
        .map(normalizePullRequest),
    );
    after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
  } while (after !== null);
  assertComplete({ what: 'the merged pull request search', window, fetched: prs.length, reported });
  return prs;
}

async function fetchDeployments(
  client: GithubClient,
  repo: string,
  start: Date,
  end: Date,
): Promise<DeploymentRecord[]> {
  const startMs = start.getTime();
  const listed = await client.paginate<DeploymentApi>(`/repos/${repo}/deployments`, {
    params: { environment: PRODUCTION_ENVIRONMENT, per_page: PAGE_SIZE },
    stopWhen: (page) => page.some((d) => Date.parse(d.created_at) < startMs),
  });
  const inRange = listed.filter((d) => {
    const at = Date.parse(d.created_at);
    return at >= startMs && at < end.getTime();
  });
  return mapPool(inRange, STATUS_CONCURRENCY, async (deployment) => {
    const statuses = await client.json<{ state: string }[]>(
      `/repos/${repo}/deployments/${deployment.id}/statuses`,
      { params: { per_page: STATUS_PAGE_SIZE } },
    );
    return { createdAt: deployment.created_at, outcome: deploymentOutcome(statuses) };
  });
}

async function fetchCiRuns(
  client: GithubClient,
  repo: string,
  window: WeekWindow,
  filters: Record<string, string>,
): Promise<CiRun[]> {
  let reported: number | undefined;
  const runs = await client.paginate<WorkflowRunApi>(
    `/repos/${repo}/actions/workflows/${CI_WORKFLOW}/runs`,
    {
      params: {
        status: RUN_STATUS_COMPLETED,
        per_page: PAGE_SIZE,
        created: `${toIso(window.start)}..${toIso(window.end)}`,
        ...filters,
      },
      pick: (body: { total_count: number; workflow_runs: WorkflowRunApi[] }) => {
        reported = body.total_count;
        return body.workflow_runs;
      },
    },
  );
  assertComplete({ what: 'the CI run list', window, fetched: runs.length, reported });
  return runs.map((run) => ({ id: run.id, createdAt: run.created_at, conclusion: run.conclusion }));
}

async function fetchE2eJobs(client: GithubClient, repo: string, run: CiRun): Promise<JobApi[]> {
  const jobs = await client.paginate<JobApi>(`/repos/${repo}/actions/runs/${run.id}/jobs`, {
    params: { per_page: PAGE_SIZE },
    pick: (body: { jobs: JobApi[] }) => body.jobs,
  });
  return jobs.filter(
    (job) =>
      job.name.startsWith(E2E_JOB_PREFIX) &&
      job.conclusion !== null &&
      COMPLETED_CONCLUSIONS.includes(job.conclusion),
  );
}

async function inspectFlaky(
  client: GithubClient,
  repo: string,
  runs: CiRun[],
  window: WeekWindow,
  cap: number,
): Promise<FlakyInspection> {
  const weekRuns = runs
    .filter((run) => inWindow(run.createdAt, window))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const candidates: JobApi[] = [];
  let truncated = false;
  for (const run of weekRuns) {
    if (candidates.length >= cap) {
      truncated = true;
      break;
    }
    candidates.push(...(await fetchE2eJobs(client, repo, run)));
  }
  if (candidates.length > cap) {
    candidates.length = cap;
    truncated = true;
  }
  let fetchFailures = 0;
  let parseFailures = 0;
  let logsExpired = 0;
  const inspected = await mapPool(
    candidates,
    LOG_CONCURRENCY,
    async (job): Promise<FlakyJob | null> => {
      let text: string;
      try {
        text = await client.text(`/repos/${repo}/actions/jobs/${job.id}/logs`);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        const { status } = error as HttpError;
        if (status !== undefined && LOG_GONE_STATUSES.includes(status)) logsExpired += 1;
        else fetchFailures += 1;
        return null;
      }
      try {
        return { flaky: parsePlaywrightFlaky(text) };
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        parseFailures += 1;
        return null;
      }
    },
  );
  const attempted = candidates.length - logsExpired;
  if (attempted > 0 && fetchFailures === attempted) {
    throw new Error(
      `every e2e job log (${attempted}) for the week starting ${window.weekStart} failed to download, so flaky tests were not measured`,
    );
  }
  return {
    jobs: inspected.filter((job): job is FlakyJob => job !== null),
    truncated,
    logErrors: fetchFailures + parseFailures,
    logsExpired,
  };
}

function buildWeek({
  window,
  prs,
  deployments,
  mainRuns,
  flaky,
  collectedAt,
}: {
  window: WeekWindow;
  prs: PullRequest[];
  deployments: DeploymentRecord[];
  mainRuns: CiRun[];
  flaky: FlakyInspection | null;
  collectedAt: string;
}): CollectedWeek {
  const pull = summarizePullRequests(prs, window);
  const deploy = summarizeDeployments(deployments, window);
  const ci = summarizeCiRuns(mainRuns, window);
  const skipped: Record<string, string> = { lighthouseLcp: LIGHTHOUSE_SKIP_REASON };
  const flakySummary = flaky === null ? null : summarizeFlaky(flaky.jobs);
  if (flaky === null) skipped.flaky = FLAKY_SKIP_REASON;
  return {
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    collectedAt,
    metrics: {
      deploymentFrequency: deploy.deploymentFrequency,
      deploymentFailureRate: round(deploy.deploymentFailureRate),
      leadTimeHoursMedian: round(pull.leadTimeHoursMedian),
      prCycleTimeHoursMedian: round(pull.prCycleTimeHoursMedian),
      ciMainFailureRate: round(ci.ciMainFailureRate),
      flakyPerE2eJob: round(flakySummary?.flakyPerE2eJob ?? null),
    },
    counts: {
      prsMerged: pull.prsMerged,
      productionDeploys: deploy.productionDeploys,
      failedDeploys: deploy.failedDeploys,
      ciMainRuns: ci.ciMainRuns,
      e2eJobsInspected: flakySummary?.e2eJobsInspected ?? 0,
      flakyTests: flakySummary?.flakyTests ?? 0,
      distinctFlakyTests: flakySummary?.distinctFlakyTests ?? 0,
      logsTruncated: flaky?.truncated ?? false,
      logErrors: flaky?.logErrors ?? 0,
      logsExpired: flaky?.logsExpired ?? 0,
    },
    topFlaky: flakySummary?.topFlaky ?? [],
    skipped,
  };
}

export async function collectRange(
  client: GithubClient,
  {
    repo,
    windows,
    maxLogsPerWeek = DEFAULT_MAX_LOGS_PER_WEEK,
    skipLogs = false,
    now = new Date(),
  }: CollectOptions,
): Promise<CollectedWeek[]> {
  const first = windows[0];
  const last = windows.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error('collectRange needs at least one week window');
  }
  const deployments = await fetchDeployments(client, repo, first.start, last.end);
  const collectedAt = toIso(now);
  const weeks: CollectedWeek[] = [];
  for (const window of windows) {
    const [prs, mainRuns, allRuns] = await Promise.all([
      fetchPullRequests(client, repo, window),
      fetchCiRuns(client, repo, window, { branch: MAIN_BRANCH, event: EVENT_PUSH }),
      skipLogs ? Promise.resolve<CiRun[]>([]) : fetchCiRuns(client, repo, window, {}),
    ]);
    const flaky = skipLogs
      ? null
      : await inspectFlaky(client, repo, allRuns, window, maxLogsPerWeek);
    weeks.push(buildWeek({ window, prs, deployments, mainRuns, flaky, collectedAt }));
  }
  return weeks;
}

export function collectionWarnings(weeks: CollectedWeek[]): string[] {
  const notes: string[] = [];
  for (const week of weeks) {
    const { logErrors, logsExpired, e2eJobsInspected } = week.counts;
    if (logErrors > 0) {
      notes.push(
        `::warning::week ${week.weekStart}: ${logErrors} e2e job log(s) could not be downloaded or had no Playwright summary; flakyPerE2eJob covers the ${e2eJobsInspected} that could`,
      );
    }
    if (logsExpired > 0) {
      notes.push(
        `::warning::week ${week.weekStart}: ${logsExpired} e2e job log(s) had expired and were not read`,
      );
    }
  }
  const finished = weeks.reduce(
    (sum, week) => sum + week.counts.productionDeploys + week.counts.failedDeploys,
    0,
  );
  const first = weeks[0];
  const last = weeks.at(-1);
  if (first !== undefined && last !== undefined && finished === 0) {
    notes.push(
      `::warning::no finished ${PRODUCTION_ENVIRONMENT} deployment from ${first.weekStart} to ${last.weekStart}; check that the environment name still matches before trusting the deployment metrics`,
    );
  }
  return notes;
}

function parseArgs(argv: string[]): CollectArgs {
  const args: CollectArgs = {
    weeks: WEEKS_AUTO,
    history: DEFAULT_HISTORY_PATH,
    repo: undefined,
    maxLogsPerWeek: String(DEFAULT_MAX_LOGS_PER_WEEK),
    now: undefined,
    skipLogs: false,
  };
  const queue = [...argv];
  for (let flag = queue.shift(); flag !== undefined; flag = queue.shift()) {
    const key = VALUED_FLAGS.get(flag);
    const value = queue[0];
    if (flag === SKIP_LOGS_FLAG) {
      args.skipLogs = true;
    } else if (key !== undefined && value !== undefined) {
      args[key] = value;
      queue.shift();
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }
  return args;
}

function renderSummary(weeks: CollectedWeek[]): string {
  const lines = [
    '| week | deploys | deploy fail | lead h | cycle h | main CI fail | flaky/job |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const week of weeks) {
    const m = week.metrics;
    const cell = (v: number | null): string => (v === null ? '-' : String(v));
    lines.push(
      `| ${week.weekStart} | ${m.deploymentFrequency} | ${cell(m.deploymentFailureRate)} | ${cell(m.leadTimeHoursMedian)} | ${cell(m.prCycleTimeHoursMedian)} | ${cell(m.ciMainFailureRate)} | ${cell(m.flakyPerE2eJob)} |`,
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = args.now === undefined ? new Date() : new Date(args.now);
  const repo = resolveRepo({ arg: args.repo });
  const client = createGithubClient({ token: resolveToken() });
  const existing: HistoryFile = existsSync(args.history)
    ? (JSON.parse(readFileSync(args.history, 'utf8')) as HistoryFile)
    : { schemaVersion: SCHEMA_VERSION, repo, weeks: [] };
  const count = weeksToCollect({
    weeks: existing.weeks,
    now,
    explicit: parseWeeksArg(args.weeks),
  });
  const weeks = await collectRange(client, {
    repo,
    windows: weekWindows(now, count),
    maxLogsPerWeek: Number(args.maxLogsPerWeek),
    skipLogs: args.skipLogs,
    now,
  });
  const history: HistoryFile = {
    schemaVersion: SCHEMA_VERSION,
    repo,
    weeks: upsertWeeks(existing.weeks, weeks),
  };
  mkdirSync(dirname(args.history), { recursive: true });
  writeFileSync(args.history, `${JSON.stringify(history, null, 2)}\n`);
  const table = renderSummary(weeks);
  console.log(
    `[collect] ${repo}: collected ${weeks.length} week(s) into ${args.history}\n${table}`,
  );
  for (const note of collectionWarnings(weeks)) console.log(note);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Collected weeks\n\n${table}\n`);
  }
}

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(
      `::error::${String(error instanceof Error ? error.message : error).replace(LINE_BREAKS, ' ')}`,
    );
    process.exitCode = 1;
  });
}
