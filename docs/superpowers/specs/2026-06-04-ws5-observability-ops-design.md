> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS5 Observability and Ops Truth
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 8 of 8
> Delivery: standalone PR to main
> Depends on: WS2 (experimental_telemetry enabled on streamText in app/api/ask/route.ts)

---

## Context

Three gaps identified in the 2026-06-04 platform audit, all in the ops and
observability layer:

1. **healthz returns 308 in production.** `curl https://erikunha.dev/api/healthz`
   returns HTTP 308, not 200 or 503. The handler at `app/api/healthz/route.ts`
   never issues a redirect; the redirect originates at the Vercel routing layer
   before the handler is invoked.

2. **Post-deploy smoke exercises the deployment artifact URL, not the canonical
   production domain.** The current `smoke.yml` uses
   `${{ github.event.deployment_status.target_url }}` (a `*.vercel.app` URL) for
   the healthz check. That probes the artifact, which is correct during
   propagation. The canonical domain `https://erikunha.dev` is only used for the
   homepage step. Retargeting the healthz step to the canonical URL catches the
   308 class of routing issue that the artifact URL may mask (artifact URLs
   sometimes bypass CDN redirect rules).

3. **AI telemetry from WS2 has no dedicated visibility surface.** `streamText`
   in `app/api/ask/route.ts` will gain `experimental_telemetry: { isEnabled: true }`
   in WS2, emitting OpenTelemetry spans to the Vercel AI Gateway dashboard. For
   debugging-depth trace data (full span tree, input/output, latency breakdown),
   Langfuse is the natural consumer, but it must not add a mandatory hot-path
   dependency. The correct shape is a flag-gated span processor: off by default
   in production, enabled only when an operator sets the flag.

---

## Goal

- `curl https://erikunha.dev/api/healthz` returns 200 (or 503 when PSI is
  stale). Never 308.
- Post-deploy smoke probes the canonical production domain for the healthz step,
  not only the deployment artifact URL.
- Langfuse span processor compiles into the codebase but is completely inert
  (zero imported modules loaded, zero network calls) unless `LANGFUSE_ENABLED=true`
  is set. Hot path is unchanged when the flag is off.

---

## Diagnosis: the healthz 308

**Suspected root cause: Vercel trailing-slash redirect on `/api/healthz`.**

Vercel's routing layer applies a canonical-URL redirect for routes that lack a
trailing slash when the project's `trailingSlash` behavior points to the trailing
form (or vice versa). `next.config.ts` does not set `trailingSlash` explicitly,
so it defaults to `false` (no trailing slash expected). However, Vercel's platform
layer independently enforces a trailing-slash redirect for routes that were
previously accessed with a trailing slash and have been cached as such, or when
the deploy URL and the custom domain disagree on the canonical form.

The more likely mechanism: the `*.vercel.app` deployment artifact URL responds
200, but the custom-domain router (`erikunha.dev`) has a redirect rule (either
a Vercel `cleanUrls` / `trailingSlash` setting stored in project configuration
rather than `next.config.ts`, or a legacy redirect rule from an earlier deploy)
that 308-redirects `/api/healthz` to `/api/healthz/`. The handler lives at
`app/api/healthz/route.ts`, which is a Next.js Route Handler, and Route Handlers
are strict on the trailing slash: a request for `/api/healthz/` with a trailing
slash does not match the file at `route.ts` and instead hits the platform 404 or
redirect path.

**Verification step:** `curl -sIL https://erikunha.dev/api/healthz` to observe
the full redirect chain. Then `curl -sI https://erikunha.dev/api/healthz/` to
confirm whether the trailing-slash form resolves. Check the Vercel project
dashboard under Settings > General > Trailing Slash to confirm the platform-level
setting. The fix is a `trailingSlash: false` assertion in `next.config.ts` (which
Next.js forwards to Vercel as a deployment hint) plus a verification that both
the artifact URL and the canonical URL return 200 post-deploy.

---

## Approach

### 1. Fix healthz 308

Add `trailingSlash: false` to the `nextConfig` object in `next.config.ts`. This
is not a new behavior: Next.js 15+ default is already `false`. Making it explicit
forces Vercel to write the canonical-URL redirect rule in the generated
`routes-manifest.json` unambiguously, eliminating the platform-level ambiguity
that allows the 308 to appear on the custom domain.

No changes to `app/api/healthz/route.ts` are required. The handler is correct.
The fix is entirely in the config layer.

**Verification:** after the PR deploys, run
`curl -sI https://erikunha.dev/api/healthz` and confirm HTTP 200 or 503.

### 2. Retarget smoke at the canonical production domain

Modify the `Health check` step in `.github/workflows/smoke.yml` to probe
`https://erikunha.dev/api/healthz` in addition to (or instead of) the
artifact URL. The canonical URL exercises the full routing path including CDN
and redirect rules that the artifact URL may bypass.

**WS0 coordination note:** WS0 (PR 1) adds a header-assertion step to `smoke.yml`
that verifies CSP and other security headers against the canonical domain. WS5
must preserve that step verbatim when editing the file. The safest merge strategy
is to rebase WS5 onto the merged WS0 branch before opening the WS5 PR.

The revised health-check step keeps the allow-list (`*.vercel.app` and
`erikunha.dev`) and the 200/503 acceptance logic unchanged. The change is
only the URL probed.

### 3. Langfuse span processor behind an env flag

**Flag name:** `LANGFUSE_ENABLED`

**Off-by-default contract:** when `LANGFUSE_ENABLED` is absent or any value
other than the string `"true"`, the Langfuse processor module is never imported.
The check is a single `process.env.LANGFUSE_ENABLED === 'true'` guard at the
top of the initializer. No dynamic `import()` call executes; no network socket
is opened; no latency is added to the hot path.

**Processor location:** `lib/telemetry/langfuse.ts`. This module exports one
function, `registerLangfuseProcessor()`, that conditionally registers a
`LangfuseExporter` as an OpenTelemetry span processor. It is called once at
module load time from `instrumentation.ts` (Next.js 15+ native instrumentation
hook), which is the correct place for OTel setup: it runs outside the request
path, before any route handler is invoked, and is excluded from Edge bundles.

**Langfuse package:** `langfuse-vercel` (the Vercel-native SDK that wraps the
Langfuse OTel exporter). Pinned to a specific semver in `package.json`, added
as a regular dependency (not devDependency) because the processor is
conditionally loaded at runtime, not only at build time.

**WS2 dependency:** the processor consumes spans emitted by `experimental_telemetry`
on the `streamText` call in `app/api/ask/route.ts`. WS5 depends on WS2 having
shipped so that telemetry spans actually exist when the processor is active.
When `LANGFUSE_ENABLED=true` without WS2, no ask spans will appear in Langfuse
(the processor is live but no spans are emitted), which is a no-harm condition.

---

## Architecture

### New files

| Path | Purpose |
|---|---|
| `lib/telemetry/langfuse.ts` | `registerLangfuseProcessor()`: flag check, conditional `import`, registers `LangfuseExporter` as OTel span processor |
| `__tests__/langfuse-processor.test.ts` | Behavioral: processor is inert when flag off; processor registers when flag on (mocked exporter) |

### Modified files

| Path | Change |
|---|---|
| `next.config.ts` | Add `trailingSlash: false` to `nextConfig` |
| `.github/workflows/smoke.yml` | Health-check step probes `https://erikunha.dev/api/healthz` as the canonical target; preserves WS0 header-assertion step |
| `instrumentation.ts` | Call `registerLangfuseProcessor()` in the `register()` hook (Node.js runtime branch only) |
| `.env.example` | Document `LANGFUSE_ENABLED`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASEURL` with the off-by-default contract |
| `package.json` | Add `langfuse-vercel` at a pinned semver |

Note: `app/api/healthz/route.ts` is NOT modified. The handler logic is correct.

---

## Error handling

### Langfuse processor is a no-op when flag is off

The guard in `lib/telemetry/langfuse.ts` is a synchronous `process.env` check
evaluated once at module load. No `Promise`, no `setTimeout`, no dynamic import.
If the flag is absent (the common production case), the function returns
immediately without touching the OTel SDK. Zero bytes are added to the
Node.js module graph at runtime for the Langfuse package.

### Langfuse processor must not crash the server when flag is on

`registerLangfuseProcessor()` wraps the registration call in a try/catch. A
failure to initialize Langfuse (bad credentials, network unreachable at cold
start) logs a `warn` via `lib/log.ts` and returns without rethrowing. The server
starts normally. Subsequent requests are unaffected because the processor is
optional.

### Smoke must not flake on cold start

Vercel serverless functions can have cold starts of 500ms-2000ms on first
invocation. The smoke step already uses `--max-time 30` on the curl. No change
needed to the timeout. The canonical-domain healthz step should follow the same
pattern: a single curl with `--max-time 30` and a retry on network-error only
(`--retry 2 --retry-connrefused`).

### Production curl timeouts

Any `curl` command added to smoke.yml uses `--max-time 30 --retry 2`. The 308
loop (if the healthz fix is incomplete) is prevented by NOT following redirects:
use `-sI` (HEAD, no follow) to detect the 308 explicitly and fail the smoke with
a clear error message rather than silently following to a 404.

---

## Test strategy

All tests follow the project TDD contract: failing test written first,
implementation satisfies it.

### 1. Langfuse processor inert when flag is off

`__tests__/langfuse-processor.test.ts`:

- Mock the `langfuse-vercel` module to track whether its constructor is called.
- `vi.stubEnv('LANGFUSE_ENABLED', undefined)` (unset).
- Import and call `registerLangfuseProcessor()`.
- Assert that the `LangfuseExporter` constructor was NOT called.
- Assert that no OTel span processor was registered (mock `@opentelemetry/sdk-trace-base`).

This test proves the zero-hot-path-impact contract mechanically, not by
inspection.

### 2. Langfuse processor registers when flag is on

Same file, separate `describe` block:

- `vi.stubEnv('LANGFUSE_ENABLED', 'true')`.
- Stub `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` with test values.
- Call `registerLangfuseProcessor()`.
- Assert that the `LangfuseExporter` constructor was called once with the
  expected credentials.
- Assert that `addSpanProcessor` was called on the tracer provider.

### 3. healthz returns 200 behaviorally (existing tests, no change needed)

`__tests__/healthz.test.ts` already covers the 200/503 contract at the handler
level (fresh PSI timestamp returns 200, stale/null returns 503, Redis error
returns 503). These tests remain valid post-WS5 because `route.ts` is unchanged.

The NEW test is an integration-level smoke assertion in `smoke.yml` that verifies
the canonical domain returns 200 or 503 (not 308). This is the class of test the
audit found missing: the unit test passed; the live route did not.

### 4. Smoke asserts prod health via canonical URL

The revised smoke step in `smoke.yml` explicitly rejects any HTTP code outside
`{200, 503}` for the canonical-domain healthz check. The 308 case, which
currently passes silently through the artifact-URL check, fails this step.

---

## Acceptance criteria

1. `curl -sI https://erikunha.dev/api/healthz` returns HTTP 200 (PSI fresh) or
   503 (PSI stale). Never 308. Verified by the implementer before PR opens and
   by the post-deploy smoke on every subsequent deploy.

2. Post-deploy smoke (`smoke.yml`) exercises the canonical production domain
   (`https://erikunha.dev/api/healthz`) for the health check, and preserves the
   WS0 header-assertion step unchanged.

3. Langfuse traces appear in the Langfuse dashboard when `LANGFUSE_ENABLED=true`
   is set and WS2 telemetry is active.

4. When `LANGFUSE_ENABLED` is unset or any value other than `"true"`, the
   production hot path is byte-for-byte identical to pre-WS5: no additional
   latency, no additional module imports, no network calls.

5. `__tests__/langfuse-processor.test.ts` passes: processor inert when flag off,
   registers when flag on. Zero reliance on source-grep or file inspection; purely
   behavioral via mocked OTel and Langfuse constructors.

6. `pnpm ci:local` passes (typecheck, lint, unit tests, content validation, naming
   gates, bundle check).

7. `pnpm gates:runtime` passes (build + LHCI + axe + E2E functional). No
   performance budget change expected (Langfuse module is tree-shaken from the
   client bundle entirely; `lib/telemetry/langfuse.ts` is server-only).

---

## Out of scope

**Always-on self-hosted OTel collector pipeline** was explicitly rejected in the
program design. The reasons are: (a) it adds a mandatory hot-path dependency with
its own failure surface on every request; (b) at a single Haiku endpoint the
incremental insight over the Vercel AI Gateway dashboard is marginal; (c) it
models cargo-cult over-building rather than the "showcase rigor in CI; restraint
in prod" principle the program is written to demonstrate. The Langfuse
flag-gated pattern is the correct reference: it shows how to integrate a full
trace pipeline with zero prod risk.

---

## Risks and open questions

| Item | Severity | Note |
|---|---|---|
| `trailingSlash: false` is already the Next.js default; making it explicit may have no effect if the 308 originates from a Vercel project-level setting | Medium | Verify via Vercel dashboard Settings > General > Trailing Slash during implementation. If the project-level setting overrides `next.config.ts`, the fix is in the dashboard, not the config. |
| `langfuse-vercel` bundle size impact on the server bundle | Low | The module is conditionally imported; it must not appear in the Edge runtime bundle. Verify with `pnpm bundle-check` after adding the dependency. The `dependency-manager` agent must run before PR opens. |
| WS5 edits `smoke.yml`, which WS0 also edits | Medium | Rebase WS5 onto the merged WS0 commit before opening the WS5 PR to avoid merge conflicts on `smoke.yml`. WS0 ships as PR 1; WS5 ships as PR 8, so WS0 will be long-merged by then. |
| Cold-start latency on Langfuse init when flag is on | Low | Langfuse processor registration runs in `instrumentation.ts` before the first request. The init is async and does not block the request path. A slow Langfuse endpoint (DNS lookup, TLS handshake) at cold start does not delay the first request. |
| WS2 not yet shipped at the time of WS5 implementation | Informational | WS5 is PR 8 (last). WS2 ships as PR 6. By the time WS5 is implemented, `experimental_telemetry` will already be live. No conditional logic needed in WS5 for the WS2 dependency. |
