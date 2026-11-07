import { describe, expect, it, vi } from 'vitest';
import type { BandsConfig, BandsReport } from '../metrics/bands.mjs';
import type { GithubClient } from '../metrics/github.mjs';
import type { IssueAction } from '../metrics/issues.mjs';
import {
  applyPlan,
  buildIssueBody,
  buildIssueTitle,
  ISSUE_LABEL,
  issueMarker,
  planIssueActions,
} from '../metrics/issues.mjs';

const RUN_URL = 'https://github.com/o/r/actions/runs/1';
const CONFIG: BandsConfig = {
  version: 1,
  issueFromTier: 'diagnose',
  defaults: { window: 12, minHistory: 6, tiers: { log: 1, diagnose: 2, propose: 3 } },
  metrics: {
    ciMainFailureRate: {
      direction: 'higher-is-worse',
      minStd: 0.05,
      unit: 'share of completed CI runs on main that failed',
    },
    flakyPerE2eJob: { direction: 'higher-is-worse', minStd: 0.02, unit: 'flaky tests per e2e job' },
  },
};

const REPORT: BandsReport = {
  weekStart: '2026-11-02',
  breaches: ['ciMainFailureRate'],
  evaluations: {
    ciMainFailureRate: {
      status: 'evaluated',
      tier: 'propose',
      value: 1,
      mean: 0.1,
      std: 0.1,
      z: 9,
      badness: 9,
      rules: [
        {
          id: 'beyond-propose',
          tier: 'propose',
          description: 'latest point is 3 sigma or more on the bad side',
        },
      ],
      recent: [0, 0.1, 0.2, 0, 0.1, 0.1, 1],
    },
    flakyPerE2eJob: {
      status: 'evaluated',
      tier: 'none',
      value: 0.1,
      mean: 0.1,
      std: 0.02,
      z: 0,
      badness: 0,
      rules: [],
      recent: [0.1],
    },
  },
};

const HISTORY = [
  {
    weekStart: '2026-11-02',
    metrics: { ciMainFailureRate: 1, flakyPerE2eJob: 0.1 },
    topFlaky: [{ test: '[chromium] › a.spec.ts:1:1 › one @someone', count: 2 }],
  },
];

describe('issue text', () => {
  it('names the metric in a stable title so one metric keeps one issue', () => {
    expect(buildIssueTitle('ciMainFailureRate')).toBe('Metric breach: ciMainFailureRate');
  });

  it('carries the hidden marker used to find the issue again', () => {
    const body = buildIssueBody({
      metric: 'ciMainFailureRate',
      report: REPORT,
      config: CONFIG,
      history: HISTORY,
      runUrl: RUN_URL,
    });
    expect(body).toContain(issueMarker('ciMainFailureRate'));
  });

  it('states the tier, the value against the band, the rules and what to do at that tier', () => {
    const body = buildIssueBody({
      metric: 'ciMainFailureRate',
      report: REPORT,
      config: CONFIG,
      history: HISTORY,
      runUrl: RUN_URL,
    });
    expect(body).toContain('propose');
    expect(body).toContain('2026-11-02');
    expect(body).toContain('1');
    expect(body).toMatch(/mean 0\.1/);
    expect(body).toContain('latest point is 3 sigma or more on the bad side');
    expect(body).toContain('share of completed CI runs on main that failed');
    expect(body).toContain(RUN_URL);
    expect(body).toMatch(/not.*target/i);
  });

  it('lists the flaky tests as code spans so a name cannot ping anyone', () => {
    const body = buildIssueBody({
      metric: 'flakyPerE2eJob',
      report: REPORT,
      config: CONFIG,
      history: HISTORY,
      runUrl: RUN_URL,
    });
    expect(body).toContain('`[chromium] › a.spec.ts:1:1 › one @someone`');
  });

  it('never uses an em dash or an en dash', () => {
    const body = buildIssueBody({
      metric: 'ciMainFailureRate',
      report: REPORT,
      config: CONFIG,
      history: HISTORY,
      runUrl: RUN_URL,
    });
    const EN_DASH = String.fromCharCode(0x2013);
    const EM_DASH = String.fromCharCode(0x2014);
    expect(body).not.toContain(EN_DASH);
    expect(body).not.toContain(EM_DASH);
  });
});

describe('planIssueActions', () => {
  const plan = (openIssues: { number: number; body: string }[]) =>
    planIssueActions({
      report: REPORT,
      config: CONFIG,
      history: HISTORY,
      openIssues,
      runUrl: RUN_URL,
    });

  it('creates one issue per breached metric when none is open', () => {
    const actions = plan([]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'create', metric: 'ciMainFailureRate' });
  });

  it('comments on the open issue for that metric instead of opening a second one', () => {
    const actions = plan([{ number: 12, body: `${issueMarker('ciMainFailureRate')}\nold text` }]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'comment', issueNumber: 12 });
  });

  it('ignores an open issue that belongs to a different metric', () => {
    const actions = plan([{ number: 9, body: issueMarker('flakyPerE2eJob') }]);
    expect(actions[0]).toMatchObject({ type: 'create' });
  });

  it('plans nothing when no metric breached', () => {
    const quiet = { ...REPORT, breaches: [] };
    expect(
      planIssueActions({
        report: quiet,
        config: CONFIG,
        history: HISTORY,
        openIssues: [],
        runUrl: RUN_URL,
      }),
    ).toEqual([]);
  });
});

describe('applyPlan', () => {
  function recorder(labelError?: Error) {
    const calls: { path: string; method?: string | undefined; body?: unknown }[] = [];
    const client = {
      request: vi.fn(async (path: string, options: { method?: string; body?: unknown } = {}) => {
        calls.push({ path, method: options.method, body: options.body });
        if (path.endsWith('/labels') && labelError) throw labelError;
        return new Response('{}', { status: 201 });
      }),
    } as unknown as GithubClient;
    return { client, calls };
  }

  const create: IssueAction = { type: 'create', metric: 'm', title: 'T', body: 'B' };
  const comment: IssueAction = { type: 'comment', metric: 'm', issueNumber: 5, body: 'C' };

  it('makes sure the label exists, then opens the issue carrying it', async () => {
    const { client, calls } = recorder();
    await applyPlan(client, 'o/r', [create]);
    expect(calls.map((c) => c.path)).toEqual(['/repos/o/r/labels', '/repos/o/r/issues']);
    expect(calls[1]?.body).toMatchObject({ title: 'T', body: 'B', labels: [ISSUE_LABEL] });
  });

  it('posts a comment to the existing issue', async () => {
    const { client, calls } = recorder();
    await applyPlan(client, 'o/r', [comment]);
    expect(calls.at(-1)).toMatchObject({ path: '/repos/o/r/issues/5/comments', method: 'POST' });
  });

  it('carries on when the label already exists (HTTP 422)', async () => {
    const { client, calls } = recorder(
      new Error('GitHub API POST /repos/o/r/labels returned HTTP 422'),
    );
    await applyPlan(client, 'o/r', [create]);
    expect(calls.map((c) => c.path)).toContain('/repos/o/r/issues');
  });

  it('stops on any other label error rather than opening unlabeled issues', async () => {
    const { client } = recorder(new Error('GitHub API POST /repos/o/r/labels returned HTTP 403'));
    await expect(applyPlan(client, 'o/r', [create])).rejects.toThrow(/403/);
  });

  it('makes no request in a dry run', async () => {
    const { client, calls } = recorder();
    await applyPlan(client, 'o/r', [create, comment], { dryRun: true });
    expect(calls).toEqual([]);
  });

  it('does not touch the label when there is nothing to do', async () => {
    const { client, calls } = recorder();
    await applyPlan(client, 'o/r', []);
    expect(calls).toEqual([]);
  });
});
