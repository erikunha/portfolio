# CI/CD Reliability Hardening — Design Spec

**Date:** 2026-06-03
**Scope:** Addresses all Critical/High/Medium findings from the Staff+ DevOps audit.
**Deliverable:** Two implementation phases shipped as separate PRs.

---

## Background

A Principal/Staff+ CI/CD audit of erikunha.dev surfaced the following priority findings:

| ID | Severity | Finding |
|---|---|---|
| R1 | Critical | No rollback procedure documented or automated |
| R2 | High | No production error alerting |
| R3 | High | ai-eval CI gate shares Upstash state across concurrent PRs (flaky blocking gate) |
| O2 | High | Vercel cron (/api/psi-refresh) failures are invisible |
| M2 | Medium | `pnpm start &` in CI captures no stdout/stderr — server crash is silent |
| M1 | Medium | E2E test file list is hardcoded; new spec files silently skip |
| S1 | Medium | GitHub Actions not SHA-pinned (supply-chain risk) |
| O4 | Medium | Function coverage threshold not enforced |
| D4 | Low | No `.nvmrc` — local Node version parity with CI not enforced |

---

## Phase 1: Operational Reliability

### 1.1 `/api/healthz` endpoint

**New file:** `app/api/healthz/route.ts` (Node runtime, not Edge)

Returns JSON:
```json
{
  "status": "ok",
  "sha": "abc1234",
  "deployedAt": "2026-06-03T03:00:00Z",
  "psiLastRun": "2026-06-03T03:05:00Z"
}
```

- `sha` — `process.env.VERCEL_GIT_COMMIT_SHA` (injected by Vercel)
- `deployedAt` — `process.env.VERCEL_GIT_COMMIT_DATE` (injected by Vercel)
- `psiLastRun` — Upstash key `meta:psi-last-run` (set by psi-refresh cron on success)
- HTTP 200 on healthy; HTTP 503 with `status: "degraded"` if Upstash read throws
- Public endpoint, no auth, no rate limiting (low-frequency callers only)
- Must be excluded from the axe-core a11y scan (not a UI route)

**Test coverage:**
- Unit: mock Upstash + Vercel env vars; assert response shape for healthy and degraded states
- E2E: `observability-smoke.spec.ts` asserts `GET /api/healthz` returns 200 with `status: "ok"`

### 1.2 Post-deploy smoke test

**New file:** `.github/workflows/smoke.yml`

**Trigger:** `deployment_status` event (Vercel creates GitHub Deployment objects on every push to main; the `success` state fires this event automatically — no Vercel webhook configuration needed)

**Job condition:**
```yaml
if: github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Production'
```

**Steps:**
1. `curl --fail --max-time 30 https://erikunha.dev/api/healthz` — asserts 200
2. `curl --fail --max-time 30 https://erikunha.dev` — asserts homepage responds
3. On failure: emit a GitHub Actions annotation with the failed URL and response

**Permissions:** `deployments: read` — the workflow's pass/fail status automatically becomes a commit check via the `deployment_status` event; no `statuses: write` needed.

**Notes:**
- Non-blocking (informational check) — does not gate the deploy itself
- Result appears as a commit check in the GitHub PR/commit status panel
- Timeout: 5 minutes

### 1.3 Rollback runbook

**Edit:** `CLAUDE.md` — add an "Emergency Rollback" section under the deployment workflow:

```markdown
## Emergency Rollback

Fast path (30s):
  Vercel Dashboard → Project → Deployments → click prior deployment → Promote to Production

Slow path (5 min):
  git revert HEAD && git push

Verify: curl https://erikunha.dev/api/healthz | jq .sha
```

### 1.4 Vercel deploy notifications

**Config-only (no code):** Vercel Dashboard → Project Settings → Notifications → enable deploy success/failure email alerts.

Document in `DECISIONS.md` with the date and the specific setting path so it survives team onboarding.

### 1.5 ai-eval dedicated Upstash instance

**Problem:** The `ai-eval` job mutates rate-limit and budget counters on the same `*_BUILD` Upstash instance used by the build job. Two concurrent PR runs share these counters, causing non-deterministic 429s and a >25% error-rate that trips the `ERRORED_FRACTION_LIMIT` gate, producing a flaky required CI gate.

**Fix:** Provision a second Upstash Redis database dedicated to the eval harness. Name it `erik-portfolio-eval`.

**New secrets (to add in GitHub repository settings):**
- `UPSTASH_REDIS_REST_URL_EVAL`
- `UPSTASH_REDIS_REST_TOKEN_EVAL`

**Change in `ci.yml` — `ai-eval` job env block:**
```yaml
env:
  AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY_BUILD }}
  UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_EVAL }}
  UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_EVAL }}
```

The `ai-eval` job drops its concurrency serialization group — it is no longer needed since the eval Upstash is now isolated.

**Rate-limit note:** The eval Upstash free tier starts with empty counters. Each run uses synthetic per-item IPs (`clientIpForItem`), so counters accumulate across runs. The `meta:deploy-salt` and `ask:eval:latest` keys are also now isolated to the eval instance — no cross-contamination with build-time Redis ops.

### 1.6 PSI cron staleness alerting

**Edit:** `app/api/psi-refresh/route.ts`

On success: write `await redis.set('meta:psi-last-run', new Date().toISOString())`

On unhandled exception (catch block before re-throwing):
```ts
await resend.emails.send({
  from: 'alerts@erikunha.dev',
  to: 'erikhunha@gmail.com',
  subject: '[portfolio] psi-refresh cron failed',
  text: `Error: ${err.message}\nTimestamp: ${new Date().toISOString()}`,
});
```

The `CRON_SECRET` auth check already gates the route — no auth changes needed.

**Env var needed:** `RESEND_API_KEY` is already in production. No new secrets.

**Test coverage:**
- Unit: mock `resend.emails.send` and assert it is called when the PSI fetch throws; assert it is NOT called on success
- Unit: assert `meta:psi-last-run` is set on success

---

## Phase 2: CI Hardening

### 2.1 SHA-pin all GitHub Actions

**Edit:** `.github/dependabot.yml` — add `groups` block with `pin-digests: true` to the `github-actions` ecosystem entry.

**One-time migration:** Run `npx pinact` (or equivalent) to replace `@v6` tags with full SHAs + inline comments (`# v6.x.x`) in all three workflow files. Dependabot will keep them updated from that point forward.

Files affected: `ci.yml`, `codeql.yml`, `mutation.yml`

### 2.2 `.nvmrc` for Node 22

**New file:** `.nvmrc` containing `22`

Enforces local version parity with CI (`setup-node: node-version: 22`). Works with nvm, fnm, and Volta.

### 2.3 Function coverage threshold

**Edit:** `vitest.config.ts` — add `functions: 70` to the coverage `thresholds` block alongside the existing `lines: 80`, `branches: 70`, `statements: 80`.

### 2.4 Fix silent server crash in CI

**Edit:** All five CI jobs that run `pnpm start &` (`performance`, `e2e-functional` × matrix, `e2e-visual-chromium` × matrix, `e2e-visual-webkit` × matrix):

```yaml
- name: Start preview server
  run: pnpm start > /tmp/server-${{ matrix.project || 'default' }}.log 2>&1 &

- name: Wait for server
  run: |
    npx wait-on http://localhost:3000 --timeout 30000 || {
      echo "Server failed to start. Log:"
      cat /tmp/server-${{ matrix.project || 'default' }}.log
      exit 1
    }
```

### 2.5 E2E test file auto-discovery

**Problem:** The `e2e-functional` job hardcodes `tests/e2e/cross-cutting.spec.ts tests/e2e/observability-smoke.spec.ts`. New spec files added to `tests/e2e/` silently skip CI.

**Root cause:** `tests/e2e/visual.spec.ts` lives in the same directory, so auto-discovering `tests/e2e/` would pull in visual tests into the functional job.

**Fix:** Move `tests/visual/` out of `tests/e2e/`:
- `tests/e2e/visual.spec.ts` → `tests/visual/visual.spec.ts`
- Update `e2e-visual-chromium` and `e2e-visual-webkit` jobs to reference `tests/visual/visual.spec.ts`
- Update `e2e-functional` job to auto-discover: `pnpm playwright test --project=${{ matrix.project }} tests/e2e/`
- `git mv tests/e2e/visual.spec.ts-snapshots/ tests/visual/visual.spec.ts-snapshots/` alongside the spec file move — Playwright resolves snapshot dirs relative to the spec file location, so the directory must move with it

**Test impact:** Zero behavioral change. Snapshot baselines stay in `tests/e2e/visual.spec.ts-snapshots/` — the rename requires updating the snapshot directory path in `playwright.config.ts` to `tests/visual/visual.spec.ts-snapshots/`.

---

## PR Strategy

| PR | Content | Base | Size estimate |
|---|---|---|---|
| `ci/phase-1-operational-reliability` | Sections 1.1–1.6 | `main` | Medium (new route, new workflow, ci.yml edit, psi-refresh edit) |
| `ci/phase-2-ci-hardening` | Sections 2.1–2.5 | `main` | Small (config files, vitest, ci.yml edits) |

Phase 2 does not depend on Phase 1. Both PRs can be opened and reviewed in parallel. Phase 1 requires provisioning the new Upstash eval database and adding the two new GitHub secrets before the PR passes CI.

---

## Secrets to provision before Phase 1 CI can pass

| Secret | Where | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL_EVAL` | GitHub repo secrets | New dedicated eval Upstash instance |
| `UPSTASH_REDIS_REST_TOKEN_EVAL` | GitHub repo secrets | New dedicated eval Upstash instance |

Vercel deploy notifications (Section 1.4) require a manual toggle in the Vercel dashboard — no secrets.

---

## Out of scope (conscious deferrals)

| Item | Reason |
|---|---|
| Canary / staged deployment | Over-engineered for solo portfolio site at current traffic |
| Distributed tracing (`@vercel/otel`) | Justified only when API surface grows beyond current 3 routes |
| UptimeRobot external monitor | The smoke test (1.2) plus healthz (1.1) cover the monitoring need; a separate external monitor is redundant at this scale |
| TypeScript 6 version pin | Tracked in DECISIONS.md; deliberate upgrade path, not a regression |
| PSI API key application restrictions | Google PSI API requires unrestricted keys for server-side fetches; no fix available |
| Mutation score trend tracking | Nice-to-have; not a reliability risk |

---

## Success criteria

- `pnpm ci:local` + `pnpm gates:runtime` green on both PRs before open
- Phase 1: `GET /api/healthz` returns 200 with correct `sha` field on production after merge
- Phase 1: smoke.yml fires after next push to main and appears as a green commit check
- Phase 1: ai-eval job in two simultaneous PRs does not produce >25% errored items
- Phase 2: Adding a new `tests/e2e/foo.spec.ts` file is picked up by CI without any workflow edit
- Phase 2: `pnpm test:coverage` fails if function coverage drops below 70%
