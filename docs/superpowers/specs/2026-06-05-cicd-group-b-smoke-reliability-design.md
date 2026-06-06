# CI/CD Group B — Smoke / Reliability Hardening

**Date:** 2026-06-05
**Status:** Approved for implementation
**PR size:** Single PR, ~1.5 hours total effort
**Branch:** `ci/smoke-reliability`

---

## Problem

`smoke.yml` runs after every successful Vercel Production deployment. It checks:
- Artifact healthz probe (200 or 503)
- Canonical healthz probe (200 or 503, no redirects)
- 7 security headers on canonical homepage
- Apex → www redirect chain

It does NOT check:
1. **`/api/ask` is live** — a broken streaming endpoint is discovered by the first real user
   after deploy. Mean time to detect: hours.
2. **`/api/contact` is live** — same gap. Contact form silently fails if the route 500s.
3. **Sustained healthz 503 generates no alert** — `smoke.yml` accepts 503 as a valid result
   ("monitoring concern, not a deploy failure"). When Upstash Redis is down, rate-limiting
   fails open, budget enforcement fails open, and the operator is not notified until the
   next deploy triggers another smoke run. Mean time to detect: next deployment.
4. **The deployed SHA is not recorded** — no persistent audit trail of which git SHA was
   verified in production at any given deploy. Useful for post-incident correlation.

---

## Design

All changes are in a single file: `.github/workflows/smoke.yml`.

### B1 — API smoke: /api/ask

Add a new step after `Homepage promotes via apex->www to 200`:

```yaml
- name: API smoke - /api/ask (route alive, returns non-5xx)
  # WHY POST with empty body: a GET/HEAD on a POST-only route returns 405, not
  # useful for liveness. An empty POST hits the validation layer and returns 400
  # (invalid request schema) — confirms the route is alive, validating, and not
  # erroring at 500. The probe NEVER sends a real question to the AI Gateway
  # (validation rejects before reaching the AI call).
  # WHY no auth bypass header: /api/ask is served on the canonical public domain,
  # not the protected *.vercel.app artifact — no bypass needed.
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

**Design decisions:**
- **POST `{}` not HEAD:** `/api/ask` is defined as a `POST` handler. A HEAD request would return
  405 (method not allowed), which is technically non-5xx but gives no signal on route health.
  Posting an empty body reaches the request-validation layer and returns 400, which confirms
  the route is alive, parsing requests, and not erroring internally.
- **Asserts `< 500`, not `== 400`:** The validation response code may be 400 or 422 depending
  on the schema (Zod errors through `defineHandler` return 400 with an error envelope). We
  don't need to pin the exact validation code — we need to confirm no 500.
- **No AI Gateway credits consumed:** The validation layer rejects before the AI call path.
  Cost: $0.
- **`--retry 2 --retry-connrefused`:** tolerates Vercel cold-start connection blips.

### B2 — API smoke: /api/contact

Add a new step after the `/api/ask` step:

```yaml
- name: API smoke - /api/contact (route alive, returns non-5xx)
  # WHY POST with minimal body: /api/contact uses defineHandler + Zod schema.
  # An empty POST returns 400 (validation failure on required fields: name, email,
  # message). This confirms the route is alive and not erroring at 500.
  # A real contact form submission is NOT sent — validation rejects before Resend.
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

**Design decisions:** Same as B1. Resend is never called (validation rejects first). The
`RESEND_API_KEY` secret is not needed for this probe. No email is sent.

### B3 — 503 alert email when healthz is degraded

Modify the existing `Health check - canonical /api/healthz never 308` step to capture the
HTTP code AND emit an alert email when 503.

The step currently exits 0 on both 200 and 503. We add a conditional alert block after the
existing status check:

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

**Design decisions:**
- **Exit 0 on 503:** preserved. A 503 healthz is a monitoring degradation, not a deploy
  failure. The deployment is live; the Redis dependency is degraded. Failing the smoke run
  would block future deployments, which is the wrong response.
- **Alert is best-effort:** `|| echo "WARNING: ..."` — if the Resend call fails (API down,
  bad key), the smoke step still exits 0. The alert is additive; it must not become a new
  failure mode.
- **`RESEND_API_KEY` is a repo secret:** already provisioned for `/api/contact` runtime
  delivery. No new secrets required.
- **`from: "monitor@erikunha.dev"`:** Resend requires the sender domain to be verified.
  `erikunha.dev` is already verified in Resend (it's the production domain). This is a
  legitimate monitoring address on the verified domain.
- **NEVER `set -x`:** the step handles `RESEND_API_KEY` — tracing would print it to public
  CI logs. The existing smoke.yml convention (documented in the bypass-secret step) applies here.

### B4 — Log deployed SHA to job summary

Add a new step at the end of the `smoke` job:

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
- `if: always()` — records the SHA even when other smoke steps fail, useful for post-incident
  correlation ("what was live when the smoke failed?").
- Uses `node` (available on ubuntu-latest) to parse JSON from stdin — avoids `jq` dependency
  check and matches the pattern used in `mutation.yml` summary step.
- Fails gracefully: if healthz is 503, the JSON body still contains `sha` (the healthz route
  returns the SHA regardless of Redis availability). If the curl fails, `sha=unavailable` is
  recorded without blocking the step.

---

## Files Changed

| File | Change type | Change |
|---|---|---|
| `.github/workflows/smoke.yml` | Edit | Add `/api/ask` smoke step |
| `.github/workflows/smoke.yml` | Edit | Add `/api/contact` smoke step |
| `.github/workflows/smoke.yml` | Edit | Add 503-alert block to canonical healthz step |
| `.github/workflows/smoke.yml` | Edit | Add SHA-to-summary final step |

---

## Verification

After merging, trigger a production deploy (push to main or re-run the smoke workflow via
`workflow_dispatch` after pointing it at a known good deployment):

1. **API smoke steps:** confirm `/api/ask` and `/api/contact` steps appear and exit 0.
   Expected output: "API smoke /api/ask status: 400" and "OK: /api/ask responded with 400".
2. **503 alert:** with Redis healthy (200 healthz), confirm no alert email. To test the alert
   path locally: set `CANONICAL_HOST` to a local URL that returns 503 and run the curl command
   manually — verify the Resend call is formed correctly without actually deploying.
3. **SHA summary:** in the smoke job summary tab, confirm "Production Deploy Verified" section
   appears with the correct git SHA.

---

## Risk

- **Resend `from` domain:** `monitor@erikunha.dev` is on the verified `erikunha.dev` domain
  (Resend verifies at domain level). The contact route already sends from `contact@erikunha.dev`
  on the same domain (`app/api/contact/route.ts:102` hardcodes that address — there is no
  `RESEND_FROM` env var). If `monitor@erikunha.dev` is blocked, fall back to
  `contact@erikunha.dev`.
- **`/api/ask` kill-switch returns 503, not 400:** when `ASK_ENABLED=off`, the ask route
  returns 503 (`route.ts:131-135`). The probe's `>= 500` assertion will therefore EXIT 1
  on a deliberate kill-switch deployment. Decision: accept this behavior — a disabled route
  IS a smoke failure; operators should re-enable or remove the probe step before deploying
  with `ASK_ENABLED=off`. This must be called out as a known failure mode in the plan and
  the plan task must document the deliberate choice.
- **Alert fatigue:** if Redis becomes intermittently unavailable (Upstash maintenance windows),
  every deploy during that window sends an alert. Acceptable at solo-developer scale — the
  monitoring degradation IS worth knowing about.
