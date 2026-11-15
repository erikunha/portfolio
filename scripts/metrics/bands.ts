import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMain } from '../lib/is-main.ts';

export const DIRECTION = Object.freeze({
  HIGHER_IS_WORSE: 'higher-is-worse',
  LOWER_IS_WORSE: 'lower-is-worse',
} as const);

export const TIER = Object.freeze({
  NONE: 'none',
  LOG: 'log',
  DIAGNOSE: 'diagnose',
  PROPOSE: 'propose',
} as const);

export const STATUS = Object.freeze({
  EVALUATED: 'evaluated',
  INSUFFICIENT_HISTORY: 'insufficient-history',
  NO_DATA: 'no-data',
} as const);

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];
export type Tier = (typeof TIER)[keyof typeof TIER];
export type Status = (typeof STATUS)[keyof typeof STATUS];

export interface Tiers {
  log: number;
  diagnose: number;
  propose: number;
}

export interface MetricConfig {
  direction: Direction;
  window: number;
  minHistory: number;
  minStd: number;
  tiers: Tiers;
}

export interface BandsConfig {
  version: number;
  issueFromTier: Exclude<Tier, 'none'>;
  defaults: { window: number; minHistory: number; tiers: Tiers };
  metrics: Record<
    string,
    {
      direction: Direction;
      minStd: number;
      unit?: string;
      window?: number;
      minHistory?: number;
      tiers?: Partial<Tiers>;
    }
  >;
}

export interface FiredRule {
  id: string;
  tier: Exclude<Tier, 'none'>;
  description: string;
}

export interface Score {
  index: number;
  value: number;
  mean: number;
  std: number;
  z: number;
  badness: number;
}

export interface Evaluation {
  status: Status;
  tier: Tier;
  rules: FiredRule[];
  recent: number[];
  value?: number;
  mean?: number;
  std?: number;
  z?: number;
  badness?: number;
}

export interface WeekRecord {
  weekStart: string;
  metrics?: Record<string, number | null | undefined>;
}

export interface BandsReport {
  weekStart: string | null;
  evaluations: Record<string, Evaluation>;
  breaches: string[];
}

interface BandsArgs {
  history: string;
  config: string;
  out: string;
}

interface LooseTiersHolder {
  tiers?: unknown;
}

interface LooseConfig {
  issueFromTier?: unknown;
  defaults?: LooseTiersHolder & { window?: unknown; minHistory?: unknown };
  metrics?: Record<string, LooseTiersHolder & { direction?: unknown; minStd?: unknown }>;
}

const TIER_RANK: Readonly<Record<string, number>> = Object.freeze({
  [TIER.NONE]: 0,
  [TIER.LOG]: 1,
  [TIER.DIAGNOSE]: 2,
  [TIER.PROPOSE]: 3,
});
const ISSUE_TIERS: readonly string[] = [TIER.LOG, TIER.DIAGNOSE, TIER.PROPOSE];
const SAME_SIDE_RUN = 8;
const TWO_OF_THREE = { needed: 2, of: 3 };
const FOUR_OF_FIVE = { needed: 4, of: 5 };
const RECENT_POINTS = 12;
const MIN_WINDOW = 2;
const MIN_HISTORY_FLOOR = 2;
const DEFAULT_HISTORY_PATH = 'metrics/weekly.json';
const DEFAULT_CONFIG_PATH = 'metrics/bands.json';
const DEFAULT_OUT_PATH = 'metrics/breaches.json';
const FIXED_DIGITS = 3;
const FLAG_PREFIX = /^--/;
const LINE_BREAKS = /[\r\n]+/g;

export const RULE_ID = Object.freeze({
  BEYOND_PROPOSE: 'beyond-propose',
  BEYOND_DIAGNOSE: 'beyond-diagnose',
  BEYOND_LOG: 'beyond-log',
  TWO_OF_THREE: 'two-of-three-beyond-diagnose',
  FOUR_OF_FIVE: 'four-of-five-beyond-log',
  EIGHT_ONE_SIDE: 'eight-on-bad-side',
} as const);

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squares = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

export function tierAtLeast(tier: string, floor: string): boolean {
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[floor] ?? 0);
}

function baselineBefore(
  values: number[],
  excluded: Set<number>,
  index: number,
  window: number,
): number[] {
  const baseline: number[] = [];
  for (let back = index - 1; back >= 0 && baseline.length < window; back -= 1) {
    const value = values[back];
    if (value !== undefined && !excluded.has(back)) baseline.push(value);
  }
  return baseline.reverse();
}

export function rollingScores(
  values: number[],
  config: Omit<MetricConfig, 'tiers'> & { tiers?: Tiers },
): Score[] {
  const { window, minHistory, minStd, direction, tiers } = config;
  const sign = direction === DIRECTION.LOWER_IS_WORSE ? -1 : 1;
  const excluded = new Set<number>();
  const scores: Score[] = [];
  for (const [index, value] of values.entries()) {
    if (index < minHistory) continue;
    const baseline = baselineBefore(values, excluded, index, window);
    const m = mean(baseline);
    const spread = Math.max(sampleStd(baseline), minStd);
    const z = (value - m) / spread;
    const badness = sign * z;
    if (tiers !== undefined && badness >= tiers.diagnose) excluded.add(index);
    scores.push({ index, value, mean: m, std: spread, z, badness });
  }
  return scores;
}

function countAtLeast(scores: number[], threshold: number): number {
  return scores.filter((s) => s >= threshold).length;
}

export function applyWesternElectricRules(scores: number[], tiers: Tiers): FiredRule[] {
  const fired: FiredRule[] = [];
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
    latest >= tiers.diagnose &&
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
    latest >= tiers.log &&
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
      tier: TIER.DIAGNOSE,
      description: `the last ${SAME_SIDE_RUN} points all sit on the bad side of the mean`,
    });
  }

  return fired;
}

function highestTier(rules: FiredRule[]): Tier {
  return rules.reduce<Tier>(
    (best, rule) => (tierAtLeast(rule.tier, best) ? rule.tier : best),
    TIER.NONE,
  );
}

export function evaluateSeries(
  series: (number | null | undefined)[],
  config: MetricConfig,
): Evaluation {
  const present = series.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const base: Pick<Evaluation, 'tier' | 'rules' | 'recent'> = {
    tier: TIER.NONE,
    rules: [],
    recent: present.slice(-RECENT_POINTS),
  };
  const latestRaw = series.at(-1);
  if (typeof latestRaw !== 'number' || !Number.isFinite(latestRaw)) {
    return { ...base, status: STATUS.NO_DATA };
  }
  const scores = present.length <= config.minHistory ? [] : rollingScores(present, config);
  const last = scores.at(-1);
  if (last === undefined) {
    return { ...base, status: STATUS.INSUFFICIENT_HISTORY, value: latestRaw };
  }
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

export function resolveMetricConfig(config: BandsConfig, name: string): MetricConfig {
  const metric = config.metrics[name];
  if (metric === undefined) throw new Error(`bands config has no metric named ${name}`);
  return {
    ...config.defaults,
    ...metric,
    tiers: { ...config.defaults.tiers, ...(metric.tiers ?? {}) },
  };
}

function fail(message: string): never {
  throw new Error(`bands config invalid: ${message}`);
}

function isIntegerAtLeast(value: unknown, floor: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= floor;
}

function validateTiers(tiers: unknown, where: string): void {
  const { log, diagnose, propose } = (tiers ?? {}) as Partial<Record<keyof Tiers, unknown>>;
  const ascending =
    typeof log === 'number' &&
    typeof diagnose === 'number' &&
    typeof propose === 'number' &&
    log > 0 &&
    log < diagnose &&
    diagnose < propose;
  if (!ascending) fail(`${where} tiers must be positive and widen log < diagnose < propose`);
}

export function validateBandsConfig(config: unknown): void {
  const loose = config as LooseConfig | null | undefined;
  const issueFromTier = loose?.issueFromTier;
  if (typeof issueFromTier !== 'string' || !ISSUE_TIERS.includes(issueFromTier)) {
    fail(`issueFromTier must be one of ${ISSUE_TIERS.join(', ')}`);
  }
  const defaults = loose?.defaults ?? {};
  if (!isIntegerAtLeast(defaults.window, MIN_WINDOW)) {
    fail('defaults.window must be an integer of at least 2');
  }
  if (!isIntegerAtLeast(defaults.minHistory, MIN_HISTORY_FLOOR)) {
    fail('defaults.minHistory must be an integer of at least 2');
  }
  validateTiers(defaults.tiers, 'defaults');
  const entries = Object.entries(loose?.metrics ?? {});
  if (entries.length === 0) fail('metrics must name at least one metric');
  const directions: readonly unknown[] = Object.values(DIRECTION);
  for (const [name, metric] of entries) {
    if (!directions.includes(metric.direction)) {
      fail(`${name}.direction must be one of ${directions.join(', ')}`);
    }
    if (!(typeof metric.minStd === 'number' && metric.minStd > 0)) {
      fail(`${name}.minStd must be a positive number`);
    }
    if (metric.tiers !== undefined) {
      validateTiers(resolveMetricConfig(config as BandsConfig, name).tiers, name);
    }
  }
}

export function evaluateHistory(weeks: WeekRecord[], config: BandsConfig): BandsReport {
  const ordered = [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const evaluations: Record<string, Evaluation> = {};
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

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? String(Number(value.toFixed(FIXED_DIGITS))) : '-';
}

export function bandAnnotations(report: BandsReport): string[] {
  const notes: string[] = [];
  for (const [name, evaluation] of Object.entries(report.evaluations)) {
    if (evaluation.status === STATUS.NO_DATA) {
      notes.push(
        `::warning::${name} has no value for the week starting ${report.weekStart}, so it was not checked against its band`,
      );
    } else if (evaluation.status === STATUS.INSUFFICIENT_HISTORY) {
      notes.push(
        `::notice::${name} has too little history to build a band yet, so it was not checked`,
      );
    }
  }
  return notes;
}

export function renderTable(report: BandsReport): string {
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

function parseArgs(argv: string[]): BandsArgs {
  const args: BandsArgs = {
    history: DEFAULT_HISTORY_PATH,
    config: DEFAULT_CONFIG_PATH,
    out: DEFAULT_OUT_PATH,
  };
  const queue = [...argv];
  for (let flag = queue.shift(); flag !== undefined; flag = queue.shift()) {
    const key = flag.replace(FLAG_PREFIX, '');
    const value = queue.shift();
    if (!(key in args) || value === undefined) {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
    args[key as keyof BandsArgs] = value;
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(args.config, 'utf8')) as BandsConfig;
  validateBandsConfig(config);
  const history = existsSync(args.history)
    ? (JSON.parse(readFileSync(args.history, 'utf8')) as { weeks: WeekRecord[] })
    : { weeks: [] };
  const report = evaluateHistory(history.weeks, config);
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  const table = renderTable(report);
  console.log(`[bands] week ${report.weekStart ?? 'none'}\n${table}`);
  console.log(
    `[bands] breaches: ${report.breaches.length === 0 ? 'none' : report.breaches.join(', ')}`,
  );
  for (const note of bandAnnotations(report)) console.log(note);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Metric bands, week ${report.weekStart ?? 'none'}\n\n${table}\n`,
    );
  }
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      `::error::${String(error instanceof Error ? error.message : error).replace(LINE_BREAKS, ' ')}`,
    );
    process.exitCode = 1;
  }
}
