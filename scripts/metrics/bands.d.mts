export type Direction = 'higher-is-worse' | 'lower-is-worse';
export type Tier = 'none' | 'log' | 'diagnose' | 'propose';
export type Status = 'evaluated' | 'insufficient-history' | 'no-data';

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

export declare const DIRECTION: Readonly<{
  HIGHER_IS_WORSE: 'higher-is-worse';
  LOWER_IS_WORSE: 'lower-is-worse';
}>;
export declare const TIER: Readonly<{
  NONE: 'none';
  LOG: 'log';
  DIAGNOSE: 'diagnose';
  PROPOSE: 'propose';
}>;
export declare const STATUS: Readonly<{
  EVALUATED: 'evaluated';
  INSUFFICIENT_HISTORY: 'insufficient-history';
  NO_DATA: 'no-data';
}>;
export declare const RULE_ID: Readonly<Record<string, string>>;
export declare function mean(values: number[]): number;
export declare function sampleStd(values: number[]): number;
export declare function tierAtLeast(tier: string, floor: string): boolean;
export declare function rollingScores(
  values: number[],
  config: Omit<MetricConfig, 'tiers'> & { tiers?: Tiers },
): Score[];
export declare function applyWesternElectricRules(scores: number[], tiers: Tiers): FiredRule[];
export declare function evaluateSeries(
  series: (number | null | undefined)[],
  config: MetricConfig,
): Evaluation;
export declare function resolveMetricConfig(config: BandsConfig, name: string): MetricConfig;
export declare function validateBandsConfig(config: unknown): void;
export declare function evaluateHistory(weeks: WeekRecord[], config: BandsConfig): BandsReport;
export declare function bandAnnotations(report: BandsReport): string[];
export declare function renderTable(report: BandsReport): string;
