import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  githubReader,
  REFERENCE_STATE,
  referenceState,
  waitForReference,
} from '../../scripts/wait-argos-reference.mjs';

const VISUAL_DESKTOP = 'e2e-visual-chromium (chromium)';
const VISUAL_MOBILE = 'e2e-visual-chromium (chromium-mobile)';
const COMPLETED = 'completed';
const IN_PROGRESS = 'in_progress';
const QUEUED = 'queued';
const silent = (_message: string) => undefined;

function job(name: string, status: string) {
  return { name, status };
}

describe('referenceState', () => {
  it('is absent when the merge base has no CI run, so the build compares against what Argos has', () => {
    expect(referenceState(undefined, [])).toBe(REFERENCE_STATE.absent);
  });

  it('is pending while a visual job of the merge base run has not uploaded yet', () => {
    const run = { status: IN_PROGRESS };
    const jobs = [job(VISUAL_DESKTOP, COMPLETED), job(VISUAL_MOBILE, IN_PROGRESS)];
    expect(referenceState(run, jobs)).toBe(REFERENCE_STATE.pending);
  });

  it('is pending while the run has not created its visual jobs yet', () => {
    expect(referenceState({ status: QUEUED }, [job('build', IN_PROGRESS)])).toBe(
      REFERENCE_STATE.pending,
    );
  });

  it('is ready once every visual job of the merge base run has finished', () => {
    const run = { status: IN_PROGRESS };
    const jobs = [
      job(VISUAL_DESKTOP, COMPLETED),
      job(VISUAL_MOBILE, COMPLETED),
      job('lighthouse', IN_PROGRESS),
    ];
    expect(referenceState(run, jobs)).toBe(REFERENCE_STATE.ready);
  });

  it('is ready once the whole run has finished, even when it ran no visual job', () => {
    expect(referenceState({ status: COMPLETED }, [])).toBe(REFERENCE_STATE.ready);
  });
});

describe('waitForReference', () => {
  function clock() {
    let elapsed = 0;
    return {
      now: () => elapsed,
      sleep: async (ms: number) => {
        elapsed += ms;
      },
    };
  }

  it('waits through the pending readings and returns once the reference is ready', async () => {
    const readings = [REFERENCE_STATE.pending, REFERENCE_STATE.pending, REFERENCE_STATE.ready];
    const { now, sleep } = clock();
    let calls = 0;
    const result = await waitForReference({
      readState: async () => readings[calls++] ?? REFERENCE_STATE.ready,
      now,
      sleep,
      intervalMs: 10,
      deadlineMs: 1000,
      log: silent,
    });
    expect(result).toBe(REFERENCE_STATE.ready);
    expect(calls).toBe(3);
  });

  it('returns at once when the merge base has no run to wait for', async () => {
    const { now, sleep } = clock();
    let calls = 0;
    const result = await waitForReference({
      readState: async () => {
        calls++;
        return REFERENCE_STATE.absent;
      },
      now,
      sleep,
      intervalMs: 10,
      deadlineMs: 1000,
      log: silent,
    });
    expect(result).toBe(REFERENCE_STATE.absent);
    expect(calls).toBe(1);
  });

  it('gives up at the deadline instead of holding the job forever', async () => {
    const { now, sleep } = clock();
    const result = await waitForReference({
      readState: async () => REFERENCE_STATE.pending,
      now,
      sleep,
      intervalMs: 100,
      deadlineMs: 350,
      log: silent,
    });
    expect(result).toBe(REFERENCE_STATE.timeout);
    expect(now()).toBeLessThanOrEqual(400);
  });

  it('keeps waiting through a failed reading instead of uploading against a stale reference', async () => {
    const { now, sleep } = clock();
    let calls = 0;
    const result = await waitForReference({
      readState: async () => {
        calls++;
        if (calls === 1) throw new Error('GitHub API 502');
        return REFERENCE_STATE.ready;
      },
      now,
      sleep,
      intervalMs: 10,
      deadlineMs: 1000,
      log: silent,
    });
    expect(result).toBe(REFERENCE_STATE.ready);
    expect(calls).toBe(2);
  });
});

describe('githubReader', () => {
  const REPOSITORY = 'owner/repo';
  const BASE_REF = 'main';
  const HEAD_SHA = 'a'.repeat(40);
  const MERGE_BASE = 'b'.repeat(40);
  const RUN_ID = 42;
  const HTTP_BAD_GATEWAY = 502;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubGithub(routes: Array<{ match: string; body: unknown; status?: number }>) {
    const requested: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requested.push(url);
        const route = routes.find((candidate) => url.includes(candidate.match));
        if (!route) throw new Error(`unexpected request ${url}`);
        const status = route.status ?? 200;
        return new Response(JSON.stringify(route.body), { status });
      }),
    );
    return requested;
  }

  const read = () =>
    githubReader({ repository: REPOSITORY, token: 't', baseRef: BASE_REF, headSha: HEAD_SHA })();

  it('resolves the merge base like Argos and waits on the push run of that commit', async () => {
    const requested = stubGithub([
      { match: '/compare/', body: { merge_base_commit: { sha: MERGE_BASE } } },
      {
        match: '/actions/workflows/ci.yml/runs',
        body: { workflow_runs: [{ id: RUN_ID, status: IN_PROGRESS }] },
      },
      {
        match: `/actions/runs/${RUN_ID}/jobs`,
        body: { jobs: [job(VISUAL_DESKTOP, COMPLETED), job(VISUAL_MOBILE, IN_PROGRESS)] },
      },
    ]);
    expect(await read()).toBe(REFERENCE_STATE.pending);
    expect(requested[0]).toContain(`/repos/${REPOSITORY}/compare/${BASE_REF}...${HEAD_SHA}`);
    expect(requested[1]).toContain(`head_sha=${MERGE_BASE}`);
    expect(requested[1]).toContain('event=push');
  });

  it('is ready once the visual jobs of the merge base run finished', async () => {
    stubGithub([
      { match: '/compare/', body: { merge_base_commit: { sha: MERGE_BASE } } },
      {
        match: '/actions/workflows/ci.yml/runs',
        body: { workflow_runs: [{ id: RUN_ID, status: IN_PROGRESS }] },
      },
      {
        match: `/actions/runs/${RUN_ID}/jobs`,
        body: { jobs: [job(VISUAL_DESKTOP, COMPLETED), job(VISUAL_MOBILE, COMPLETED)] },
      },
    ]);
    expect(await read()).toBe(REFERENCE_STATE.ready);
  });

  it('is absent when the merge base has no push run', async () => {
    stubGithub([
      { match: '/compare/', body: { merge_base_commit: { sha: MERGE_BASE } } },
      { match: '/actions/workflows/ci.yml/runs', body: { workflow_runs: [] } },
    ]);
    expect(await read()).toBe(REFERENCE_STATE.absent);
  });

  it('throws on a failed API reading, so the wait keeps waiting instead of uploading', async () => {
    stubGithub([{ match: '/compare/', body: {}, status: HTTP_BAD_GATEWAY }]);
    await expect(read()).rejects.toThrow(String(HTTP_BAD_GATEWAY));
  });
});
