import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DIRECTION, resolveMetricConfig, TIER } from './bands.mjs';
import { createGithubClient, HTTP_METHOD, resolveRepo, resolveToken } from './github.mjs';

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

const TIER_ACTION = {
  [TIER.LOG]: 'Log only. Note it and watch the next week.',
  [TIER.DIAGNOSE]: 'Diagnose. Find the cause before changing anything, and write it in this issue.',
  [TIER.PROPOSE]:
    'Propose. Open a pull request that changes the code or process behind the number, and link it here.',
};

export const issueMarker = (metric) => `<!-- ${ISSUE_LABEL}:${metric} -->`;
const firstLine = (body) =>
  String(body ?? '')
    .split('\n', 1)[0]
    .trim();
export const buildIssueTitle = (metric) => `Metric breach: ${metric}`;

const fmt = (value) =>
  typeof value === 'number' ? String(Number(value.toFixed(NUMBER_DIGITS))) : '-';

function flakyEvidence(history, weekStart) {
  const week = history.find((w) => w.weekStart === weekStart);
  const top = week?.topFlaky ?? [];
  if (top.length === 0) return [];
  return [
    '',
    'Most frequent flaky tests that week:',
    ...top.map((t) => `- \`${t.test}\` (${t.count})`),
  ];
}

function evidenceLines({ metric, report, config, history }) {
  const evaluation = report.evaluations[metric];
  const resolved = resolveMetricConfig(config, metric);
  const unit = config.metrics[metric]?.unit;
  const lines = [
    `Metric: \`${metric}\`${unit ? ` (${unit})` : ''}`,
    `Value: ${fmt(evaluation.value)}`,
    `Band: mean ${fmt(evaluation.mean)}, std ${fmt(evaluation.std)}, over the previous ${resolved.window} weeks at most. z = ${fmt(evaluation.z)}. Worse is ${resolved.direction === DIRECTION.HIGHER_IS_WORSE ? 'higher' : 'lower'}.`,
    'Rules that fired:',
    ...evaluation.rules.map((rule) => `- ${rule.description}`),
    `Recent weeks, oldest first: ${evaluation.recent.map(fmt).join(', ')}`,
  ];
  if (metric === FLAKY_METRIC) lines.push(...flakyEvidence(history, report.weekStart));
  return lines;
}

export function buildIssueBody({ metric, report, config, history, runUrl }) {
  const evaluation = report.evaluations[metric];
  return [
    issueMarker(metric),
    `**Tier: ${evaluation.tier}**, week starting ${report.weekStart}.`,
    '',
    ...evidenceLines({ metric, report, config, history }),
    '',
    `What to do at this tier: ${TIER_ACTION[evaluation.tier] ?? TIER_ACTION.log}`,
    'Close this issue with the pull request that addresses it. Do not turn this number into a target: a metric that is optimised stops measuring what it measured.',
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

function buildComment({ metric, report, runUrl }) {
  const evaluation = report.evaluations[metric];
  return [
    `Still outside the band. Week starting ${report.weekStart}: tier **${evaluation.tier}**, value ${fmt(evaluation.value)}, mean ${fmt(evaluation.mean)}, std ${fmt(evaluation.std)}, z = ${fmt(evaluation.z)}.`,
    ...evaluation.rules.map((rule) => `- ${rule.description}`),
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

export function planIssueActions({ report, config, history, openIssues, runUrl }) {
  return report.breaches.map((metric) => {
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

async function ensureLabel(client, repo) {
  try {
    await client.request(`/repos/${repo}/labels`, {
      method: HTTP_METHOD.POST,
      body: { name: ISSUE_LABEL, color: LABEL_COLOR, description: LABEL_DESCRIPTION },
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(LABEL_EXISTS_STATUS)) throw error;
  }
}

export async function applyPlan(client, repo, actions, { dryRun = false } = {}) {
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

function parseArgs(argv) {
  const args = {
    history: DEFAULT_HISTORY_PATH,
    config: DEFAULT_CONFIG_PATH,
    report: DEFAULT_REPORT_PATH,
    repo: undefined,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (['--history', '--config', '--report', '--repo'].includes(flag) && argv[i + 1]) {
      args[flag.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }
  return args;
}

function runUrlFromEnv(env) {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : 'local run';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = JSON.parse(readFileSync(args.report, 'utf8'));
  if (report.breaches.length === 0) {
    console.log('[issues] no metric breached its band; nothing to open.');
    return;
  }
  const config = JSON.parse(readFileSync(args.config, 'utf8'));
  const history = existsSync(args.history)
    ? JSON.parse(readFileSync(args.history, 'utf8')).weeks
    : [];
  const repo = resolveRepo({ arg: args.repo });
  const client = createGithubClient({ token: resolveToken() });
  const openIssues = await client.paginate(`/repos/${repo}/issues`, {
    params: { labels: ISSUE_LABEL, state: 'open', per_page: PAGE_SIZE },
  });
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
