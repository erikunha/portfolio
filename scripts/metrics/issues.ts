import { existsSync, readFileSync } from 'node:fs';
import { isMain } from '../lib/is-main.ts';
import type { BandsConfig, BandsReport, Evaluation } from './bands.ts';
import { DIRECTION, resolveMetricConfig, TIER } from './bands.ts';
import type { GithubClient } from './github.ts';
import { createGithubClient, HTTP_METHOD, resolveRepo, resolveToken } from './github.ts';

export interface IssueHistoryWeek {
  weekStart: string;
  topFlaky?: { test: string; count: number }[];
}

export type IssueAction =
  | { type: 'create'; metric: string; title: string; body: string }
  | { type: 'comment'; metric: string; issueNumber: number; body: string };

interface IssuesArgs {
  history: string;
  config: string;
  report: string;
  repo: string | undefined;
  dryRun: boolean;
}

type ValuedKey = 'history' | 'config' | 'report' | 'repo';

export const ISSUE_LABEL = 'metrics-breach';
const LABEL_COLOR = 'b60205';
const LABEL_DESCRIPTION = 'A weekly delivery metric left its control band';
const LABEL_EXISTS_STATUS = 'HTTP 422';
const FLAKY_METRIC = 'flakyPerE2eJob';
const NUMBER_DIGITS = 3;
const PAGE_SIZE = 100;
const DEFAULT_HISTORY_PATH = 'metrics/weekly.json';
const DEFAULT_CONFIG_PATH = 'metrics/bands.json';
const DEFAULT_REPORT_PATH = 'metrics/breaches.json';
const LINE_BREAKS = /[\r\n]+/g;
const DRY_RUN_FLAG = '--dry-run';
const VALUED_FLAGS = new Map<string, ValuedKey>([
  ['--history', 'history'],
  ['--config', 'config'],
  ['--report', 'report'],
  ['--repo', 'repo'],
]);

const LOG_ACTION = 'Log only. Note it and watch the next week.';
const TIER_ACTION: Readonly<Record<string, string>> = {
  [TIER.LOG]: LOG_ACTION,
  [TIER.DIAGNOSE]: 'Diagnose. Find the cause before changing anything, and write it in this issue.',
  [TIER.PROPOSE]:
    'Propose. Open a pull request that changes the code or process behind the number, and link it here.',
};

export const issueMarker = (metric: string): string => `<!-- ${ISSUE_LABEL}:${metric} -->`;
const firstLine = (body: string | null | undefined): string =>
  (String(body ?? '').split('\n', 1)[0] ?? '').trim();
export const buildIssueTitle = (metric: string): string => `Metric breach: ${metric}`;

const fmt = (value: number | undefined): string =>
  typeof value === 'number' ? String(Number(value.toFixed(NUMBER_DIGITS))) : '-';

function evaluationOf(report: BandsReport, metric: string): Evaluation {
  const evaluation = report.evaluations[metric];
  if (evaluation === undefined) throw new Error(`the report has no evaluation for ${metric}`);
  return evaluation;
}

function flakyEvidence(history: IssueHistoryWeek[], weekStart: string | null): string[] {
  const week = history.find((w) => w.weekStart === weekStart);
  const top = week?.topFlaky ?? [];
  if (top.length === 0) return [];
  return [
    '',
    'Most frequent flaky tests that week:',
    ...top.map((t) => `- \`${t.test}\` (${t.count})`),
  ];
}

function evidenceLines({
  metric,
  report,
  config,
  history,
}: {
  metric: string;
  report: BandsReport;
  config: BandsConfig;
  history: IssueHistoryWeek[];
}): string[] {
  const evaluation = evaluationOf(report, metric);
  const resolved = resolveMetricConfig(config, metric);
  const unit = config.metrics[metric]?.unit;
  const lines = [
    `Metric: \`${metric}\`${unit ? ` (${unit})` : ''}`,
    `Value: ${fmt(evaluation.value)}`,
    `Band: mean ${fmt(evaluation.mean)}, std ${fmt(evaluation.std)}, over the previous ${resolved.window} weeks at most. z = ${fmt(evaluation.z)}. Worse is ${resolved.direction === DIRECTION.HIGHER_IS_WORSE ? 'higher' : 'lower'}.`,
    'Rules that fired:',
    ...evaluation.rules.map((rule) => `- ${rule.description}`),
    `Recent weeks, oldest first: ${evaluation.recent.map((value) => fmt(value)).join(', ')}`,
  ];
  if (metric === FLAKY_METRIC) lines.push(...flakyEvidence(history, report.weekStart));
  return lines;
}

export function buildIssueBody({
  metric,
  report,
  config,
  history,
  runUrl,
}: {
  metric: string;
  report: BandsReport;
  config: BandsConfig;
  history: IssueHistoryWeek[];
  runUrl: string;
}): string {
  const evaluation = evaluationOf(report, metric);
  return [
    issueMarker(metric),
    `**Tier: ${evaluation.tier}**, week starting ${report.weekStart}.`,
    '',
    ...evidenceLines({ metric, report, config, history }),
    '',
    `What to do at this tier: ${TIER_ACTION[evaluation.tier] ?? LOG_ACTION}`,
    'Close this issue with the pull request that addresses it. Do not turn this number into a target: a metric that is optimised stops measuring what it measured.',
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

function buildComment({
  metric,
  report,
  runUrl,
}: {
  metric: string;
  report: BandsReport;
  runUrl: string;
}): string {
  const evaluation = evaluationOf(report, metric);
  return [
    `Still outside the band. Week starting ${report.weekStart}: tier **${evaluation.tier}**, value ${fmt(evaluation.value)}, mean ${fmt(evaluation.mean)}, std ${fmt(evaluation.std)}, z = ${fmt(evaluation.z)}.`,
    ...evaluation.rules.map((rule) => `- ${rule.description}`),
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

export function planIssueActions({
  report,
  config,
  history,
  openIssues,
  runUrl,
}: {
  report: BandsReport;
  config: BandsConfig;
  history: IssueHistoryWeek[];
  openIssues: { number: number; body?: string | null }[];
  runUrl: string;
}): IssueAction[] {
  return report.breaches.map((metric): IssueAction => {
    const existing = openIssues.find((issue) => firstLine(issue.body) === issueMarker(metric));
    if (existing !== undefined) {
      return {
        type: 'comment',
        metric,
        issueNumber: existing.number,
        body: buildComment({ metric, report, runUrl }),
      };
    }
    return {
      type: 'create',
      metric,
      title: buildIssueTitle(metric),
      body: buildIssueBody({ metric, report, config, history, runUrl }),
    };
  });
}

async function ensureLabel(client: GithubClient, repo: string): Promise<void> {
  try {
    await client.request(`/repos/${repo}/labels`, {
      method: HTTP_METHOD.POST,
      body: { name: ISSUE_LABEL, color: LABEL_COLOR, description: LABEL_DESCRIPTION },
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(LABEL_EXISTS_STATUS)) throw error;
  }
}

export async function applyPlan(
  client: GithubClient,
  repo: string,
  actions: IssueAction[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<void> {
  if (actions.length === 0 || dryRun) return;
  await ensureLabel(client, repo);
  for (const action of actions) {
    if (action.type === 'create') {
      await client.request(`/repos/${repo}/issues`, {
        method: HTTP_METHOD.POST,
        body: { title: action.title, body: action.body, labels: [ISSUE_LABEL] },
      });
    } else {
      await client.request(`/repos/${repo}/issues/${action.issueNumber}/comments`, {
        method: HTTP_METHOD.POST,
        body: { body: action.body },
      });
    }
  }
}

function parseArgs(argv: string[]): IssuesArgs {
  const args: IssuesArgs = {
    history: DEFAULT_HISTORY_PATH,
    config: DEFAULT_CONFIG_PATH,
    report: DEFAULT_REPORT_PATH,
    repo: undefined,
    dryRun: false,
  };
  const queue = [...argv];
  for (let flag = queue.shift(); flag !== undefined; flag = queue.shift()) {
    const key = VALUED_FLAGS.get(flag);
    const value = queue[0];
    if (flag === DRY_RUN_FLAG) {
      args.dryRun = true;
    } else if (key !== undefined && value) {
      args[key] = value;
      queue.shift();
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }
  return args;
}

function runUrlFromEnv(env: NodeJS.ProcessEnv): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : 'local run';
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = JSON.parse(readFileSync(args.report, 'utf8')) as BandsReport;
  if (report.breaches.length === 0) {
    console.log('[issues] no metric breached its band; nothing to open.');
    return;
  }
  const config = JSON.parse(readFileSync(args.config, 'utf8')) as BandsConfig;
  const history = existsSync(args.history)
    ? (JSON.parse(readFileSync(args.history, 'utf8')) as { weeks: IssueHistoryWeek[] }).weeks
    : [];
  const repo = resolveRepo({ arg: args.repo });
  const client = createGithubClient({ token: resolveToken() });
  const openIssues = await client.paginate<{ number: number; body?: string | null }>(
    `/repos/${repo}/issues`,
    { params: { labels: ISSUE_LABEL, state: 'open', per_page: PAGE_SIZE } },
  );
  const actions = planIssueActions({
    report,
    config,
    history,
    openIssues,
    runUrl: runUrlFromEnv(process.env),
  });
  for (const action of actions) {
    console.log(`[issues] ${args.dryRun ? 'would ' : ''}${action.type} ${action.metric}`);
  }
  await applyPlan(client, repo, actions, { dryRun: args.dryRun });
}

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(
      `::error::${String(error instanceof Error ? error.message : error).replace(LINE_BREAKS, ' ')}`,
    );
    process.exitCode = 1;
  });
}
