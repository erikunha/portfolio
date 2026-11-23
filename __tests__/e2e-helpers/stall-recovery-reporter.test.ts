import { describe, expect, it } from 'vitest';
import {
  MAX_STALL_RECOVERIES_PER_RUN,
  type StallRecoveryRecord,
  summarizeStallRecoveries,
} from '../../tests/e2e/_helpers/stall-recovery-reporter';

function record(testId: string, change: Partial<StallRecoveryRecord> = {}): StallRecoveryRecord {
  return {
    testId,
    title: `spec > ${testId}`,
    project: 'webkit-desktop',
    description: '/links/en; first attempt stalled 5000 ms; recovered: status 200',
    status: 'passed',
    ...change,
  };
}

describe('summarizeStallRecoveries', () => {
  it('prints a recovery on a passing test and lets one recovery per run pass', () => {
    const summary = summarizeStallRecoveries([record('a')]);
    expect(summary.lines).toEqual([
      'webkit-coop-navigation-stall [webkit-desktop] spec > a: /links/en; first attempt stalled 5000 ms; recovered: status 200 (test passed)',
    ]);
    expect(summary.failRun).toBe(false);
    expect(MAX_STALL_RECOVERIES_PER_RUN).toBe(1);
  });

  it('fails the run when two tests needed a recovery, and says why', () => {
    const summary = summarizeStallRecoveries([record('a'), record('b')]);
    expect(summary.failRun).toBe(true);
    expect(summary.counted).toBe(2);
    expect(summary.lines.at(-1)).toMatch(/^2 tests needed a WebKit COOP stall recovery/);
  });

  it('counts a test once across its retries', () => {
    const summary = summarizeStallRecoveries([record('a'), record('a', { status: 'failed' })]);
    expect(summary.failRun).toBe(false);
  });
});
