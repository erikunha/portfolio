---

paths:
- "app/api/**"
- "lib/rate-limit.ts"
- "lib/server/**"
- "proxy.ts"

---

# API & server boundary rules

Path-scoped: loads only when working on API/server files. Full rationale in
`STANDARDS.md` Ch.2 (API & Server Boundary) and Ch.9 (Security & Privacy). The
merge-blocking check on this surface is the behavioral test suite (the required
`test` job); this file is the implementation guidance, not the enforcement.

## Handler contract

- Route handlers go through `defineHandler`, which enforces the response
  envelope and the fixed order: **rate-limit → bounded body read → parse →
  validate → handle** (`maxBodyBytes` is required). Do not reorder; the order is
  a security property (reject before reading or parsing untrusted input). A
  route outside `defineHandler` reads through `readBoundedBody` after its own
  limiter, and defers settlement or logging to `afterResponse`, never to work
  that runs after the stream closes. Held by behavioral tests + e2e, not source-grep.
- Read env only through the Zod accessor `lib/env.ts`. Never read
  `process.env.*` directly in a handler.
- Rate limiting is Upstash sliding-window via `lib/rate-limit.ts` and is
  **fail-open** (Redis down must not 500 the user). Keep that property. The
  `/api/ask` budget reservation is the exception: it fails closed with 503.

## Security surface

- The behavioral tests are the only merge-blocking check on this surface for a finding. Semgrep (`pnpm lint:semgrep`,
  report-only in CI) and CodeQL findings block nothing; only Semgrep's fixture self-test and false-positive baseline can fail a run. Editing `app/api/**`, `lib/rate-limit.ts`, or `proxy.ts` means
  re-reading the diff for the abuse paths each of them closes.
- CSP and `Reporting-Endpoints` headers come from **`proxy.ts`**, not
  `next.config.ts` (which sets the static headers: COOP, X-Frame-Options, HSTS,
  etc.). `__tests__/proxy-csp.test.ts` holds the CSP posture; the deploy smoke test
  checks that the headers arrive on the live host.

## The `/api/ask` AI feature

- Single model source of truth: `lib/ask/model.ts` (`ASK_MODEL` =
  `anthropic/claude-haiku-5.5`); the eval harness imports the same const so it
  grades the shipped model. Do not hardcode a model string in the route.
- Ephemeral prompt cache via `providerOptions.anthropic.cacheControl` on the
  system `instructions`; output capped (`ASK_MAX_OUTPUT_TOKENS`), request-timeout guarded;
  no sampling parameters (Haiku 5.5 rejects them) and thinking disabled.
- Changes to the ask corpus, calibration, system prompt or the facts it renders
  (`content/ask-facts.ts`) require `pnpm ask:eval`.
