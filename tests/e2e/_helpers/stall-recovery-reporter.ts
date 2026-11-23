import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { WEBKIT_COOP_STALL_ANNOTATION } from './navigation-stall';

export const MAX_STALL_RECOVERIES_PER_RUN = 1;
const FAILED_STATUS = 'failed';

export interface StallRecoveryRecord {
  readonly testId: string;
  readonly title: string;
  readonly project: string;
  readonly description: string;
  readonly status: string;
}

export interface StallRecoverySummary {
  readonly lines: string[];
  readonly counted: number;
  readonly failRun: boolean;
}

export function summarizeStallRecoveries(
  records: readonly StallRecoveryRecord[],
): StallRecoverySummary {
  const lines = records.map(
    (record) =>
      `webkit-coop-navigation-stall [${record.project}] ${record.title}: ${record.description} (test ${record.status})`,
  );
  const counted = new Set(records.map((r) => r.testId)).size;
  const failRun = counted > MAX_STALL_RECOVERIES_PER_RUN;
  if (failRun) {
    lines.push(
      `${counted} tests needed a WebKit COOP stall recovery in this run, over the ${MAX_STALL_RECOVERIES_PER_RUN} one run may need (DECISIONS.md 2026-11-23): the run fails so a slow server or a changed stall rate is looked at, not hidden.`,
    );
  }
  return { lines, counted, failRun };
}

export default class StallRecoveryReporter implements Reporter {
  private readonly records: StallRecoveryRecord[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    for (const annotation of result.annotations) {
      if (annotation.type !== WEBKIT_COOP_STALL_ANNOTATION) continue;
      this.records.push({
        testId: test.id,
        title: test.titlePath().slice(1).join(' > '),
        project: test.parent.project()?.name ?? '',
        description: annotation.description ?? '',
        status: result.status,
      });
    }
  }

  async onEnd(_result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    const summary = summarizeStallRecoveries(this.records);
    for (const line of summary.lines) process.stdout.write(`${line}\n`);
    return summary.failRun ? { status: FAILED_STATUS } : undefined;
  }

  printsToStdio(): boolean {
    return false;
  }
}
