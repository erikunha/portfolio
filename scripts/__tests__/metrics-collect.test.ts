import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CollectedWeek, WeekWindow } from '../metrics/collect.mjs';
import {
  collectionWarnings,
  collectRange,
  deploymentOutcome,
  LIGHTHOUSE_SKIP_REASON,
  median,
  normalizePullRequest,
  parsePlaywrightFlaky,
  parseWeeksArg,
  sanitizeTestName,
  summarizeCiRuns,
  summarizeDeployments,
  summarizeFlaky,
  summarizePullRequests,
  upsertWeeks,
  weeksToCollect,
  weekWindows,
} from '../metrics/collect.mjs';
import type { GithubClient } from '../metrics/github.mjs';

const FIXTURES = join(process.cwd(), 'scripts', '__tests__', 'fixtures', 'metrics');
// behavioral-test-allow: recorded GitHub API responses are the inputs under test; the collector has no other way to be fed real payloads offline.
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const fixtureJson = (name: string) => JSON.parse(fixture(name));

const NOW = new Date('2026-11-09T08:00:00Z');
const FLAKY_JOB_ID = 128400528112;
const WEEK = weekWindows(NOW, 1)[0] as WeekWindow;
const CLEAN_LOG = '2026-11-07T12:19:47.6Z   740 passed (5.2m)\n';
const SEARCH_CAP = 1000;

describe('weekWindows', () => {
  it('returns the latest complete Monday-to-Monday UTC weeks, oldest first', () => {
    const windows = weekWindows(NOW, 2);
    expect(windows.map((w: { weekStart: string }) => w.weekStart)).toEqual([
      '2026-10-26',
      '2026-11-02',
    ]);
    expect(windows[1]?.weekEnd).toBe('2026-11-09');
  });

  it('does not treat the week in progress as complete', () => {
    const sunday = new Date('2026-11-08T23:59:59Z');
    expect(weekWindows(sunday, 1)[0]?.weekStart).toBe('2026-10-26');
  });

  it('treats Monday 00:00 UTC as the moment the previous week completes', () => {
    expect(weekWindows(new Date('2026-11-09T00:00:00Z'), 1)[0]?.weekStart).toBe('2026-11-02');
  });
});

describe('weeksToCollect', () => {
  it('backfills a quarter when there is no history', () => {
    expect(weeksToCollect({ weeks: [], now: NOW })).toBe(13);
  });

  it('collects only the weeks missing since the last recorded one', () => {
    const history = [{ weekStart: '2026-10-26' }];
    expect(weeksToCollect({ weeks: history, now: new Date('2026-11-23T08:00:00Z') })).toBe(3);
  });

  it('re-collects the latest week when it is already recorded, so a rerun is idempotent', () => {
    expect(weeksToCollect({ weeks: [{ weekStart: '2026-11-02' }], now: NOW })).toBe(1);
  });

  it('caps a long gap at one quarter', () => {
    expect(weeksToCollect({ weeks: [{ weekStart: '2025-01-06' }], now: NOW })).toBe(13);
  });

  it('lets an explicit count win', () => {
    expect(weeksToCollect({ weeks: [{ weekStart: '2026-11-02' }], now: NOW, explicit: 5 })).toBe(5);
  });
});

describe('parseWeeksArg', () => {
  it('reads auto as "decide from the history"', () => {
    expect(parseWeeksArg('auto')).toBeUndefined();
  });

  it('accepts a whole number of weeks', () => {
    expect(parseWeeksArg('13')).toBe(13);
  });

  it.each(['', '0', '-1', '2.5', 'abc', '105'])(
    'rejects %j instead of building NaN windows',
    (raw) => {
      expect(() => parseWeeksArg(raw)).toThrow(/--weeks/);
    },
  );
});

describe('median', () => {
  it('is the middle value, or the mean of the middle two', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('is null for no values rather than zero', () => {
    expect(median([])).toBeNull();
  });
});

describe('summarizePullRequests', () => {
  const nodes = fixtureJson('prs-page.json').data.search.nodes;
  const prs = nodes.map(normalizePullRequest);

  it('normalizes a GraphQL node', () => {
    expect(prs[0]).toEqual({
      number: 367,
      createdAt: '2026-11-07T09:07:31Z',
      mergedAt: '2026-11-07T10:18:19Z',
      authorIsBot: false,
      firstCommitAt: '2026-11-07T09:05:12Z',
    });
  });

  it('computes median lead time from the first commit and cycle time from the PR opening', () => {
    const result = summarizePullRequests(prs, WEEK);
    expect(result.prsMerged).toBe(4);
    expect(result.leadTimeHoursMedian).toBeCloseTo(1.5817, 3);
    expect(result.prCycleTimeHoursMedian).toBeCloseTo(1.5464, 3);
  });

  it('counts a bot PR as merged but leaves it out of the human timings', () => {
    const bot = { ...prs[0], number: 1, authorIsBot: true, createdAt: '2026-10-01T00:00:00Z' };
    const result = summarizePullRequests([...prs, bot], WEEK);
    expect(result.prsMerged).toBe(5);
    expect(result.prCycleTimeHoursMedian).toBeCloseTo(1.5464, 3);
  });

  it('includes a merge at the window start and excludes one at the window end', () => {
    const atStart = { ...prs[0], mergedAt: '2026-11-02T00:00:00Z' };
    const atEnd = { ...prs[0], mergedAt: '2026-11-09T00:00:00Z' };
    expect(summarizePullRequests([atStart], WEEK).prsMerged).toBe(1);
    expect(summarizePullRequests([atEnd], WEEK).prsMerged).toBe(0);
  });

  it('returns null timings when nothing merged, not zero', () => {
    const result = summarizePullRequests([], WEEK);
    expect(result).toEqual({
      prsMerged: 0,
      leadTimeHoursMedian: null,
      prCycleTimeHoursMedian: null,
    });
  });

  it('falls back to the PR opening when the first commit is unknown', () => {
    const noCommit = { ...prs[0], firstCommitAt: null };
    expect(summarizePullRequests([noCommit], WEEK).leadTimeHoursMedian).toBeCloseTo(1.18, 2);
  });
});

describe('deployments', () => {
  it('reads success from any status, since a later deployment turns it inactive', () => {
    expect(deploymentOutcome([{ state: 'inactive' }, { state: 'success' }])).toBe('success');
  });

  it('reads failure only when no status succeeded', () => {
    expect(deploymentOutcome([{ state: 'failure' }])).toBe('failure');
    expect(deploymentOutcome([{ state: 'error' }])).toBe('failure');
    expect(deploymentOutcome([{ state: 'failure' }, { state: 'success' }])).toBe('success');
  });

  it('leaves an unfinished deployment pending', () => {
    expect(deploymentOutcome([{ state: 'in_progress' }])).toBe('pending');
    expect(deploymentOutcome([])).toBe('pending');
  });

  it('counts successes in the window and the share that failed', () => {
    const deployments = [
      { createdAt: '2026-11-03T10:00:00Z', outcome: 'success' },
      { createdAt: '2026-11-04T10:00:00Z', outcome: 'failure' },
      { createdAt: '2026-11-05T10:00:00Z', outcome: 'success' },
      { createdAt: '2026-11-05T11:00:00Z', outcome: 'pending' },
      { createdAt: '2026-10-01T10:00:00Z', outcome: 'failure' },
    ];
    expect(summarizeDeployments(deployments, WEEK)).toEqual({
      productionDeploys: 2,
      failedDeploys: 1,
      deploymentFrequency: 2,
      deploymentFailureRate: 1 / 3,
    });
  });

  it('has no failure rate for a week with no finished deployment', () => {
    expect(summarizeDeployments([], WEEK).deploymentFailureRate).toBeNull();
  });
});

describe('summarizeCiRuns', () => {
  const runs = fixtureJson('ci-runs-main.json').workflow_runs.map(
    (run: { created_at: string; conclusion: string }) => ({
      createdAt: run.created_at,
      conclusion: run.conclusion,
    }),
  );

  it('reads the recorded main runs as all failed', () => {
    expect(summarizeCiRuns(runs, WEEK)).toEqual({ ciMainRuns: 4, ciMainFailureRate: 1 });
  });

  it('ignores cancelled and skipped runs, which say nothing about the code', () => {
    const mixed = [
      { createdAt: '2026-11-03T00:00:00Z', conclusion: 'success' },
      { createdAt: '2026-11-04T00:00:00Z', conclusion: 'failure' },
      { createdAt: '2026-11-05T00:00:00Z', conclusion: 'cancelled' },
      { createdAt: '2026-11-06T00:00:00Z', conclusion: 'skipped' },
    ];
    expect(summarizeCiRuns(mixed, WEEK)).toEqual({ ciMainRuns: 2, ciMainFailureRate: 0.5 });
  });

  it('has no rate when no run completed', () => {
    expect(summarizeCiRuns([], WEEK)).toEqual({ ciMainRuns: 0, ciMainFailureRate: null });
  });
});

describe('parsePlaywrightFlaky', () => {
  it('reads the flaky tests named in a recorded Playwright summary', () => {
    expect(parsePlaywrightFlaky(fixture('e2e-flaky.log'))).toEqual([
      '[chromium] › tests/e2e/locale-switch-position.spec.ts:38:5 › language switch keeps the section at phone › pt to en lands on the same section',
    ]);
  });

  it('does not double count the annotation line the GitHub reporter prints', () => {
    expect(parsePlaywrightFlaky(fixture('e2e-flaky.log'))).toHaveLength(1);
  });

  it('returns nothing for a run with no flaky tests', () => {
    const log = '2026-11-07T12:19:47.5Z   3 skipped\n2026-11-07T12:19:47.6Z   740 passed (5.2m)\n';
    expect(parsePlaywrightFlaky(log)).toEqual([]);
  });

  it('refuses a log with no Playwright totals line instead of reading it as zero flaky', () => {
    expect(() => parsePlaywrightFlaky('2026-11-07T12:00:00.0Z npm ERR! build failed\n')).toThrow(
      /Playwright/,
    );
    expect(() => parsePlaywrightFlaky('')).toThrow(/Playwright/);
  });

  it('accepts a run whose only totals are failures', () => {
    expect(parsePlaywrightFlaky('2026-11-07T12:00:00.0Z   2 failed\n')).toEqual([]);
  });

  it('adds up every summary block when one job runs Playwright twice', () => {
    const block = (name: string) =>
      `2026-11-07T12:00:00.0Z   1 flaky\n2026-11-07T12:00:00.1Z     [chromium] › ${name}\n2026-11-07T12:00:00.2Z   9 passed (1m)\n`;
    expect(
      parsePlaywrightFlaky(block('a.spec.ts:1:1 › one') + block('b.spec.ts:2:2 › two')),
    ).toEqual(['[chromium] › a.spec.ts:1:1 › one', '[chromium] › b.spec.ts:2:2 › two']);
  });

  it('strips colour codes and takes only as many names as the count says', () => {
    const log =
      '2026-11-07T12:00:00.0Z \u001b[33m  2 flaky\u001b[39m\n' +
      '2026-11-07T12:00:00.1Z     [webkit] › a.spec.ts:1:1 › one\n' +
      '2026-11-07T12:00:00.2Z     [webkit] › b.spec.ts:2:2 › two\n' +
      '2026-11-07T12:00:00.3Z     [webkit] › c.spec.ts:3:3 › not flaky\n';
    expect(parsePlaywrightFlaky(log)).toEqual([
      '[webkit] › a.spec.ts:1:1 › one',
      '[webkit] › b.spec.ts:2:2 › two',
    ]);
  });
});

describe('sanitizeTestName', () => {
  it('removes what could act as markup or a workflow command in a report', () => {
    expect(sanitizeTestName('::error::boom `code` @someone')).toBe(': :error: :boom code someone');
  });

  it('drops angle brackets and at-signs so a name cannot render as HTML or mention anyone', () => {
    const cleaned = sanitizeTestName('<img src=x onerror=1> @org/team <!-- metrics-breach:x -->');
    expect(cleaned).not.toMatch(/[<>@]/);
    expect(cleaned).toContain('org/team');
  });

  it('collapses control characters and caps the length', () => {
    expect(sanitizeTestName('a\u0007b\r\nc')).toBe('a b c');
    expect(sanitizeTestName('x'.repeat(500))).toHaveLength(200);
  });
});

describe('summarizeFlaky', () => {
  it('counts occurrences, distinct tests and the rate per e2e job', () => {
    const result = summarizeFlaky([{ flaky: ['a', 'b'] }, { flaky: ['a'] }, { flaky: [] }]);
    expect(result).toMatchObject({
      e2eJobsInspected: 3,
      flakyTests: 3,
      distinctFlakyTests: 2,
      flakyPerE2eJob: 1,
    });
    expect(result.topFlaky).toEqual([
      { test: 'a', count: 2 },
      { test: 'b', count: 1 },
    ]);
  });

  it('has no rate when no job was inspected', () => {
    expect(summarizeFlaky([]).flakyPerE2eJob).toBeNull();
  });
});

describe('upsertWeeks', () => {
  const week = (weekStart: string, marker = 'old') => ({ weekStart, marker });

  it('replaces a week with the same start and keeps order', () => {
    const merged = upsertWeeks(
      [week('2026-10-26'), week('2026-11-02')],
      [week('2026-11-02', 'new'), week('2026-11-09')],
    );
    expect(
      merged.map((w: { weekStart: string; marker: string }) => `${w.weekStart}:${w.marker}`),
    ).toEqual(['2026-10-26:old', '2026-11-02:new', '2026-11-09:old']);
  });

  it('keeps only the most recent weeks past the cap', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      week(new Date(Date.UTC(2025, 0, 6 + i * 7)).toISOString().slice(0, 10)),
    );
    const merged = upsertWeeks(many, []);
    expect(merged).toHaveLength(104);
    expect(merged.at(-1)).toEqual(many.at(-1));
  });
});

type FakeOptions = {
  allRunsLimit?: number;
  text?: (path: string) => Promise<string>;
  graphql?: (query: string, vars: { after?: string | null }) => Promise<unknown>;
  runs?: (isMainOnly: boolean) => { total_count: number; workflow_runs: unknown[] };
  deployments?: unknown[];
};

function fakeClient(options: FakeOptions = {}): {
  client: GithubClient;
  logCalls: string[];
} {
  const logCalls: string[] = [];
  const runsBody = fixtureJson('ci-runs-main.json');
  const jobsBody = fixtureJson('run-jobs.json');
  const prsPage = fixtureJson('prs-page.json').data;
  const client = {
    graphql:
      options.graphql ??
      (async (_query: string, vars: { after?: string | null }) =>
        vars.after
          ? {
              search: {
                nodes: [],
                issueCount: 4,
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            }
          : { search: { ...prsPage.search, issueCount: prsPage.search.nodes.length } }),
    paginate: async (
      path: string,
      opts: { params?: Record<string, string | number>; pick?: (body: unknown) => unknown[] } = {},
    ) => {
      const pick = opts.pick ?? ((body: unknown) => body as unknown[]);
      if (path === '/repos/o/r/deployments') {
        return pick(options.deployments ?? fixtureJson('deployments.json'));
      }
      if (path === '/repos/o/r/actions/workflows/ci.yml/runs') {
        const isMainOnly = opts.params?.branch === 'main';
        if (options.runs) return pick(options.runs(isMainOnly));
        const everything = runsBody.workflow_runs;
        const listed = isMainOnly ? everything : everything.slice(0, options.allRunsLimit ?? 1);
        return pick({ ...runsBody, workflow_runs: listed, total_count: listed.length });
      }
      if (/\/actions\/runs\/\d+\/jobs$/.test(path)) return pick(jobsBody);
      throw new Error(`unexpected paginate ${path}`);
    },
    json: async (path: string) => {
      const match = /deployments\/(\d+)\/statuses$/.exec(path);
      if (match) return fixtureJson(`deployment-statuses-${match[1]}.json`);
      throw new Error(`unexpected json ${path}`);
    },
    text: async (path: string) => {
      logCalls.push(path);
      if (options.text) return options.text(path);
      return path.endsWith(`/jobs/${FLAKY_JOB_ID}/logs`) ? fixture('e2e-flaky.log') : CLEAN_LOG;
    },
    request: async () => {
      throw new Error('unused');
    },
  } as unknown as GithubClient;
  return { client, logCalls };
}

describe('collectRange', () => {
  const windows = weekWindows(NOW, 1);

  it('assembles one week from recorded API payloads', async () => {
    const { client } = fakeClient();
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 })
    )[0] as CollectedWeek;
    expect(week.weekStart).toBe('2026-11-02');
    expect(week.metrics).toMatchObject({
      deploymentFrequency: 3,
      deploymentFailureRate: 0,
      ciMainFailureRate: 1,
      flakyPerE2eJob: 0.1,
    });
    expect(week.metrics.leadTimeHoursMedian).toBeCloseTo(1.5817, 3);
    expect(week.metrics.prCycleTimeHoursMedian).toBeCloseTo(1.5464, 3);
    expect(week.counts).toMatchObject({
      prsMerged: 4,
      productionDeploys: 3,
      ciMainRuns: 4,
      e2eJobsInspected: 10,
      flakyTests: 1,
      distinctFlakyTests: 1,
      logsTruncated: false,
    });
    expect(week.topFlaky).toHaveLength(1);
  });

  it('records why the Lighthouse LCP metric is not collected', async () => {
    const { client } = fakeClient();
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 })
    )[0] as CollectedWeek;
    expect(week.skipped.lighthouseLcp).toBe(LIGHTHOUSE_SKIP_REASON);
    expect(LIGHTHOUSE_SKIP_REASON).toMatch(/temporary-public-storage/);
  });

  it('downloads logs only for e2e jobs and stops at the per-week cap, saying so', async () => {
    const { client, logCalls } = fakeClient();
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 4 })
    )[0] as CollectedWeek;
    expect(logCalls).toHaveLength(4);
    expect(week.counts.e2eJobsInspected).toBe(4);
    expect(week.counts.logsTruncated).toBe(true);
  });

  it('makes no log request when logs are skipped, and leaves the flaky metric empty', async () => {
    const { client, logCalls } = fakeClient();
    const week = (
      await collectRange(client, { repo: 'o/r', windows, skipLogs: true })
    )[0] as CollectedWeek;
    expect(logCalls).toEqual([]);
    expect(week.metrics.flakyPerE2eJob).toBeNull();
    expect(week.skipped.flaky).toMatch(/skipped/i);
  });

  it('puts each record in the week it belongs to', async () => {
    const { client } = fakeClient();
    const two = weekWindows(NOW, 2);
    const weeks = await collectRange(client, { repo: 'o/r', windows: two, maxLogsPerWeek: 100 });
    expect(weeks.map((w: { weekStart: string }) => w.weekStart)).toEqual([
      '2026-10-26',
      '2026-11-02',
    ]);
    expect(weeks[0]?.counts.prsMerged).toBe(0);
    expect(weeks[0]?.metrics.leadTimeHoursMedian).toBeNull();
    expect(weeks[1]?.counts.prsMerged).toBe(4);
  });

  it('queries each week on its own, so no single query can reach the result cap', async () => {
    const queries: string[] = [];
    const { client } = fakeClient({
      graphql: async (_query, vars) => {
        queries.push(String((vars as unknown as { q: string }).q));
        return { search: { nodes: [], issueCount: 0, pageInfo: { hasNextPage: false } } };
      },
    });
    await collectRange(client, { repo: 'o/r', windows: weekWindows(NOW, 3), skipLogs: true });
    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain('2026-10-19T00:00:00Z..2026-10-26T00:00:00Z');
    expect(queries[2]).toContain('2026-11-02T00:00:00Z..2026-11-09T00:00:00Z');
  });

  it('fails when the PR search reports more matches than were fetched', async () => {
    const { client } = fakeClient({
      graphql: async () => ({
        search: { nodes: [], issueCount: 40, pageInfo: { hasNextPage: false, endCursor: null } },
      }),
    });
    await expect(collectRange(client, { repo: 'o/r', windows, skipLogs: true })).rejects.toThrow(
      /2026-11-02.*40/,
    );
  });

  it('fails when a PR search window fills the 1000 result cap, even if the totals agree', async () => {
    const nodes = Array.from({ length: SEARCH_CAP }, (_, number) => ({
      number,
      createdAt: '2026-11-03T00:00:00Z',
      mergedAt: '2026-11-04T00:00:00Z',
      author: { __typename: 'User' },
      commits: { nodes: [] },
    }));
    const { client } = fakeClient({
      graphql: async () => ({
        search: { nodes, issueCount: SEARCH_CAP, pageInfo: { hasNextPage: false } },
      }),
    });
    await expect(collectRange(client, { repo: 'o/r', windows, skipLogs: true })).rejects.toThrow(
      /1000/,
    );
  });

  it('fails when the CI run list reports more runs than were returned', async () => {
    const { client } = fakeClient({
      runs: () => ({
        total_count: 250,
        workflow_runs: fixtureJson('ci-runs-main.json').workflow_runs,
      }),
    });
    await expect(collectRange(client, { repo: 'o/r', windows, skipLogs: true })).rejects.toThrow(
      /250/,
    );
  });

  it('fails when a CI run window fills the 1000 result cap', async () => {
    const run = fixtureJson('ci-runs-main.json').workflow_runs[0];
    const { client } = fakeClient({
      runs: () => ({
        total_count: SEARCH_CAP,
        workflow_runs: Array.from({ length: SEARCH_CAP }, () => run),
      }),
    });
    await expect(collectRange(client, { repo: 'o/r', windows, skipLogs: true })).rejects.toThrow(
      /1000/,
    );
  });

  it('fails the collection when every e2e job log failed to download', async () => {
    const { client } = fakeClient({
      text: async () => {
        throw Object.assign(new Error('GitHub API GET logs returned HTTP 500'), { status: 500 });
      },
    });
    await expect(
      collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 }),
    ).rejects.toThrow(/every.*log/i);
  });

  it('keeps going, and counts the failures, when only some logs fail to download', async () => {
    const { client } = fakeClient({
      text: async (path) => {
        if (path.endsWith(`/jobs/${FLAKY_JOB_ID}/logs`)) {
          throw Object.assign(new Error('boom'), { status: 500 });
        }
        return CLEAN_LOG;
      },
    });
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 })
    )[0] as CollectedWeek;
    expect(week.counts.logErrors).toBe(1);
    expect(week.counts.e2eJobsInspected).toBe(9);
  });

  it('treats a log that has expired as absent data, not as a failed download', async () => {
    const { client } = fakeClient({
      text: async () => {
        throw Object.assign(new Error('gone'), { status: 410 });
      },
    });
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 })
    )[0] as CollectedWeek;
    expect(week.counts.logsExpired).toBe(10);
    expect(week.counts.logErrors).toBe(0);
    expect(week.metrics.flakyPerE2eJob).toBeNull();
  });

  it('counts a log with no Playwright summary as a log error and leaves it out of the rate', async () => {
    const { client } = fakeClient({ text: async () => 'npm ERR! install failed\n' });
    const week = (
      await collectRange(client, { repo: 'o/r', windows, maxLogsPerWeek: 100 })
    )[0] as CollectedWeek;
    expect(week.counts.logErrors).toBe(10);
    expect(week.counts.e2eJobsInspected).toBe(0);
    expect(week.metrics.flakyPerE2eJob).toBeNull();
  });

  it('records zero deployments for a range with none, without failing', async () => {
    const { client } = fakeClient({ deployments: [] });
    const week = (
      await collectRange(client, { repo: 'o/r', windows, skipLogs: true })
    )[0] as CollectedWeek;
    expect(week.counts.productionDeploys).toBe(0);
    expect(week.counts.failedDeploys).toBe(0);
  });
});

describe('collectionWarnings', () => {
  const week = (counts: Partial<CollectedWeek['counts']>, weekStart = '2026-11-02') =>
    ({
      weekStart,
      counts: {
        productionDeploys: 3,
        failedDeploys: 0,
        e2eJobsInspected: 10,
        logErrors: 0,
        logsExpired: 0,
        ...counts,
      },
    }) as unknown as CollectedWeek;

  it('is quiet when every log was read and deployments exist', () => {
    expect(collectionWarnings([week({})])).toEqual([]);
  });

  it('warns, naming the week and the count, when some logs could not be used', () => {
    const notes = collectionWarnings([week({ logErrors: 3 })]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^::warning::/);
    expect(notes[0]).toContain('2026-11-02');
    expect(notes[0]).toContain('3');
  });

  it('warns when logs had expired', () => {
    expect(collectionWarnings([week({ logsExpired: 4 })])[0]).toMatch(/^::warning::.*expired/);
  });

  it('warns loudly when no Production deployment was found anywhere in the range', () => {
    const notes = collectionWarnings([
      week({ productionDeploys: 0, failedDeploys: 0 }, '2026-10-26'),
      week({ productionDeploys: 0, failedDeploys: 0 }),
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^::warning::.*Production/);
    expect(notes[0]).toContain('2026-10-26');
  });

  it('does not warn about deployments when only some weeks had none', () => {
    expect(collectionWarnings([week({ productionDeploys: 0 }, '2026-10-26'), week({})])).toEqual(
      [],
    );
  });
});
