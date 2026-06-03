# CI/CD Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all Critical/High/Medium findings from the Staff+ DevOps audit: production healthz endpoint, post-deploy smoke test, rollback runbook, PSI cron alerting, ai-eval Upstash isolation, and CI hardening (server crash logging, E2E auto-discovery, SHA-pinned actions, .nvmrc).

**Architecture:** Two independent PRs. Phase 1 (`ci/phase-1-operational-reliability`) adds the runtime observability layer: a `/api/healthz` route, a `deployment_status`-triggered smoke workflow, PSI cron failure alerts via Resend, and isolation of the ai-eval CI job onto its own dedicated Upstash instance. Phase 2 (`ci/phase-2-ci-hardening`) hardens the pipeline config: `.nvmrc`, SHA-pinned actions, server-crash logging in CI, and E2E test file auto-discovery by moving `visual.spec.ts` to its own directory.

**Tech Stack:** Next.js 16 App Router, Upstash Redis (`@upstash/redis`), Resend (`resend`), Vitest, Playwright, GitHub Actions, pnpm.

> **Note on O4 (function coverage):** `vitest.config.ts` already enforces `functions: 80`. The audit's "double-dash in the PR comment" was a display issue in the coverage bot, not a missing threshold. No action needed.

> **Prerequisite for Task 8 (ai-eval Upstash isolation):** Provision a new Upstash Redis database named `erik-portfolio-eval` at console.upstash.com. Add its REST URL and token as GitHub repository secrets `UPSTASH_REDIS_REST_URL_EVAL` and `UPSTASH_REDIS_REST_TOKEN_EVAL` before the Phase 1 PR CI will pass the `ai-eval` job.

---

## File Map

**Phase 1 — new files:**
- `app/api/healthz/route.ts` — healthz endpoint
- `__tests__/healthz.test.ts` — unit tests for healthz
- `.github/workflows/smoke.yml` — post-deploy smoke workflow

**Phase 1 — modified files:**
- `app/api/psi-refresh/route.ts` — add `meta:psi-last-run` KV write + Resend failure alert
- `__tests__/psi-refresh.test.ts` — NEW unit tests for psi-refresh alerting
- `tests/e2e/observability-smoke.spec.ts` — add healthz E2E assertion
- `.github/workflows/ci.yml` — ai-eval job env vars
- `CLAUDE.md` — rollback runbook section
- `DECISIONS.md` — Vercel notifications config note

**Phase 2 — new files:**
- `.nvmrc` — Node 22 version pin

**Phase 2 — modified files:**
- `.github/workflows/ci.yml` — server crash logging (5 jobs), e2e-functional auto-discovery
- `.github/workflows/codeql.yml` — SHA-pinned actions
- `.github/workflows/mutation.yml` — SHA-pinned actions
- `.github/dependabot.yml` — `pin-digests: true` for github-actions ecosystem
- `tests/visual/visual.spec.ts` — moved from `tests/e2e/visual.spec.ts`
- `tests/visual/visual.spec.ts-snapshots/` — moved from `tests/e2e/visual.spec.ts-snapshots/`

---

## Phase 1: Operational Reliability

---

### Task 1: Write failing unit tests for `/api/healthz`

**Files:**
- Create: `__tests__/healthz.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
// __tests__/healthz.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockGet = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ get: redisMockGet })),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMockGet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with status ok and sha when Upstash responds', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockResolvedValue('2026-06-03T03:00:00.000Z');

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body).toEqual({
      status: 'ok',
      sha: 'abc1234',
      psiLastRun: '2026-06-03T03:00:00.000Z',
    });
  });

  it('returns status ok with sha=local when VERCEL_GIT_COMMIT_SHA is not set', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    redisMockGet.mockResolvedValue(null);

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.sha).toBe('local');
    expect(body.psiLastRun).toBeNull();
  });

  it('returns 503 with status degraded when Upstash throws', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc1234');
    redisMockGet.mockRejectedValue(new Error('connection refused'));

    const { GET } = await import('@/app/api/healthz/route');
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: null };
    expect(body.status).toBe('degraded');
    expect(body.psiLastRun).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail with "Cannot find module"**

```bash
pnpm test --run __tests__/healthz.test.ts 2>&1 | tail -10
```

Expected: `Error: Cannot find module '@/app/api/healthz/route'`

---

### Task 2: Implement `/api/healthz` route

**Files:**
- Create: `app/api/healthz/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/healthz/route.ts
import { getRedis } from '@/lib/rate-limit';

export async function GET(): Promise<Response> {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';

  let psiLastRun: string | null = null;
  let status: 'ok' | 'degraded' = 'ok';

  try {
    psiLastRun = await getRedis().get<string>('meta:psi-last-run');
  } catch {
    status = 'degraded';
  }

  return Response.json({ status, sha, psiLastRun }, { status: status === 'ok' ? 200 : 503 });
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
pnpm test --run __tests__/healthz.test.ts 2>&1 | tail -10
```

Expected: `3 passed`

- [ ] **Step 3: Run the full test suite to catch regressions**

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: all tests pass, no new failures.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/healthz/route.ts __tests__/healthz.test.ts
git commit -m "feat(healthz): add /api/healthz endpoint with sha + psiLastRun"
```

---

### Task 3: Add healthz E2E assertion to observability-smoke.spec.ts

**Files:**
- Modify: `tests/e2e/observability-smoke.spec.ts`

- [ ] **Step 1: Append the healthz test inside the `test.describe` block**

Open `tests/e2e/observability-smoke.spec.ts`. Inside the `test.describe('observability smoke', () => {` block, after the last existing test (line 79, before the closing `}`), add:

```typescript
  test('GET /api/healthz returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/api/healthz');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string; sha: string; psiLastRun: string | null };
    expect(body.status).toBe('ok');
    expect(typeof body.sha).toBe('string');
    expect(body.sha.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the E2E smoke spec locally against the dev server (Playwright MCP visual check not needed — this is a JSON API test)**

```bash
pnpm dev &
npx wait-on http://localhost:3000 --timeout 30000
pnpm playwright test --project=chromium tests/e2e/observability-smoke.spec.ts 2>&1 | tail -15
```

Expected: all 5 tests pass (4 existing + 1 new).

- [ ] **Step 3: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/observability-smoke.spec.ts
git commit -m "test(e2e): add /api/healthz smoke assertion"
```

---

### Task 4: Write failing unit tests for psi-refresh alerting

**Files:**
- Create: `__tests__/psi-refresh.test.ts`

- [ ] **Step 1: Write the failing test file**

```typescript
// __tests__/psi-refresh.test.ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMockSet = vi.fn(async () => 'OK');
const sendMock = vi.fn(async () => ({ data: { id: 'email-id' }, error: null }));

vi.mock('@/lib/lighthouse-scores', () => ({
  refreshScores: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  getRedis: vi.fn(() => ({ set: redisMockSet })),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/psi-refresh', {
    method: 'GET',
    headers: { authorization: `Bearer test-cron-secret` },
  });
}

describe('GET /api/psi-refresh', () => {
  beforeEach(async () => {
    vi.resetModules();
    redisMockSet.mockReset().mockResolvedValue('OK');
    sendMock.mockReset().mockResolvedValue({ data: { id: 'email-id' }, error: null });
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
  });

  it('writes meta:psi-last-run to Redis on full success', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const mockRefresh = vi.mocked(refreshScores);
    mockRefresh.mockResolvedValue({ performance: 95, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: new Date().toISOString() });

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(redisMockSet).toHaveBeenCalledWith('meta:psi-last-run', expect.any(String));
    // Verify the written value is a valid ISO timestamp
    const writtenValue = redisMockSet.mock.calls[0]?.[1] as string;
    expect(() => new Date(writtenValue).toISOString()).not.toThrow();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does NOT write meta:psi-last-run and sends Resend alert on partial failure', async () => {
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    const mockRefresh = vi.mocked(refreshScores);
    mockRefresh
      .mockResolvedValueOnce({ performance: 95, accessibility: 100, bestPractices: 95, seo: 100, fetchedAt: new Date().toISOString() })
      .mockRejectedValueOnce(new Error('PSI API timeout'));

    const { GET } = await import('@/app/api/psi-refresh/route');
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(redisMockSet).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce();
    const call = sendMock.mock.calls[0]?.[0] as { subject: string; to: string };
    expect(call.subject).toContain('psi-refresh');
    expect(call.to).toBe('erikhunha@gmail.com');
  });

  it('returns 401 if Authorization header is missing', async () => {
    const { GET } = await import('@/app/api/psi-refresh/route');
    const req = new NextRequest('http://localhost/api/psi-refresh', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(redisMockSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail (route doesn't have the new behavior yet)**

```bash
pnpm test --run __tests__/psi-refresh.test.ts 2>&1 | tail -15
```

Expected: failures on the `meta:psi-last-run` assertion and the `sendMock` assertion.

---

### Task 5: Implement psi-refresh `meta:psi-last-run` write + Resend failure alert

**Files:**
- Modify: `app/api/psi-refresh/route.ts`

- [ ] **Step 1: Replace the file with the updated implementation**

Current file at `app/api/psi-refresh/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { refreshScores } from '@/lib/lighthouse-scores';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const t0 = Date.now();
  const [desktopResult, mobileResult] = await Promise.allSettled([
    refreshScores('desktop'),
    refreshScores('mobile'),
  ]);

  const result = {
    desktop: desktopResult.status === 'fulfilled' ? desktopResult.value : null,
    mobile: mobileResult.status === 'fulfilled' ? mobileResult.value : null,
    durationMs: Date.now() - t0,
  };

  const anyFailed = desktopResult.status === 'rejected' || mobileResult.status === 'rejected';

  if (anyFailed) {
    const errors = [desktopResult, mobileResult]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
      .join('; ');

    log.error('psi-refresh failed', { errors });

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'alerts@erikunha.dev',
        to: 'erikhunha@gmail.com',
        subject: '[portfolio] psi-refresh cron failed',
        text: `One or more PSI refreshes failed.\n\nErrors: ${errors}\nTimestamp: ${new Date().toISOString()}`,
      });
    } catch (alertErr) {
      // Alert delivery failure must not mask the original error or change the response.
      log.error('psi-refresh alert email failed to send', { err: alertErr });
    }
  } else {
    // Both succeeded — record the timestamp so /api/healthz can report freshness.
    await getRedis().set('meta:psi-last-run', new Date().toISOString());
  }

  log.info('psi-refresh completed', { durationMs: result.durationMs, anyFailed });
  // WHY: non-2xx signals Vercel Cron to retry and surface the failure in the dashboard.
  return Response.json(result, { status: anyFailed ? 500 : 200 });
}
```

- [ ] **Step 2: Run the psi-refresh tests — confirm they pass**

```bash
pnpm test --run __tests__/psi-refresh.test.ts 2>&1 | tail -10
```

Expected: `3 passed`

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/psi-refresh/route.ts __tests__/psi-refresh.test.ts
git commit -m "feat(psi-refresh): write psi-last-run on success, alert via Resend on failure"
```

---

### Task 6: Add `.github/workflows/smoke.yml`

**Files:**
- Create: `.github/workflows/smoke.yml`

The `deployment_status` GitHub event fires whenever Vercel updates a GitHub Deployment object. Vercel sets environment to `"Production"` for main-branch deploys and `"Preview"` for PR previews. The job condition filters to production success only.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Post-Deploy Smoke Test

# Fires when Vercel updates a GitHub Deployment status.
# Vercel registers GitHub Deployments on every push; state=success means
# the build and CDN promotion completed. We filter to Production only.
on:
  deployment_status:

jobs:
  smoke:
    if: >
      github.event.deployment_status.state == 'success' &&
      github.event.deployment.environment == 'Production'
    runs-on: ubuntu-latest
    permissions:
      deployments: read
    timeout-minutes: 5

    steps:
      - name: Health check — /api/healthz returns 200
        run: |
          response=$(curl --fail --max-time 30 --silent \
            --write-out "\n%{http_code}" \
            https://erikunha.dev/api/healthz)
          http_code=$(echo "$response" | tail -1)
          body=$(echo "$response" | head -1)
          echo "Status: $http_code"
          echo "Body: $body"
          if [ "$http_code" != "200" ]; then
            echo "ERROR: /api/healthz returned $http_code"
            exit 1
          fi

      - name: Homepage responds with 200
        run: |
          http_code=$(curl --fail --max-time 30 --silent \
            --output /dev/null \
            --write-out "%{http_code}" \
            https://erikunha.dev)
          echo "Homepage status: $http_code"
          if [ "$http_code" != "200" ]; then
            echo "ERROR: homepage returned $http_code"
            exit 1
          fi
```

- [ ] **Step 2: Lint the YAML syntax**

```bash
pnpm exec js-yaml .github/workflows/smoke.yml > /dev/null && echo "YAML OK" || echo "YAML syntax error"
```

If `js-yaml` is not available: `npx --yes js-yaml .github/workflows/smoke.yml > /dev/null && echo "YAML OK"`

Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/smoke.yml
git commit -m "ci(smoke): add post-deploy smoke test via deployment_status event"
```

---

### Task 7: Rollback runbook + DECISIONS.md entry

**Files:**
- Modify: `CLAUDE.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Add rollback section to CLAUDE.md**

In `CLAUDE.md`, find the `## PR merge gate` section. Insert the following new section immediately BEFORE it:

```markdown
## Emergency Rollback

Fast path (30s — no code change needed):
```
vercel ls                              # find the prior deployment URL
vercel promote <prior-deployment-url> # promote it to production
```

Slow path (5 min — commits a revert):
```
git revert HEAD
git push
```

Verify the correct version is live:
```
curl https://erikunha.dev/api/healthz | jq .sha
```

```

- [ ] **Step 2: Add entry to DECISIONS.md**

Open `DECISIONS.md` and add a new entry at the top of the running log (or in date order):

```markdown
- **2026-06-03** — Added rollback runbook to CLAUDE.md (fast: `vercel promote`; slow: `git revert`). Reversibility: n/a (documentation). Vercel deploy notifications enabled in Project Settings → Notifications (email on deploy success/failure). No code change required.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md DECISIONS.md
git commit -m "docs(ci): add emergency rollback runbook and Vercel notifications ADR"
```

- [ ] **Step 4: Manual one-time action (no PR gate)**

In the Vercel dashboard: Project Settings → Notifications → enable email alerts for deployment success and failure. This cannot be automated via code; document that it was done in the commit message body.

---

### Task 8: Update ci.yml — ai-eval dedicated Upstash secrets

**Files:**
- Modify: `.github/workflows/ci.yml`

> **Prerequisite:** `UPSTASH_REDIS_REST_URL_EVAL` and `UPSTASH_REDIS_REST_TOKEN_EVAL` must already be set in GitHub repository Settings → Secrets → Actions. Provision the new `erik-portfolio-eval` Upstash database first.

- [ ] **Step 1: Replace the ai-eval job env block**

In `ci.yml`, find the `ai-eval` job's `steps` section and locate the `AI eval suite` step env block (around line 485–489):

```yaml
      - name: AI eval suite
        run: pnpm ask:eval
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY_BUILD }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_BUILD }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_BUILD }}
```

Replace with:

```yaml
      - name: AI eval suite
        run: pnpm ask:eval
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY_BUILD }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_EVAL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_EVAL }}
```

- [ ] **Step 2: Remove the ai-eval concurrency serialization group**

The concurrency group `ai-eval-${{ github.ref }}` serialized runs on the same ref to prevent shared-state interference. With the dedicated Upstash instance, interference is impossible — remove the group. Find and delete these lines in the `ai-eval` job (around line 468–470):

```yaml
    concurrency:
      group: ai-eval-${{ github.ref }}
      cancel-in-progress: true
```

- [ ] **Step 3: Verify the ci.yml change is well-formed**

```bash
pnpm exec js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(ai-eval): isolate to dedicated Upstash instance, remove serialization group"
```

---

### Task 9 (Phase 1 close): Run full local gate and open PR

- [ ] **Step 1: Run ci:local**

```bash
pnpm ci:local 2>&1 | tail -10
```

Expected: all checks pass.

- [ ] **Step 2: Run gates:runtime (reuse build if fresh)**

```bash
pnpm gates:runtime --skip-build 2>&1 | tail -10
```

If `.next/` is stale: `pnpm gates:runtime 2>&1 | tail -10`

Expected: all runtime gates pass.

- [ ] **Step 3: Check pr-size**

```bash
pnpm pr-size 2>&1 | tail -5
```

Expected: green or yellow. If red, split the PR at a logical task boundary.

- [ ] **Step 4: Dispatch the 5-agent review battery (do not skip any agent)**

Dispatch in parallel: `pr-review-toolkit:review-pr`, `accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`. Fix all Critical/Important findings before proceeding.

- [ ] **Step 5: Stamp the review**

```bash
pnpm review:stamp
```

- [ ] **Step 6: Open PR**

```bash
pnpm ready-for-pr
```

Fill every section of `.github/pull_request_template.md`. Run `pnpm validate-pr-body <pr>` after `gh pr create` to confirm all sections present.

---

## Phase 2: CI Hardening

---

### Task 10: Add `.nvmrc`

**Files:**
- Create: `.nvmrc`

- [ ] **Step 1: Create the file**

```bash
echo "22" > .nvmrc
```

- [ ] **Step 2: Verify**

```bash
cat .nvmrc
```

Expected: `22`

- [ ] **Step 3: Commit**

```bash
git add .nvmrc
git commit -m "chore(ci): add .nvmrc to pin Node 22 for local dev parity with CI"
```

---

### Task 11: Fix silent server crash logging in CI

The five jobs that run `pnpm start &` without capturing output are: `performance`, `e2e-functional` (matrix), `e2e-visual-chromium` (matrix), `e2e-visual-webkit` (matrix). All follow the same pattern.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace all "Start preview server" + "Wait for server" step pairs**

Find every occurrence of this two-step block in `ci.yml`:

```yaml
      - name: Start preview server
        run: pnpm start &
        env:
          DEPLOY_SALT: ci-build-salt
      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000
```

Replace each with:

```yaml
      - name: Start preview server
        run: pnpm start > /tmp/server-${{ matrix.project || 'perf' }}.log 2>&1 &
        env:
          DEPLOY_SALT: ci-build-salt
      - name: Wait for server
        run: |
          npx wait-on http://localhost:3000 --timeout 30000 || {
            echo "Server failed to start. Log output:"
            cat /tmp/server-${{ matrix.project || 'perf' }}.log
            exit 1
          }
```

There are **5 occurrences** total across the 4 jobs (performance has no matrix, the others have matrix contexts). The `${{ matrix.project || 'perf' }}` expression ensures a unique log filename per job:
- `performance` job: no matrix, resolves to `server-perf.log`
- `e2e-functional`: resolves to `server-chromium.log`, `server-webkit-desktop.log`, etc.
- `e2e-visual-*`: resolves to `server-chromium.log`, `server-chromium-mobile.log`, etc.

> Note: For the `performance` job there is no matrix context, so use the literal fallback:

In the `performance` job specifically, use:
```yaml
      - name: Start preview server
        run: pnpm start > /tmp/server-perf.log 2>&1 &
        env:
          DEPLOY_SALT: ci-build-salt
      - name: Wait for server
        run: |
          npx wait-on http://localhost:3000 --timeout 30000 || {
            echo "Server failed to start. Log output:"
            cat /tmp/server-perf.log
            exit 1
          }
```

- [ ] **Step 2: Verify YAML syntax**

```bash
pnpm exec js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: capture pnpm start stdout/stderr so server crashes are diagnosable"
```

---

### Task 12: Move `visual.spec.ts` to `tests/visual/` and enable E2E auto-discovery

**Files:**
- Move: `tests/e2e/visual.spec.ts` → `tests/visual/visual.spec.ts`
- Move: `tests/e2e/visual.spec.ts-snapshots/` → `tests/visual/visual.spec.ts-snapshots/`
- Modify: `.github/workflows/ci.yml` — update e2e-visual-* jobs and e2e-functional

**Why:** `tests/e2e/` currently contains both functional specs and the visual spec. Auto-discovering `tests/e2e/` for the functional job would incorrectly run visual regression tests (which have different baseline requirements). Moving the visual spec to its own directory enables clean separation: `tests/e2e/` for functional auto-discovery, `tests/visual/` for visual-only.

- [ ] **Step 1: Create the destination directory and move the spec + snapshots**

```bash
mkdir -p tests/visual
git mv tests/e2e/visual.spec.ts tests/visual/visual.spec.ts
```

Check if the snapshots directory exists:

```bash
ls tests/e2e/visual.spec.ts-snapshots/ 2>/dev/null && echo "snapshots present" || echo "no snapshots dir"
```

If present:

```bash
git mv tests/e2e/visual.spec.ts-snapshots tests/visual/visual.spec.ts-snapshots
```

- [ ] **Step 2: Verify the move**

```bash
ls tests/visual/
```

Expected: `visual.spec.ts` (and `visual.spec.ts-snapshots/` if snapshots existed)

```bash
ls tests/e2e/visual.spec.ts 2>/dev/null && echo "ERROR: file still in old location" || echo "OK: moved"
```

Expected: `OK: moved`

- [ ] **Step 3: Update `e2e-visual-chromium` and `e2e-visual-webkit` jobs in ci.yml**

Find all occurrences of:
```yaml
        run: pnpm playwright test --project=${{ matrix.project }} tests/e2e/visual.spec.ts
```

Replace with:
```yaml
        run: pnpm playwright test --project=${{ matrix.project }} tests/visual/visual.spec.ts
```

Also update the `--update-snapshots` step and the artifact upload path. Find all four occurrences of `tests/e2e/visual.spec.ts` in ci.yml (two per visual job: normal run + baseline regen) and the snapshot artifact path `tests/e2e/visual.spec.ts-snapshots/`. Replace each with `tests/visual/visual.spec.ts` and `tests/visual/visual.spec.ts-snapshots/`.

Full list of lines to update in `e2e-visual-chromium` and `e2e-visual-webkit` jobs:

```yaml
# BEFORE (4 occurrences, 2 per job):
run: pnpm playwright test --project=${{ matrix.project }} tests/e2e/visual.spec.ts
run: pnpm playwright test --project=${{ matrix.project }} tests/e2e/visual.spec.ts --update-snapshots
path: tests/e2e/visual.spec.ts-snapshots/

# AFTER:
run: pnpm playwright test --project=${{ matrix.project }} tests/visual/visual.spec.ts
run: pnpm playwright test --project=${{ matrix.project }} tests/visual/visual.spec.ts --update-snapshots
path: tests/visual/visual.spec.ts-snapshots/
```

- [ ] **Step 4: Update `e2e-functional` job to auto-discover `tests/e2e/`**

Find the `e2e-functional` job's functional run step:

```yaml
      - name: Run functional e2e (tests/e2e specs)
        if: matrix.project != 'chromium-components'
        run: pnpm playwright test --project=${{ matrix.project }} tests/e2e/cross-cutting.spec.ts tests/e2e/observability-smoke.spec.ts
```

Replace with:

```yaml
      - name: Run functional e2e (tests/e2e specs)
        if: matrix.project != 'chromium-components'
        run: pnpm playwright test --project=${{ matrix.project }} tests/e2e/
```

- [ ] **Step 5: Verify YAML**

```bash
pnpm exec js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 6: Run functional E2E locally to confirm auto-discovery picks up all specs**

```bash
pnpm dev &
npx wait-on http://localhost:3000 --timeout 30000
pnpm playwright test --project=chromium tests/e2e/ --list 2>&1 | grep "spec.ts" | sort
```

Expected: shows `cross-cutting.spec.ts` and `observability-smoke.spec.ts` — but NOT `visual.spec.ts`.

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add tests/visual/ tests/e2e/ .github/workflows/ci.yml
git commit -m "ci(e2e): move visual.spec.ts to tests/visual/, enable tests/e2e/ auto-discovery"
```

---

### Task 13: SHA-pin GitHub Actions

**Files:**
- Modify: `.github/dependabot.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/mutation.yml`

- [ ] **Step 1: Add `pin-digests: true` to dependabot.yml**

Open `.github/dependabot.yml`. Find the `github-actions` ecosystem entry and add `pin-digests: true`:

```yaml
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    pin-digests: true
    groups:
      actions:
        patterns:
          - '*'
```

- [ ] **Step 2: Install and run pinact to convert existing `@vN` tags to SHA digests**

```bash
npx --yes pinact run
```

This modifies `ci.yml`, `codeql.yml`, and `mutation.yml` in place, converting e.g. `actions/checkout@v6` to `actions/checkout@<sha> # v6.x.x`.

- [ ] **Step 3: Verify each workflow still has the expected action names (not accidentally blanked)**

```bash
grep -c "uses:" .github/workflows/ci.yml
grep -c "sha256\|[a-f0-9]\{40\}" .github/workflows/ci.yml
```

Expected: at least as many SHA hashes as `uses:` lines (roughly equal counts).

- [ ] **Step 4: Verify YAML syntax on all three workflow files**

```bash
for f in .github/workflows/ci.yml .github/workflows/codeql.yml .github/workflows/mutation.yml; do
  pnpm exec js-yaml "$f" > /dev/null && echo "OK: $f" || echo "ERROR: $f"
done
```

Expected: all three print `OK`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/codeql.yml .github/workflows/mutation.yml .github/dependabot.yml
git commit -m "ci(security): SHA-pin all GitHub Actions, add pin-digests to dependabot"
```

---

### Task 14 (Phase 2 close): Run full local gate and open PR

- [ ] **Step 1: Run ci:local**

```bash
pnpm ci:local 2>&1 | tail -10
```

Expected: all checks pass.

- [ ] **Step 2: Run gates:runtime**

```bash
pnpm gates:runtime 2>&1 | tail -10
```

Expected: all runtime gates pass.

- [ ] **Step 3: Check pr-size**

```bash
pnpm pr-size 2>&1 | tail -5
```

- [ ] **Step 4: Dispatch 5-agent review battery**

Dispatch in parallel: `pr-review-toolkit:review-pr`, `accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`. Fix all Critical/Important findings.

- [ ] **Step 5: Stamp and open PR**

```bash
pnpm review:stamp
pnpm ready-for-pr
```

Fill the PR template. Run `pnpm validate-pr-body <pr>` after creating.

---

## Self-Review Checklist

- [x] **1.1 `/api/healthz`** — Tasks 1 + 2 + 3 cover route, unit tests, E2E
- [x] **1.2 Post-deploy smoke** — Task 6
- [x] **1.3 Rollback runbook** — Task 7
- [x] **1.4 Vercel notifications** — Task 7 Step 4 (manual)
- [x] **1.5 ai-eval Upstash isolation** — Task 8
- [x] **1.6 PSI cron alerting** — Tasks 4 + 5
- [x] **2.1 SHA-pinned actions** — Task 13
- [x] **2.2 .nvmrc** — Task 10
- [x] **2.3 Function coverage** — Already `functions: 80` in vitest.config.ts; no action needed
- [x] **2.4 Server crash logging** — Task 11
- [x] **2.5 E2E auto-discovery** — Task 12
