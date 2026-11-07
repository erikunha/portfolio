import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGithubClient, resolveRepo, resolveToken } from './github.mjs';

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
const COMPLETED_CONCLUSIONS = ['success', 'failure'];
const FAILED_DEPLOY_STATES = ['failure', 'error'];
const ISO_DATE_LENGTH = 10;

const ESCAPE_CODE = 27;
const DELETE_CODE = 127;
const SPACE_CODE = 32;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(ESCAPE_CODE)}\\[[0-9;]*[A-Za-z]`, 'g');
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;
const FLAKY_HEADER_PATTERN = /^\s+(\d+) flaky\s*$/;
const SUMMARY_COUNT_PATTERN = /^\s+\d+ (?:flaky|skipped|passed|failed|did not run|interrupted)\b/;
const WORKFLOW_COMMAND_PATTERN = /::/g;

const PULL_REQUESTS_QUERY = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number createdAt mergedAt baseRefName
        author { __typename login }
        commits(first: 1) { nodes { commit { authoredDate } } }
      }
    }
  }
}`;

const toIso = (date) => date.toISOString().replace('.000Z', 'Z');
const toDay = (date) => date.toISOString().slice(0, ISO_DATE_LENGTH);
const round = (value) =>
  value === null ? null : Math.round(value * 10 ** ROUND_DIGITS) / 10 ** ROUND_DIGITS;
const hoursBetween = (from, to) => Math.max(0, (Date.parse(to) - Date.parse(from)) / MS_PER_HOUR);

function startOfWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + MONDAY_OFFSET_FROM_SUNDAY_START) % DAYS_PER_WEEK;
  return new Date(day.getTime() - sinceMonday * MS_PER_DAY);
}

export function weekWindows(now, count) {
  const current = startOfWeek(now).getTime();
  const windows = [];
  for (let back = count; back >= 1; back -= 1) {
    const start = new Date(current - back * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    windows.push({ start, end, weekStart: toDay(start), weekEnd: toDay(end) });
  }
  return windows;
}

export function weeksToCollect({ weeks, now, explicit }) {
  if (explicit !== undefined) return explicit;
  if (weeks.length === 0) return BACKFILL_WEEKS;
  const last = weeks
    .map((w) => w.weekStart)
    .sort()
    .at(-1);
  const gap = (startOfWeek(now).getTime() - Date.parse(last)) / WEEK_MS - 1;
  return Math.min(BACKFILL_WEEKS, Math.max(1, Math.round(gap)));
}

export function parseWeeksArg(raw) {
  if (raw === 'auto') return undefined;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > MAX_HISTORY_WEEKS) {
    throw new Error(
      `--weeks must be "auto" or an integer from 1 to ${MAX_HISTORY_WEEKS}, got "${raw}"`,
    );
  }
  return count;
}

const inWindow = (iso, window) => {
  const at = Date.parse(iso);
  return at >= window.start.getTime() && at < window.end.getTime();
};

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalizePullRequest(node) {
  return {
    number: node.number,
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    baseRefName: node.baseRefName,
    authorIsBot: node.author?.__typename === 'Bot',
    firstCommitAt: node.commits?.nodes?.[0]?.commit?.authoredDate ?? null,
  };
}

export function summarizePullRequests(prs, window) {
  const merged = prs.filter((pr) => pr.mergedAt && inWindow(pr.mergedAt, window));
  const human = merged.filter((pr) => !pr.authorIsBot);
  return {
    prsMerged: merged.length,
    leadTimeHoursMedian: median(
      human.map((pr) => hoursBetween(pr.firstCommitAt ?? pr.createdAt, pr.mergedAt)),
    ),
    prCycleTimeHoursMedian: median(human.map((pr) => hoursBetween(pr.createdAt, pr.mergedAt))),
  };
}

export function deploymentOutcome(statuses) {
  const states = statuses.map((s) => s.state);
  if (states.includes('success')) return 'success';
  if (states.some((state) => FAILED_DEPLOY_STATES.includes(state))) return 'failure';
  return 'pending';
}

export function summarizeDeployments(deployments, window) {
  const inRange = deployments.filter((d) => inWindow(d.createdAt, window));
  const succeeded = inRange.filter((d) => d.outcome === 'success').length;
  const failed = inRange.filter((d) => d.outcome === 'failure').length;
  const decided = succeeded + failed;
  return {
    productionDeploys: succeeded,
    failedDeploys: failed,
    deploymentFrequency: succeeded,
    deploymentFailureRate: decided === 0 ? null : failed / decided,
  };
}

export function summarizeCiRuns(runs, window) {
  const completed = runs.filter(
    (run) => inWindow(run.createdAt, window) && COMPLETED_CONCLUSIONS.includes(run.conclusion),
  );
  const failed = completed.filter((run) => run.conclusion === 'failure').length;
  return {
    ciMainRuns: completed.length,
    ciMainFailureRate: completed.length === 0 ? null : failed / completed.length,
  };
}

const isControl = (char) => {
  const code = char.charCodeAt(0);
  return code < SPACE_CODE || code === DELETE_CODE;
};

export function sanitizeTestName(name) {
  return [...String(name)]
    .map((char) => (isControl(char) ? ' ' : char))
    .join('')
    .replace(/`/g, '')
    .replace(WORKFLOW_COMMAND_PATTERN, ': :')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEST_NAME_LENGTH);
}

export function parsePlaywrightFlaky(logText) {
  const lines = String(logText)
    .split('\n')
    .map((line) =>
      line.replace(ANSI_PATTERN, '').replace(TIMESTAMP_PATTERN, '').replace(/\r$/, ''),
    );
  const names = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = FLAKY_HEADER_PATTERN.exec(lines[i]);
    if (header === null) continue;
    const expected = Number(header[1]);
    let taken = 0;
    for (let j = i + 1; j < lines.length && taken < expected; j += 1) {
      const line = lines[j];
      if (!/^\s+\S/.test(line) || SUMMARY_COUNT_PATTERN.test(line)) break;
      names.push(sanitizeTestName(line));
      taken += 1;
    }
  }
  return names;
}

export function summarizeFlaky(jobs) {
  const counts = new Map();
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

export function upsertWeeks(existing, fresh) {
  const byStart = new Map(existing.map((week) => [week.weekStart, week]));
  for (const week of fresh) byStart.set(week.weekStart, week);
  return [...byStart.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-MAX_HISTORY_WEEKS);
}

async function mapPool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchPullRequests(client, repo, start, end) {
  const q = `repo:${repo} is:pr is:merged merged:${toIso(start)}..${toIso(end)}`;
  const prs = [];
  let after = null;
  do {
    const data = await client.graphql(PULL_REQUESTS_QUERY, { q, after });
    prs.push(
      ...data.search.nodes.filter((node) => node?.number !== undefined).map(normalizePullRequest),
    );
    after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
  } while (after !== null);
  return prs;
}

async function fetchDeployments(client, repo, start, end) {
  const startMs = start.getTime();
  const listed = await client.paginate(`/repos/${repo}/deployments`, {
    params: { environment: PRODUCTION_ENVIRONMENT, per_page: PAGE_SIZE },
    stopWhen: (page) => page.some((d) => Date.parse(d.created_at) < startMs),
  });
  const inRange = listed.filter((d) => {
    const at = Date.parse(d.created_at);
    return at >= startMs && at < end.getTime();
  });
  return mapPool(inRange, STATUS_CONCURRENCY, async (deployment) => {
    const statuses = await client.json(`/repos/${repo}/deployments/${deployment.id}/statuses`, {
      params: { per_page: STATUS_PAGE_SIZE },
    });
    return { createdAt: deployment.created_at, outcome: deploymentOutcome(statuses) };
  });
}

async function fetchCiRuns(client, repo, start, end, filters) {
  const runs = await client.paginate(`/repos/${repo}/actions/workflows/${CI_WORKFLOW}/runs`, {
    params: {
      status: 'completed',
      per_page: PAGE_SIZE,
      created: `${toIso(start)}..${toIso(end)}`,
      ...filters,
    },
    pick: (body) => body.workflow_runs,
  });
  return runs.map((run) => ({ id: run.id, createdAt: run.created_at, conclusion: run.conclusion }));
}

async function fetchE2eJobs(client, repo, run) {
  const jobs = await client.paginate(`/repos/${repo}/actions/runs/${run.id}/jobs`, {
    params: { per_page: PAGE_SIZE },
    pick: (body) => body.jobs,
  });
  return jobs.filter(
    (job) => job.name.startsWith(E2E_JOB_PREFIX) && COMPLETED_CONCLUSIONS.includes(job.conclusion),
  );
}

async function inspectFlaky(client, repo, runs, window, cap) {
  const weekRuns = runs
    .filter((run) => inWindow(run.createdAt, window))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const candidates = [];
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
  let logErrors = 0;
  const inspected = await mapPool(candidates, LOG_CONCURRENCY, async (job) => {
    try {
      const text = await client.text(`/repos/${repo}/actions/jobs/${job.id}/logs`);
      return { flaky: parsePlaywrightFlaky(text) };
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      logErrors += 1;
      return null;
    }
  });
  return { jobs: inspected.filter((job) => job !== null), truncated, logErrors };
}

function buildWeek({ window, prs, deployments, mainRuns, flaky, collectedAt }) {
  const pull = summarizePullRequests(prs, window);
  const deploy = summarizeDeployments(deployments, window);
  const ci = summarizeCiRuns(mainRuns, window);
  const skipped = { lighthouseLcp: LIGHTHOUSE_SKIP_REASON };
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
    },
    topFlaky: flakySummary?.topFlaky ?? [],
    skipped,
  };
}

export async function collectRange(
  client,
  { repo, windows, maxLogsPerWeek = DEFAULT_MAX_LOGS_PER_WEEK, skipLogs = false, now = new Date() },
) {
  const start = windows[0].start;
  const end = windows.at(-1).end;
  const [prs, deployments, mainRuns, allRuns] = await Promise.all([
    fetchPullRequests(client, repo, start, end),
    fetchDeployments(client, repo, start, end),
    fetchCiRuns(client, repo, start, end, { branch: MAIN_BRANCH, event: 'push' }),
    skipLogs ? Promise.resolve([]) : fetchCiRuns(client, repo, start, end, {}),
  ]);
  const collectedAt = toIso(now);
  const weeks = [];
  for (const window of windows) {
    const flaky = skipLogs
      ? null
      : await inspectFlaky(client, repo, allRuns, window, maxLogsPerWeek);
    weeks.push(buildWeek({ window, prs, deployments, mainRuns, flaky, collectedAt }));
  }
  return weeks;
}

function parseArgs(argv) {
  const args = {
    weeks: 'auto',
    history: DEFAULT_HISTORY_PATH,
    repo: undefined,
    maxLogsPerWeek: String(DEFAULT_MAX_LOGS_PER_WEEK),
    now: undefined,
    skipLogs: false,
  };
  const valued = {
    '--weeks': 'weeks',
    '--history': 'history',
    '--repo': 'repo',
    '--max-logs-per-week': 'maxLogsPerWeek',
    '--now': 'now',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--skip-logs') {
      args.skipLogs = true;
    } else if (flag in valued && argv[i + 1] !== undefined) {
      args[valued[flag]] = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }
  return args;
}

function renderSummary(weeks) {
  const lines = [
    '| week | deploys | deploy fail | lead h | cycle h | main CI fail | flaky/job |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const week of weeks) {
    const m = week.metrics;
    const cell = (v) => (v === null ? '-' : String(v));
    lines.push(
      `| ${week.weekStart} | ${m.deploymentFrequency} | ${cell(m.deploymentFailureRate)} | ${cell(m.leadTimeHoursMedian)} | ${cell(m.prCycleTimeHoursMedian)} | ${cell(m.ciMainFailureRate)} | ${cell(m.flakyPerE2eJob)} |`,
    );
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = args.now === undefined ? new Date() : new Date(args.now);
  const repo = resolveRepo({ arg: args.repo });
  const client = createGithubClient({ token: resolveToken() });
  const existing = existsSync(args.history)
    ? JSON.parse(readFileSync(args.history, 'utf8'))
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
  const history = {
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
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Collected weeks\n\n${table}\n`);
  }
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `::error::${String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, ' ')}`,
    );
    process.exitCode = 1;
  });
}
