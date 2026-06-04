> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS1 Boot-time Config Integrity
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 2 of 8
> Delivery: standalone PR to main

# WS1: Boot-time Config Integrity

## Context

Three medium-severity findings from the 2026-06-04 platform audit. All three share the
same root cause: configuration is consumed late, scattered, or fragile rather than
validated once at the entry point.

| Finding | Current state | Risk |
|---|---|---|
| No Zod env schema | `AI_GATEWAY_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY` are read with `process.env.*` scattered across route files and libs; absence fails lazily on the first real request, not at deploy time | A missing key in a new environment is invisible until a user triggers the affected route |
| Duplicate model string | `'anthropic/claude-haiku-4-5'` is hardcoded at `app/api/ask/route.ts:43` (`GATEWAY_MODEL`) AND at `scripts/ask-eval.ts:500` (`featureModel` field of the aggregate object); the eval harness also references the model in a comment at line 52 | The eval gate can grade a different model than ships if one copy is updated and the other is not |
| `strip-next-polyfills.mjs` silent no-op | The postinstall script guards with `existsSync(target)` and exits 0 if the file is absent; it does not assert the file's shape before overwriting; if Next reorganizes the polyfill path (the repo just moved to Next 16) the script silently does nothing and the polyfill remains intact | Polyfill strip silently stops working after a Next.js upgrade; the Lighthouse Best Practices penalty returns with no signal |

## Goal

All three findings closed by a single, small PR. The PR ships three independent
improvements that share no runtime state and can be reviewed as separate concerns:

1. A single env validation module (`lib/env.ts`) that throws at import time for any
   missing required variable, typed throughout, and imported by every consumer
   that currently reads `process.env.*` for a managed variable.

2. A single model constant (`lib/ask/model.ts`) that is the one source of truth for
   the feature model string, imported by both `app/api/ask/route.ts` and
   `scripts/ask-eval.ts`.

3. A hardened `scripts/strip-next-polyfills.mjs` that asserts file existence AND
   shape before proceeding, and throws (not warns, not exits 0) on mismatch.

Mastery flourish: a test suite proving the fail-at-boot contract for the env
schema, the no-drift guarantee for the model constant, and the assert-then-throw
behavior for the polyfill script.

Dependency note: WS2 (AI feature hardening) depends on WS1 completing first.
WS2 imports `ASK_MODEL` from `lib/ask/model.ts` and reads required vars from
`lib/env.ts`. WS1 must merge before WS2 is implemented.

## Approach

### 1. Hand-rolled Zod env schema (lib/env.ts)

Parsed once at module load. No new dependency beyond the `zod` package already
exact-pinned in `package.json`. The point is to showcase the pattern, not to
delegate it to `@t3-oss/env-nextjs`.

Schema covers every application-owned variable found in the inventory below.
Variables fall into three buckets:

**Required at runtime (throw if absent):**

| Variable | Read today in | Notes |
|---|---|---|
| `AI_GATEWAY_API_KEY` | `app/api/ask/route.ts` (implicitly via AI SDK env resolution), `scripts/ask-eval.ts` (explicit guard at line 334) | Gateway auth; Vercel OIDC covers prod, but local dev and eval CI need it set |
| `UPSTASH_REDIS_REST_URL` | `app/api/ask/route.ts:167`, `scripts/ask-eval.ts:534`, `lib/rate-limit.ts` (via `Redis.fromEnv()`) | Required for rate-limit, budget, dedup, and KV persistence |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above (paired with URL) | Required with URL |
| `RESEND_API_KEY` | `app/api/contact/route.ts:42`, `app/api/psi-refresh/route.ts:40` | Email delivery; absent contact form silently fails |

**Optional with typed defaults (present in some environments, absent in others):**

| Variable | Read today in | Behavior when absent |
|---|---|---|
| `ASK_ENABLED` | `app/api/ask/route.ts:48,129` | Absent = feature live (OFF_KEYWORDS set drives the disable logic) |
| `DEPLOY_SALT` | `lib/ip-hash.ts:30` | Optional; auto-generated via Upstash on first prod request |
| `CRON_SECRET` | `app/api/psi-refresh/route.ts:8` | Absent = cron endpoint rejects all requests (safe default) |
| `PSI_API_KEY` | `lib/lighthouse-scores.ts:28` | Absent = PSI refresh skipped |

**Build-time / infrastructure variables (not managed by lib/env.ts):**

The following are read directly from `process.env` and should remain unmanaged.
They are either injected by the runtime platform (not operator-configurable), or
read at build time where the module-load contract does not apply, or used only in
scripts that run outside the Next.js runtime:

| Variable | File | Reason to leave unmanaged |
|---|---|---|
| `NODE_ENV` | `lib/log.ts:28,42,45`, `lib/ip-hash.ts:34`, `proxy.ts:57` | Injected by Node/Next; never set by operators |
| `NEXT_RUNTIME` | `lib/log.ts:28` | Injected by Next.js Edge runtime |
| `VERCEL` | `app/layout.tsx:150` | Injected by Vercel at build time; read in RSC, not a runtime API var |
| `VERCEL_GIT_COMMIT_SHA` | `app/api/healthz/route.ts:7` | Injected by Vercel; not operator-set |
| `CONTENT_UPDATED_AT` | `app/sitemap.ts:10,11` | Optional build-time stamp; absent is a safe no-op |
| `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT` | `scripts/ask-eval.ts:229,230` | CI-injected; eval script runs outside the Next.js module boundary |
| `CI` | `scripts/ask-eval.ts:335` | CI-injected |
| `GITHUB_ACTIONS` | `scripts/check-pr-comments.ts:182` | CI-injected |
| `PR_BASE`, `GITHUB_BASE_REF` | `scripts/pr-size.ts:48,49` | CI/DX workflow vars; tooling scripts only |
| `ANTHROPIC_API_KEY` | `scripts/gates-runtime.ts:105` | Passed through to the build env in the runtime gate script |
| `ANALYZE` | `package.json` (build script) | Passed at CLI; not a managed application var |

The `lib/env.ts` module exports a typed `env` object. Callers replace every
direct `process.env.VAR` read (for managed vars) with `env.VAR`. The module
throws a descriptive error at import time, naming the missing variable, so the
failure surfaces in the build log rather than in a request trace.

The schema is parsed with `z.object({ ... }).parse(process.env)` at module load
(not inside a function). Missing required vars produce a `ZodError` with a precise
`message` naming every missing field. An `initEnv()` factory function is not
used: the parse-at-load pattern is the point of the showcase.

### 2. Single model constant (lib/ask/model.ts)

A new file exporting one string constant. Both consumers import it.

Current state: `GATEWAY_MODEL = 'anthropic/claude-haiku-4-5'` at
`app/api/ask/route.ts:43`; `featureModel: 'anthropic/claude-haiku-4-5'` inline
at `scripts/ask-eval.ts:500`.

After WS1: `lib/ask/model.ts` exports `ASK_MODEL`. `route.ts` replaces `GATEWAY_MODEL`
with `ASK_MODEL` imported from `lib/ask/model.ts`. `ask-eval.ts` replaces the
inline string literal at line 500 with the same import.

The constant name in `ask-eval.ts` changes from the inline literal to the import;
the `Aggregate.featureModel` field value stays the same string. No behavior changes;
only the source-of-truth location moves.

### 3. Hardened strip-next-polyfills.mjs

Current behavior: `existsSync(target)` returns false, script logs
`[strip-polyfills] polyfill-module.js not found, skipping` and exits 0. The
polyfill strip silently does not happen.

Required behavior: assert the target exists AND contains the expected shape
(the module must export default polyfill content, confirmed by a substring or
pattern check on the first N bytes before overwriting). If the target is absent
or does not match the expected shape, throw an error and exit non-zero. The script
is idempotent: if it has already been run (the file contains the stripped
sentinel comment), treat that as a successful prior run and exit 0 normally.

The "already stripped" sentinel is the first line the script writes:
`// Stripped by scripts/strip-next-polyfills.mjs`. Detect it to skip
re-running on double-install.

The "expected shape" check: the original `polyfill-module.js` is a bundled JS
file; a reasonable assert is that the file size is above a minimum threshold
(e.g., 1 KB) before overwrite, confirming it contains actual polyfill content
rather than a renamed or empty placeholder. For maximum robustness, also check
for the presence of a known token from the original file (e.g., `Array.prototype`
or `Object.hasOwn`) to confirm the file is what we expect.

## Architecture

### New files

| File | Purpose |
|---|---|
| `lib/env.ts` | Hand-rolled Zod schema; parses `process.env` once at module load; exports typed `env` object; throws at boot on missing required vars |
| `lib/ask/model.ts` | Exports `ASK_MODEL: string` (the single source of truth for the feature model string) |
| `lib/__tests__/env.test.ts` | Behavioral test: importing the module with a required var absent throws; grep-based assertion proving no stray `process.env` reads for managed vars outside `lib/env.ts` |
| `lib/ask/__tests__/model.test.ts` | Behavioral test: `ASK_MODEL` is the same string that `route.ts` uses to call `streamText`; WS3 will add the model-drift assertion against the eval harness |

### Modified files

| File | Change |
|---|---|
| `app/api/ask/route.ts` | Remove `GATEWAY_MODEL` local const; import `ASK_MODEL` from `lib/ask/model.ts`; replace `process.env.ASK_ENABLED` reads with `env.ASK_ENABLED` from `lib/env.ts`; replace the `process.env.UPSTASH_REDIS_REST_URL` / `process.env.UPSTASH_REDIS_REST_TOKEN` guard at line 167 with `env.UPSTASH_REDIS_REST_URL` / `env.UPSTASH_REDIS_REST_TOKEN` |
| `app/api/contact/route.ts` | Replace `process.env.RESEND_API_KEY` at line 42 with `env.RESEND_API_KEY` from `lib/env.ts` |
| `app/api/psi-refresh/route.ts` | Replace `process.env.CRON_SECRET` at line 8 and `process.env.RESEND_API_KEY` at line 40 with `env.CRON_SECRET` / `env.RESEND_API_KEY` from `lib/env.ts` |
| `app/api/healthz/route.ts` | `VERCEL_GIT_COMMIT_SHA` stays as direct `process.env` read (platform-injected; unmanaged per the table above); no change needed |
| `lib/lighthouse-scores.ts` | Replace `process.env.PSI_API_KEY` at line 28 with `env.PSI_API_KEY` from `lib/env.ts` |
| `lib/ip-hash.ts` | Replace `process.env.DEPLOY_SALT` at line 30 with `env.DEPLOY_SALT` from `lib/env.ts`; `NODE_ENV` check at line 34 stays as direct `process.env` read (platform-injected) |
| `scripts/ask-eval.ts` | Import `ASK_MODEL` from `lib/ask/model.ts`; replace inline `'anthropic/claude-haiku-4-5'` literal at line 500 with `ASK_MODEL`; `AI_GATEWAY_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` guards remain as direct `process.env` reads (this script runs outside the Next.js runtime boundary and already handles absence with explicit guards) |
| `scripts/strip-next-polyfills.mjs` | Add existence assert (throw + non-zero exit if absent); add shape assert (size threshold + known-token check); add idempotency sentinel detection; replace silent `process.exit(0)` on miss with a hard throw |

## Error handling

### Missing required env var

`lib/env.ts` parses via `z.object({ ... }).parse(process.env)` at module load.
When a required field is absent, Zod throws a `ZodError`. The unhandled throw
propagates out of the module, causing Node to print the error and exit during
`next build` or `next start`. The error message from Zod names every missing
field by key, making the failure immediately actionable.

Example output (illustrative):
```
ZodError: [
  { code: "invalid_type", expected: "string", received: "undefined",
    path: ["AI_GATEWAY_API_KEY"], message: "Required" }
]
```

Build fails. Deploy is blocked before any request is served. This is the exact
behavior the finding calls for.

### Fail-open Redis interaction (unchanged)

`lib/rate-limit.ts` calls `Redis.fromEnv()` which reads `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN` directly. After WS1, both values come from `env.*`
but the fail-open try/catch posture in every call site (`getAskLimit`, `reserveBudget`,
`checkIdenticalQuestion`) is deliberately preserved. The env schema guarantees the
vars are present and typed; it does not guarantee Redis is reachable. Network
failures after a successful boot are handled by the existing fail-open wrappers.
Do not remove the try/catch blocks in `lib/rate-limit.ts`.

### Build-time vs runtime distinction

`lib/env.ts` is imported by server-only modules. Next.js 16 App Router executes
server module code at build time (for statically generated routes) and at runtime
(for dynamic routes and API handlers). The parse-at-load pattern fires in both
contexts. For Vercel deployments, all required vars must be present as build-time
environment variables (set in Vercel project settings), not only as runtime
injection. This matches existing practice: `AI_GATEWAY_API_KEY`, `UPSTASH_*`,
`RESEND_API_KEY` are already configured as build-time vars on Vercel.

The Edge runtime constraint: Next.js Edge runtime supports `process.env` reads
for vars that are inlined at build time. Zod's `z.string()` parse on
`process.env.VAR` works in the Edge runtime. Do not add Node-specific runtime
checks (e.g., `typeof process !== 'undefined'`) that would break Edge.

## Test strategy

Tests are written first (TDD per project standards). Three test files cover the
three deliverables. All tests are behavioral; none use `readFileSync` without the
allow tag (project rule, `no-source-grep.test.ts` gate).

### env.test.ts: fail-at-boot contract

```
describe('lib/env.ts', () => {
  it('throws a ZodError at import time when a required var is absent', async () => {
    // Run in a child process with the required var removed from env so the
    // module's parse-at-load fires in isolation. The child process exits
    // non-zero; the test asserts the error output names the missing var.
  });

  it('exports a typed env object when all required vars are present', () => {
    // Set the required vars in process.env, re-import via jest.resetModules(),
    // assert env.AI_GATEWAY_API_KEY is the set value.
  });
});
```

Child-process approach is required because the module throws at import, which
means a normal `import` in the test file would crash the test runner. Use
`child_process.spawnSync('node', ['--import', 'tsx/esm', 'lib/env.ts'], { env: {} })`
and assert exit code is 1 and stderr contains `AI_GATEWAY_API_KEY`.

### env.test.ts: no-stray-process-env-reads for managed vars

A single test uses `fs.readFileSync` (allow-tagged per project convention) to
read the source files listed in the "Modified files" table and asserts that none
of them contain `process.env.AI_GATEWAY_API_KEY`, `process.env.RESEND_API_KEY`,
`process.env.UPSTASH_REDIS_REST_URL`, `process.env.UPSTASH_REDIS_REST_TOKEN`,
`process.env.ASK_ENABLED`, `process.env.DEPLOY_SALT`, `process.env.PSI_API_KEY`,
`process.env.CRON_SECRET` as raw string literals (the schema module itself is
excluded from the scan). This is the grep-based enforcement the acceptance
criteria require, encoded as a failing test rather than a manual check.

### model.test.ts: single source of truth

```
it('ASK_MODEL is the string used in the streamText call in route.ts', () => {
  // Import ASK_MODEL from lib/ask/model.ts
  // Import the POST handler; mock streamText; call POST with a synthetic request
  // Assert the `model` argument passed to streamText equals ASK_MODEL
});
```

This test fails if `route.ts` drifts back to a local constant. WS3 will extend
this test to also assert that `ask-eval.ts`'s aggregate `featureModel` field
equals `ASK_MODEL`.

### strip-next-polyfills.test.mjs: assert-then-throw behavior

Three cases using a temp directory with a synthetic `node_modules/next/dist/build/polyfills/`:

1. Target absent: running the script exits non-zero and the thrown message
   contains `polyfill-module.js not found`.
2. Target present but wrong shape (empty file or wrong content): script exits
   non-zero and message contains shape mismatch.
3. Target present and valid: script exits 0 and the target file now contains the
   stripped sentinel comment.
4. Target already stripped (sentinel present): script exits 0 without rewriting
   (idempotency).

## Acceptance criteria

All criteria are behavioral and verifiable by command.

1. **Missing required var fails the build.** Remove `AI_GATEWAY_API_KEY` from the
   environment, run `pnpm build`; the process exits non-zero and the output names
   `AI_GATEWAY_API_KEY` in the error message.

2. **Zero stray process.env reads for managed vars.** The grep-based test in
   `env.test.ts` passes (no raw `process.env.AI_GATEWAY_API_KEY` etc. outside
   `lib/env.ts`). Verified by: `pnpm test`.

3. **Model string in exactly one source location.** `grep -r "'anthropic/claude-haiku-4-5'"
   app/ lib/ scripts/ --include="*.ts"` returns exactly one match:
   `lib/ask/model.ts`. Verified by: `pnpm test` (the model test asserts this
   structurally) and the grep command manually.

4. **strip-next-polyfills throws on missing target.** Delete
   `node_modules/next/dist/build/polyfills/polyfill-module.js`, run
   `node scripts/strip-next-polyfills.mjs`; process exits non-zero. (Currently
   it exits 0 silently.)

5. **All unit tests pass.** `pnpm test --run` exits 0.

6. **Build succeeds with all required vars set.** `pnpm build` exits 0 with a
   complete `.env.local` containing all required vars.

7. **TypeScript strict check passes.** `pnpm typecheck` exits 0 (the typed `env`
   object must satisfy all call sites).

8. **Biome lint passes.** `pnpm check` exits 0.

## Out of scope

- `@t3-oss/env-nextjs` or any other env-validation library. The hand-rolled Zod
  schema is the point.
- Migrating `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL`, `VERCEL_GIT_COMMIT_SHA`,
  `CONTENT_UPDATED_AT` to `lib/env.ts`. These are platform-injected or
  build-time vars; direct `process.env` reads are correct for them.
- Migrating CI/DX script vars (`GITHUB_RUN_ID`, `CI`, `PR_BASE`, `ANALYZE`, etc.)
  to `lib/env.ts`. These run outside the Next.js module boundary.
- Changing the fail-open Redis posture in `lib/rate-limit.ts`. The env schema
  guarantees vars are present; it does not eliminate the need for network-level
  error handling.
- `scripts/ask-eval.ts` migrating its `AI_GATEWAY_API_KEY` guard to `lib/env.ts`.
  The eval script runs via `tsx` outside the Next.js runtime; it already has a
  correct explicit guard with the right CI/local-dev distinction at line 334.
- Any change to `app/layout.tsx` (`process.env.VERCEL` is a build-time RSC read).
- Any change to `app/sitemap.ts` (`process.env.CONTENT_UPDATED_AT` is an optional
  build-time timestamp).
- Prompt versioning, output validation, or telemetry (WS2).
- Doc drift corrections (WS6).

## Risks and open questions

### Edge runtime env access constraints

Next.js Edge runtime inlines `process.env` vars at build time via webpack/swc
dead-code elimination. Zod's `z.string()` parse on `process.env.VAR` reads the
value normally in Edge; the parse-at-load pattern works. Risk: if a future Next.js
version changes Edge env semantics, `lib/env.ts` would need an Edge-safe adapter.
Mitigated by: the existing routes (`app/api/ask/route.ts`, `app/api/contact/route.ts`)
already read `process.env` in what may be an Edge-runtime context; WS1 is not
changing the semantics, only adding a Zod parse layer. Verify with `pnpm build`
on the full set of modified routes.

### Build-time vs runtime var population on Vercel

`lib/env.ts` parses at module load, which fires at build time for statically
analyzed routes. All required vars must be present as Vercel build-time env vars,
not deferred to runtime injection. The vars in the required list (`AI_GATEWAY_API_KEY`,
`UPSTASH_*`, `RESEND_API_KEY`) are already configured as build-time vars in the
Vercel project (confirmed by the existing behavior of the failing request path
today). This is not a new constraint introduced by WS1; it is an explicit
documentation of an existing requirement.

### lib/env.ts as a transitive server-only module

`lib/env.ts` will be imported by `app/api/*` routes. If any client component
ever imports a lib that imports `lib/env.ts` transitively, the build will fail
because `process.env.*` server vars are not available in client bundles. Mitigation:
add an `import 'server-only'` sentinel at the top of `lib/env.ts`, consistent with
the `lib/ip-hash.ts` pattern (line 18 of `lib/ip-hash.ts` already uses
`import 'server-only'`).

### strip-next-polyfills.mjs shape assertion fragility

The shape assertion (size threshold + known-token check) is correct for the current
Next.js 16 polyfill bundle. If Next reorganizes the bundle significantly in a future
version, the shape assertion itself may fail, blocking `pnpm install`. The failure
mode is a loud, immediate error at `postinstall` rather than a silent no-op. This
is the correct trade-off: a false-positive block is easier to diagnose and fix
(update the assertion) than a false-negative silent skip. Document the assertion
threshold in a `// WHY:` comment at the assert site so future maintainers can
update it knowingly.

### WS2 dependency

WS2 imports `ASK_MODEL` from `lib/ask/model.ts`. If WS1 is not merged before WS2
implementation begins, the WS2 implementer must either implement `lib/ask/model.ts`
in the WS2 branch (creating a merge conflict) or wait. The program spec sequences
WS1 before WS2 (PR order 2 of 8 vs. 6 of 8). Do not begin WS2 implementation
until WS1 is merged.

## Architect-reviewer gate findings (folded 2026-06-04, GATE_RESULT: PASS, +performance-engineer)

The architect gate passed all four spec gates but found three CRITICAL design contradictions in the original required-variable classification. The following SUPERSEDES the "required, throw at boot" treatment of secrets in the sections above.

Revised env design: `lib/env.ts` validates and fails fast at module load ONLY for non-secret configuration and value FORMATS. Every external secret is `.optional()` and throws at its USE SITE with a precise message, preserving the existing lazy-throw and fail-open contracts. Per finding:

1. CRITICAL: `AI_GATEWAY_API_KEY` is resolved by the AI SDK from the Vercel OIDC token and is intentionally unset on deploys; nothing in `app/` or `lib/` reads it directly. A boot throw blocks every Vercel build. Classification: optional, the AI SDK owns resolution.
2. CRITICAL: `UPSTASH_REDIS_REST_URL/TOKEN` are read as presence guards because eval CI and local dev run with Redis absent and rely on fail-open. A boot throw makes the ask route module fail to import, so the fail-open path can never execute. Classification: optional; the `route.ts` presence guards keep reading them as possibly-undefined.
3. CRITICAL: `RESEND_API_KEY` is used only by contact and psi-refresh behind lazy `if (!key) throw`. A shared boot-throwing schema imported transitively by the ask route would crash ask on a missing email secret. Classification: optional, throw at use site.

Additional plan tasks from the gate:
4. Inventory completeness: migrate ALL THREE `ASK_ENABLED` reads including `route.ts:48` (cold-start log) and the `route.ts:167`/`:173` pair (two reads). The no-stray-reads test fails against the original modified-files list otherwise.
5. Kill-switch preservation: unset `ASK_ENABLED` must still resolve live; the Zod default is a non-OFF string or `undefined`, never an OFF keyword.
6. `DEPLOY_SALT` default must be `undefined` or empty, never the literal `'portfolio'` fallback, or the Upstash auto-generation is bypassed and the privacy threat model collapses in production.
7. `import 'server-only'` must precede the parse so a client-bundle import fails with the server-only error, not an opaque Zod error.
8. `strip-next-polyfills.mjs`: run the idempotency-sentinel check BEFORE the size/token shape assert, or a second install (already stripped, now tiny) throws on the assert.
9. The no-stray-reads grep allow-list must exclude `Redis.fromEnv()` in `lib/rate-limit.ts` and the `NODE_ENV` read in `lib/ip-hash.ts` (intentional direct reads).
10. Dispatch addition: `performance-engineer` (the polyfill strip guards the Lighthouse Best Practices score).
