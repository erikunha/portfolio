import type { GithubClient } from './github.mjs';

export interface WeekWindow {
  start: Date;
  end: Date;
  weekStart: string;
  weekEnd: string;
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

export declare const SCHEMA_VERSION: number;
export declare const LIGHTHOUSE_SKIP_REASON: string;
export declare const FLAKY_SKIP_REASON: string;
export declare function weekWindows(now: Date, count: number): WeekWindow[];
export declare function weeksToCollect(options: {
  weeks: { weekStart: string }[];
  now: Date;
  explicit?: number;
}): number;
export declare function parseWeeksArg(raw: string): number | undefined;
export declare function median(values: number[]): number | null;
export declare function normalizePullRequest(node: unknown): PullRequest;
export declare function summarizePullRequests(
  prs: PullRequest[],
  window: WeekWindow,
): { prsMerged: number; leadTimeHoursMedian: number | null; prCycleTimeHoursMedian: number | null };
export declare function deploymentOutcome(
  statuses: { state: string }[],
): 'success' | 'failure' | 'pending';
export declare function summarizeDeployments(
  deployments: { createdAt: string; outcome: string }[],
  window: WeekWindow,
): {
  productionDeploys: number;
  failedDeploys: number;
  deploymentFrequency: number;
  deploymentFailureRate: number | null;
};
export declare function summarizeCiRuns(
  runs: { createdAt: string; conclusion: string }[],
  window: WeekWindow,
): { ciMainRuns: number; ciMainFailureRate: number | null };
export declare function sanitizeTestName(name: string): string;
export declare function parsePlaywrightFlaky(logText: string): string[];
export declare function summarizeFlaky(jobs: { flaky: string[] }[]): {
  e2eJobsInspected: number;
  flakyTests: number;
  distinctFlakyTests: number;
  flakyPerE2eJob: number | null;
  topFlaky: { test: string; count: number }[];
};
export declare function upsertWeeks<T extends { weekStart: string }>(
  existing: T[],
  fresh: T[],
): T[];
export declare function collectionWarnings(weeks: CollectedWeek[]): string[];
export declare function collectRange(
  client: GithubClient,
  options: {
    repo: string;
    windows: WeekWindow[];
    maxLogsPerWeek?: number;
    skipLogs?: boolean;
    now?: Date;
  },
): Promise<CollectedWeek[]>;
