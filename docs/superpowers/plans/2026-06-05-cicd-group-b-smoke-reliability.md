# Implementation Plan: CI/CD Group B — Smoke / Reliability Hardening

**Spec:** `docs/superpowers/specs/2026-06-05-cicd-group-b-smoke-reliability-design.md`
**Branch:** `ci/smoke-reliability`
**Goal:** Close 4 post-deploy blind spots: `/api/ask` and `/api/contact` liveness, 503 alert when Redis is degraded, and a SHA audit trail in the job summary.
**Estimated effort:** ~1.5 hours
**PR size:** Single PR, 1 file changed (`.github/workflows/smoke.yml`), ~80-100 lines added

---

## Architecture

All 4 changes are in `.github/workflows/smoke.yml` only. No production code changes. No new secrets required (`RESEND_API_KEY` already exists as a repo secret).

**Step execution order in the smoke job (after B changes):**
1. Existing: set `CANONICAL_HOST` env var
2. Existing: Artifact healthz probe
3. Existing: Canonical healthz probe (B3 modifies this step to add 503 alert)
4. Existing: 7 security headers check
5. Existing: Apex → www redirect chain
6. **NEW B1:** `/api/ask` smoke probe
7. **NEW B2:** `/api/contact` smoke probe
8. **NEW B4:** Record deployed SHA in job summary (`if: always()`)

**Security constraints (must be enforced throughout):**
- NEVER add `set -x` to any step that handles `RESEND_API_KEY` or `BYPASS` secrets — tracing prints secrets to public CI logs.
- Validate `CANONICAL_HOST` is the expected canonical host before using in curl commands (already set by the existing workflow env block).

---

## Pre-flight

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/smoke-reliability
  ```

- [ ] **Read `.github/workflows/smoke.yml`** to understand the current step order, the `CANONICAL_HOST` env var setup, and the existing canonical healthz step structure. Identify the exact step after which B1 and B2 go.

- [ ] **Verify `RESEND_API_KEY` exists as a repo secret** (it should — the contact form uses it):
  ```bash
  gh secret list | grep RESEND_API_KEY
  # Expected: RESEND_API_KEY   (date)
  ```

---

## B1 — API smoke: /api/ask

- [ ] **Edit `.github/workflows/smoke.yml`** — add this step after `Homepage promotes via apex->www to 200` (the existing apex redirect step):

  ```yaml
  - name: API smoke - /api/ask (route alive, returns non-5xx)
    # WHY POST with empty body: a GET/HEAD on a POST-only route returns 405, not
    # useful for liveness. An empty POST hits the validation layer and returns 400
    # (invalid request schema) — confirms the route is alive, validating, and not
    # erroring at 500. The probe NEVER sends a real question to the AI Gateway
    # (validation rejects before reaching the AI call).
    # WHY no auth bypass header: /api/ask is served on the canonical public domain,
    # not the protected *.vercel.app artifact — no bypass needed.
    # KNOWN FAILURE MODE: when ASK_ENABLED=off, the route returns 503, which IS
    # >= 500 and WILL exit 1. A kill-switch deployment must either re-enable ASK
    # or remove this probe step before deploying. This is intentional — a disabled
    # route is a smoke failure for operator awareness.
    run: |
      http_code=$(curl --max-time 30 --retry 2 --retry-connrefused --silent \
        --request POST \
        --header "Content-Type: application/json" \
        --data '{}' \
        --output /dev/null \
        --write-out "%{http_code}" \
        "${CANONICAL_HOST}/api/ask")
      echo "API smoke /api/ask status: $http_code"
      if [ "$http_code" -ge 500 ] 2>/dev/null; then
        echo "ERROR: /api/ask returned $http_code (5xx = route error, not validation rejection)"
        exit 1
      fi
      echo "OK: /api/ask responded with $http_code (non-5xx confirms route is alive)"
  ```

  **Design decisions captured in comments:**
  - POST `{}` not HEAD: HEAD returns 405 (method not allowed), which gives no health signal.
  - Asserts `< 500` not `== 400`: validation response may be 400 or 422; we need non-5xx, not exact code.
  - No AI Gateway credits consumed: validation rejects before the AI call path.
  - `--retry 2 --retry-connrefused`: tolerates Vercel cold-start connection blips.

---

## B2 — API smoke: /api/contact

- [ ] **Edit `.github/workflows/smoke.yml`** — add this step immediately after the B1 step:

  ```yaml
  - name: API smoke - /api/contact (route alive, returns non-5xx)
    # WHY POST with empty body: /api/contact uses defineHandler + Zod schema.
    # An empty POST returns 400 (validation failure on required fields: name, email,
    # message). This confirms the route is alive and not erroring at 500.
    # A real contact form submission is NOT sent — validation rejects before Resend.
    # RESEND_API_KEY is not needed for this probe — it is not accessed.
    run: |
      http_code=$(curl --max-time 30 --retry 2 --retry-connrefused --silent \
        --request POST \
        --header "Content-Type: application/json" \
        --data '{}' \
        --output /dev/null \
        --write-out "%{http_code}" \
        "${CANONICAL_HOST}/api/contact")
      echo "API smoke /api/contact status: $http_code"
      if [ "$http_code" -ge 500 ] 2>/dev/null; then
        echo "ERROR: /api/contact returned $http_code (5xx = route error, not validation rejection)"
        exit 1
      fi
      echo "OK: /api/contact responded with $http_code (non-5xx confirms route is alive)"
  ```

---

## B3 — 503 alert email when healthz is degraded

- [ ] **Read the existing `Health check - canonical /api/healthz never 308` step** in `smoke.yml` to understand its current structure before modifying it.

- [ ] **Replace the existing canonical healthz step** with this expanded version. Key changes:
  - Add `env: RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}`
  - Capture `http_code` with `--write-out "%{http_code}"` pattern (match B1/B2 style)
  - Keep exit 0 on 503 (monitoring degradation, not a deploy failure)
  - Add conditional alert email block when `http_code == 503`

  ```yaml
  - name: Health check - canonical /api/healthz never 308 (200 ok or 503 degraded)
    env:
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
    run: |
      http_code=$(curl --max-time 30 --retry 2 --retry-connrefused --silent \
        --head \
        --output /dev/null \
        --write-out "%{http_code}" \
        "${CANONICAL_HOST}/api/healthz")
      echo "Canonical health check status: $http_code ($CANONICAL_HOST/api/healthz)"
      if [ "$http_code" = "308" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
        echo "ERROR: /api/healthz redirected ($http_code) - trailing-slash/canonical regression"
        exit 1
      fi
      if [ "$http_code" != "200" ] && [ "$http_code" != "503" ]; then
        echo "ERROR: canonical /api/healthz returned $http_code (expected 200 or 503)"
        exit 1
      fi
      if [ "$http_code" = "503" ]; then
        echo "WARNING: healthz returned 503 (degraded) — Redis may be unavailable. Sending alert."
        if [ -n "$RESEND_API_KEY" ]; then
          curl --max-time 15 --silent \
            --request POST \
            --url "https://api.resend.com/emails" \
            --header "Authorization: Bearer $RESEND_API_KEY" \
            --header "Content-Type: application/json" \
            --data "{
              \"from\": \"monitor@erikunha.dev\",
              \"to\": [\"erikhunha@gmail.com\"],
              \"subject\": \"[erikunha.dev] healthz 503 — Redis degraded post-deploy\",
              \"text\": \"Post-deploy smoke detected healthz 503 at ${CANONICAL_HOST}/api/healthz. Possible cause: Upstash Redis unavailable. Consequences: rate-limiting fails open, budget enforcement fails open, PSI cron writes fail. Check Upstash dashboard. If Redis is healthy, check UPSTASH_REDIS_REST_URL env var in Vercel. This is not a deploy failure - the site is serving. It is a monitoring degradation.\"
            }" || echo "WARNING: could not send alert email (Resend call failed)"
        else
          echo "WARNING: RESEND_API_KEY not set — cannot send alert email. Check repo secrets."
        fi
      fi
  ```

  **Critical constraints:**
  - NO `set -x` anywhere in this step — the step handles `RESEND_API_KEY` and tracing would print it to public logs.
  - Exit 0 on 503 is PRESERVED. The smoke run must not fail on 503 — the site is live; only Redis is degraded.
  - Alert is best-effort (`|| echo "WARNING: ..."`) — if Resend call fails, the smoke step still exits 0.
  - `from: "monitor@erikunha.dev"`: `erikunha.dev` is the verified Resend domain. This is a legitimate monitoring address. Fallback: `contact@erikunha.dev` (same domain, already used by the contact route).

---

## B4 — Log deployed SHA to job summary

- [ ] **Edit `.github/workflows/smoke.yml`** — add this step at the END of the `smoke` job, after B1 and B2:

  ```yaml
  - name: Record deployed SHA in job summary
    if: always()
    run: |
      sha=$(curl --max-time 15 --silent \
        "${CANONICAL_HOST}/api/healthz" \
        | node -e "
          let d='';
          process.stdin.on('data',c=>d+=c);
          process.stdin.on('end',()=>{
            try { process.stdout.write(JSON.parse(d).sha ?? 'unknown'); }
            catch { process.stdout.write('parse-error'); }
          });
        " 2>/dev/null || echo "unavailable")
      {
        echo "## Production Deploy Verified"
        echo ""
        echo "**SHA:** \`${sha}\`"
        echo "**Host:** ${CANONICAL_HOST}"
        echo "**Triggered by:** deployment_status event"
      } >> "$GITHUB_STEP_SUMMARY"
  ```

  **Design decisions:**
  - `if: always()`: records the SHA even when other smoke steps fail — useful for post-incident correlation ("what was live when the smoke failed?").
  - `node` not `jq`: avoids a `jq` dependency check; `node` is always available on `ubuntu-latest`.
  - Graceful failure: if healthz returns 503, the JSON body still contains `sha` (healthz returns the SHA regardless of Redis availability). If curl fails entirely, `sha=unavailable` is recorded.

---

## Verification (Manual Test)

- [ ] **Verify YAML syntax:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/smoke.yml').read()); print('valid')"
  # Expected: valid
  ```

- [ ] **Manual curl test for B1 and B2** against production (to confirm expected 400 response before deploying):
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    https://erikunha.dev/api/ask
  # Expected: 400 (validation rejection — route is alive)

  curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    https://erikunha.dev/api/contact
  # Expected: 400 (validation rejection — route is alive)
  ```

- [ ] **Manual curl test for B4** — confirm `/api/healthz` returns SHA:
  ```bash
  curl -s https://erikunha.dev/api/healthz | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{console.log(JSON.parse(d).sha)}catch{console.log('parse-error')} })"
  # Expected: a git SHA string
  ```

---

## Commit

- [ ] **Run local lint gates:**
  ```bash
  pnpm check 2>&1 | tail -10
  # Expected: no errors (YAML files are not checked by Biome, but run anyway to catch anything)
  pnpm ci:local 2>&1 | tail -10
  # Expected: all pass
  ```

- [ ] **Commit:**
  ```bash
  git add .github/workflows/smoke.yml
  git commit -m "ci(smoke): add API probes, 503 Redis alert, and SHA job summary"
  ```

---

## Verification After Merge

The smoke workflow only triggers on `deployment_status` events (production deploys) and `workflow_dispatch`. After merging:

- [ ] **Trigger smoke via workflow_dispatch:** GitHub Actions → smoke.yml → Run workflow. Point it at the current production URL.
- [ ] **B1 confirmed:** Step `API smoke - /api/ask` appears in the run and exits with "OK: /api/ask responded with 400".
- [ ] **B2 confirmed:** Step `API smoke - /api/contact` appears and exits with "OK: /api/contact responded with 400".
- [ ] **B3 confirmed (healthy path):** When healthz returns 200, no alert email is sent.
- [ ] **B4 confirmed:** Job summary tab shows `## Production Deploy Verified` with a valid git SHA.

---

## Failure Modes Checklist

| Risk | Mitigation |
|---|---|
| `ASK_ENABLED=off` kill-switch → probe exits 1 | Documented in step comment. Operator must re-enable or remove probe step before a kill-switch deploy. |
| `monitor@erikunha.dev` blocked by Resend | Fall back to `contact@erikunha.dev` (same verified domain). Change the `from` field. |
| `set -x` added to healthz step in a future edit | Comment in the step warns; STANDARDS.md Chapter 9 applies. |
| Alert fatigue during Upstash maintenance windows | Acceptable at solo-developer scale — 503 is worth knowing about. |
| Resend API down during a 503 event | Alert is best-effort (`||` fallback). Smoke step still exits 0. |
