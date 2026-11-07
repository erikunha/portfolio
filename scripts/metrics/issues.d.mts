import type { BandsConfig, BandsReport } from './bands.mjs';
import type { GithubClient } from './github.mjs';

export interface IssueHistoryWeek {
  weekStart: string;
  topFlaky?: { test: string; count: number }[];
}

export type IssueAction =
  | { type: 'create'; metric: string; title: string; body: string }
  | { type: 'comment'; metric: string; issueNumber: number; body: string };

export declare const ISSUE_LABEL: string;
export declare function issueMarker(metric: string): string;
export declare function buildIssueTitle(metric: string): string;
export declare function buildIssueBody(options: {
  metric: string;
  report: BandsReport;
  config: BandsConfig;
  history: IssueHistoryWeek[];
  runUrl: string;
}): string;
export declare function planIssueActions(options: {
  report: BandsReport;
  config: BandsConfig;
  history: IssueHistoryWeek[];
  openIssues: { number: number; body?: string | null }[];
  runUrl: string;
}): IssueAction[];
export declare function applyPlan(
  client: GithubClient,
  repo: string,
  actions: IssueAction[],
  options?: { dryRun?: boolean },
): Promise<void>;
