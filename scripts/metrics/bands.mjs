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

export const DIRECTION = Object.freeze({
  HIGHER_IS_WORSE: 'higher-is-worse',
  LOWER_IS_WORSE: 'lower-is-worse',
});

export const TIER = Object.freeze({
  NONE: 'none',
  LOG: 'log',
  DIAGNOSE: 'diagnose',
  PROPOSE: 'propose',
});

export const STATUS = Object.freeze({
  EVALUATED: 'evaluated',
  INSUFFICIENT_HISTORY: 'insufficient-history',
  NO_DATA: 'no-data',
});

const TIER_RANK = { none: 0, log: 1, diagnose: 2, propose: 3 };
const ISSUE_TIERS = [TIER.LOG, TIER.DIAGNOSE, TIER.PROPOSE];
const SAME_SIDE_RUN = 8;
const TWO_OF_THREE = { needed: 2, of: 3 };
const FOUR_OF_FIVE = { needed: 4, of: 5 };
const RECENT_POINTS = 12;
const DEFAULT_HISTORY_PATH = 'metrics/weekly.json';
const DEFAULT_CONFIG_PATH = 'metrics/bands.json';
const DEFAULT_OUT_PATH = 'metrics/breaches.json';
const FIXED_DIGITS = 3;

export const RULE_ID = Object.freeze({
  BEYOND_PROPOSE: 'beyond-propose',
  BEYOND_DIAGNOSE: 'beyond-diagnose',
  BEYOND_LOG: 'beyond-log',
  TWO_OF_THREE: 'two-of-three-beyond-diagnose',
  FOUR_OF_FIVE: 'four-of-five-beyond-log',
  EIGHT_ONE_SIDE: 'eight-on-bad-side',
});

export function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sampleStd(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squares = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

export function tierAtLeast(tier, floor) {
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[floor] ?? 0);
}

export function rollingScores(values, config) {
  const { window, minHistory, minStd, direction } = config;
  const sign = direction === DIRECTION.LOWER_IS_WORSE ? -1 : 1;
  const scores = [];
  for (let index = minHistory; index < values.length; index += 1) {
    const baseline = values.slice(Math.max(0, index - window), index);
    const m = mean(baseline);
    const spread = Math.max(sampleStd(baseline), minStd);
    const value = values[index];
    const z = (value - m) / spread;
    scores.push({ index, value, mean: m, std: spread, z, badness: sign * z });
  }
  return scores;
}

function countAtLeast(scores, threshold) {
  return scores.filter((s) => s >= threshold).length;
}

export function applyWesternElectricRules(scores, tiers) {
  const fired = [];
  const latest = scores.at(-1);
  if (latest === undefined) return fired;

  if (latest >= tiers.propose) {
    fired.push({
      id: RULE_ID.BEYOND_PROPOSE,
      tier: TIER.PROPOSE,
      description: `latest point is ${tiers.propose} sigma or more on the bad side`,
    });
  } else if (latest >= tiers.diagnose) {
    fired.push({
      id: RULE_ID.BEYOND_DIAGNOSE,
      tier: TIER.DIAGNOSE,
      description: `latest point is ${tiers.diagnose} sigma or more on the bad side`,
    });
  } else if (latest >= tiers.log) {
    fired.push({
      id: RULE_ID.BEYOND_LOG,
      tier: TIER.LOG,
      description: `latest point is ${tiers.log} sigma or more on the bad side`,
    });
  }

  const lastThree = scores.slice(-TWO_OF_THREE.of);
  if (
    lastThree.length === TWO_OF_THREE.of &&
    latest > 0 &&
    countAtLeast(lastThree, tiers.diagnose) >= TWO_OF_THREE.needed
  ) {
    fired.push({
      id: RULE_ID.TWO_OF_THREE,
      tier: TIER.DIAGNOSE,
      description: `${TWO_OF_THREE.needed} of the last ${TWO_OF_THREE.of} points are ${tiers.diagnose} sigma or more on the bad side`,
    });
  }

  const lastFive = scores.slice(-FOUR_OF_FIVE.of);
  if (
    lastFive.length === FOUR_OF_FIVE.of &&
    latest > 0 &&
    countAtLeast(lastFive, tiers.log) >= FOUR_OF_FIVE.needed
  ) {
    fired.push({
      id: RULE_ID.FOUR_OF_FIVE,
      tier: TIER.LOG,
      description: `${FOUR_OF_FIVE.needed} of the last ${FOUR_OF_FIVE.of} points are ${tiers.log} sigma or more on the bad side`,
    });
  }

  const lastRun = scores.slice(-SAME_SIDE_RUN);
  if (lastRun.length === SAME_SIDE_RUN && lastRun.every((s) => s > 0)) {
    fired.push({
      id: RULE_ID.EIGHT_ONE_SIDE,
      tier: TIER.LOG,
      description: `the last ${SAME_SIDE_RUN} points all sit on the bad side of the mean`,
    });
  }

  return fired;
}

function highestTier(rules) {
  return rules.reduce((best, rule) => (tierAtLeast(rule.tier, best) ? rule.tier : best), TIER.NONE);
}

export function evaluateSeries(series, config) {
  const present = series.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const base = { tier: TIER.NONE, rules: [], recent: present.slice(-RECENT_POINTS) };
  const latestRaw = series.at(-1);
  if (typeof latestRaw !== 'number' || !Number.isFinite(latestRaw)) {
    return { ...base, status: STATUS.NO_DATA };
  }
  if (present.length <= config.minHistory) {
    return { ...base, status: STATUS.INSUFFICIENT_HISTORY, value: latestRaw };
  }
  const scores = rollingScores(present, config);
  const last = scores.at(-1);
  const rules = applyWesternElectricRules(
    scores.map((s) => s.badness),
    config.tiers,
  );
  return {
    ...base,
    status: STATUS.EVALUATED,
    tier: highestTier(rules),
    rules,
    value: last.value,
    mean: last.mean,
    std: last.std,
    z: last.z,
    badness: last.badness,
  };
}

export function resolveMetricConfig(config, name) {
  const metric = config.metrics[name];
  return {
    ...config.defaults,
    ...metric,
    tiers: { ...config.defaults.tiers, ...(metric.tiers ?? {}) },
  };
}

function fail(message) {
  throw new Error(`bands config invalid: ${message}`);
}

function validateTiers(tiers, where) {
  const { log, diagnose, propose } = tiers ?? {};
  const ascending =
    [log, diagnose, propose].every((v) => typeof v === 'number' && v > 0) &&
    log < diagnose &&
    diagnose < propose;
  if (!ascending) fail(`${where} tiers must be positive and widen log < diagnose < propose`);
}

export function validateBandsConfig(config) {
  if (!ISSUE_TIERS.includes(config?.issueFromTier)) {
    fail(`issueFromTier must be one of ${ISSUE_TIERS.join(', ')}`);
  }
  const defaults = config.defaults ?? {};
  if (!Number.isInteger(defaults.window) || defaults.window < 2) {
    fail('defaults.window must be an integer of at least 2');
  }
  if (!Number.isInteger(defaults.minHistory) || defaults.minHistory < 2) {
    fail('defaults.minHistory must be an integer of at least 2');
  }
  validateTiers(defaults.tiers, 'defaults');
  const entries = Object.entries(config.metrics ?? {});
  if (entries.length === 0) fail('metrics must name at least one metric');
  for (const [name, metric] of entries) {
    if (!Object.values(DIRECTION).includes(metric.direction)) {
      fail(`${name}.direction must be one of ${Object.values(DIRECTION).join(', ')}`);
    }
    if (!(typeof metric.minStd === 'number' && metric.minStd > 0)) {
      fail(`${name}.minStd must be a positive number`);
    }
    if (metric.tiers !== undefined) validateTiers(resolveMetricConfig(config, name).tiers, name);
  }
}

export function evaluateHistory(weeks, config) {
  const ordered = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const evaluations = {};
  for (const name of Object.keys(config.metrics)) {
    const series = ordered.map((week) => week.metrics?.[name] ?? null);
    evaluations[name] = evaluateSeries(series, resolveMetricConfig(config, name));
  }
  const breaches = Object.entries(evaluations)
    .filter(
      ([, ev]) => ev.status === STATUS.EVALUATED && tierAtLeast(ev.tier, config.issueFromTier),
    )
    .map(([name]) => name);
  return { weekStart: ordered.at(-1)?.weekStart ?? null, evaluations, breaches };
}

function formatNumber(value) {
  return typeof value === 'number' ? String(Number(value.toFixed(FIXED_DIGITS))) : '-';
}

export function renderTable(report) {
  const lines = [
    '| metric | value | mean | std | z | tier | status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const [name, ev] of Object.entries(report.evaluations)) {
    lines.push(
      `| ${name} | ${formatNumber(ev.value)} | ${formatNumber(ev.mean)} | ${formatNumber(ev.std)} | ${formatNumber(ev.z)} | ${ev.tier} | ${ev.status} |`,
    );
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = {
    history: DEFAULT_HISTORY_PATH,
    config: DEFAULT_CONFIG_PATH,
    out: DEFAULT_OUT_PATH,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (key === undefined || !(key in args) || argv[i + 1] === undefined) {
      throw new Error(`unknown or incomplete argument: ${argv[i]}`);
    }
    args[key] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(args.config, 'utf8'));
  validateBandsConfig(config);
  const history = existsSync(args.history)
    ? JSON.parse(readFileSync(args.history, 'utf8'))
    : { weeks: [] };
  const report = evaluateHistory(history.weeks, config);
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  const table = renderTable(report);
  console.log(`[bands] week ${report.weekStart ?? 'none'}\n${table}`);
  console.log(
    `[bands] breaches: ${report.breaches.length === 0 ? 'none' : report.breaches.join(', ')}`,
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Metric bands, week ${report.weekStart ?? 'none'}\n\n${table}\n`,
    );
  }
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `::error::${String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, ' ')}`,
    );
    process.exitCode = 1;
  }
}
