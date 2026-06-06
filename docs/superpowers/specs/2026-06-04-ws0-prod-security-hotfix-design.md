# WS0: Production Security Hotfix Design Spec

> Status: SUPERSEDED (2026-06-04) — the CRITICAL premise is a false positive; see Resolution. The body below is retained as an audit trail.
> Date: 2026-06-04
> Workstream: WS0 Production Security Hotfix
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: DISSOLVED — residual folded into WS5; WS1 is now PR 1
> Delivery: no standalone PR

## Resolution (2026-06-04, verified live)

This spec's CRITICAL finding does not exist. It was produced by a measurement defect, then
re-confirmed by the architect-reviewer gate, which repeated the same defect.

**Root cause of the false positive.** Every "verified live" check in the audit and the
architect gate ran `curl -sI https://erikunha.dev` (apex) without `-L`. The apex 308-redirects
to the canonical `https://www.erikunha.dev`. A 3xx response carries only redirect-layer headers
(Vercel injects a bare `strict-transport-security: max-age=63072000` on its redirect). The
actual 200 content response on the canonical host carries the full set, correctly shaped:

```
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ... ; report-to csp-endpoint; report-uri /api/csp-report
strict-transport-security: max-age=63072000; includeSubDomains; preload   # == next.config.ts:37, byte-for-byte
cross-origin-opener-policy: same-origin                                    # == next.config.ts:30
x-frame-options: DENY · x-content-type-options: nosniff · referrer-policy: strict-origin-when-cross-origin · permissions-policy: camera=(), microphone=(), geolocation=()
```

Therefore: **CSP is enforced in production. `next.config.ts` `headers()` IS applying.
STANDARDS.md Ch.9 is accurate** (do NOT "reconcile" a correct doc to the falsehood). The
audit committed the exact false-green class it claimed to be killing — the green came from
asserting against the wrong URL, not from a green unit test.

**The "locked" hardening (drop `script-src 'unsafe-inline'` via hashes) is infeasible and was
already rejected.** Served prod HTML contains ~202 inline framework scripts (React 19 `$RT`
timing + RSC `self.__next_f.push(...)` flight payloads). Their bytes are content-volatile, so a
strict hash-based `script-src` would require regenerating 200+ hashes on every content edit; one
miss blanks the page. `proxy.ts:37-40` already documents this constraint; DECISIONS.md
(2026-05-15 "CSP cleanup") already accepted `'unsafe-inline'` as deliberate. The audit proposed
reversing a documented decision without reading the rationale in the file it planned to edit.

**What survives as real, shippable work.** Exactly one control: nothing asserts the security
headers on the live *canonical* production response — the gap that let this error hide. Add a
post-deploy smoke step that `curl -sIL` the canonical host and fails if any of the seven headers
is absent. This belongs in **WS5** (already retargets `smoke.yml` at prod); a standalone WS0 PR
is not justified once the critical work evaporates. The `'unsafe-inline'` posture stays as-is and
documented; no `proxy.ts` / `next.config.ts` / STANDARDS.md change is warranted.

**Process fix (system self-improvement invariant).** The methodology lesson — live HTTP-header
verification must follow redirects to the canonical host, because a 3xx response carries only
redirect-layer headers — is recorded in memory so the next audit cannot repeat it.

---

## Context (original — premise falsified above, retained for audit trail)

Findings closed by this spec (audit, 2026-06-04):

- VERIFIED CRITICAL. Live `curl -sI https://erikunha.dev` returns exactly one security header: `strict-transport-security`. Absent in production: `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy`, `permissions-policy`, `reporting-endpoints`. The symptom is confirmed; the cause is not.
- Two code paths claim to set these headers, and neither is reaching production:
  - `next.config.ts` `headers()` declares `Cross-Origin-Opener-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` on `source: '/(.*)'`. Only HSTS is observed live, so this layer is either partially applied or shadowed.
  - `proxy.ts` (Next.js 16 renamed-middleware convention: a file at repo root exporting `function proxy(request: NextRequest)` plus a `config.matcher`) sets `Content-Security-Policy` and `Reporting-Endpoints` per response. Neither header is observed live, which is consistent with `proxy.ts` not being compiled or not being invoked on the production matcher.
- False-confidence vector. `__tests__/proxy-csp.test.ts` imports `proxy` from `@/proxy` and asserts on the returned `NextResponse` headers in-process. It passes. It proves the function returns the right headers when called directly; it proves nothing about whether Next.js wires that function into the production request path. A green unit test hid a live gap.
- Doc drift. `STANDARDS.md` Chapter 9 ("Security and Privacy") asserts the CSP posture is "held by the behavioral test `__tests__/proxy-csp.test.ts` (asserts the header is present and shaped correctly on responses)." That claim is false in the dimension that matters: the header is absent in production. The chapter and the comments in `proxy.ts` (which explicitly defer hash-based CSP and keep `script-src 'self' 'unsafe-inline'`) must be reconciled to the shipped reality.
- Environment fact. Repo is on Next.js `~16.2.6` (`package.json`, `node_modules/next/package.json`). On 16.2.6 the root `proxy.ts` exporting `function proxy()` IS the correct renamed-middleware convention, so the file is not obviously misnamed. That rules out "wrong filename" as the trivial answer and forces the diagnosis step below.

Closed assumptions (do not re-litigate in this PR): hash-based strict CSP is the chosen direction; the typed builder lives at `lib/security/csp.ts` (directory does not exist yet, confirmed via Glob); the smoke workflow gains a live production header assertion; STANDARDS.md Chapter 9 is corrected in this same PR.

## Goal

Restore all six missing security headers to the production response, replace the `'unsafe-inline'` `script-src` with build-time SHA-256 hashes of the known inline scripts (strict CSP, no `'unsafe-inline'` for scripts), and encode the audit's lesson by adding a test that asserts the headers on the live production deploy, not just on the in-process function. After this PR, `curl -sI https://erikunha.dev` returns the full header set with a hashed `script-src`, the post-deploy smoke fails if any header is absent, and STANDARDS.md Chapter 9 matches observable behavior.

This is a reference system: the diagnosis itself is part of the artifact. We do not pre-commit to a fix before the root cause is named, because the wrong fix (patching the layer that was already working) would leave the live hole open and ship a false-green a second time.

## Diagnosis protocol

Run these in order. Each step states what each outcome implies. Do not write any fix code until the root cause is named in one sentence (per project "root cause stated" rule).

### Step 1: Confirm what is actually deployed

`gh api repos/{owner}/{repo}/deployments --jq '.[0].sha'` (or the Vercel production deployment's commit) and compare to `git rev-parse origin/main`.

- If the deployed SHA is behind `origin/main` and a more recent commit already added/changed these headers: the bug may be "not yet deployed," not "broken code." Implication: re-verify against the deployed SHA's tree before assuming a code defect. The program spec already notes the working tree was 2 commits behind during the audit, so this check is mandatory, not optional.
- If the deployed SHA equals `origin/main` HEAD and the tree at that SHA contains the current `proxy.ts` and `next.config.ts`: the defect is real in shipped code. Proceed to Step 2.

### Step 2: Determine whether `proxy.ts` compiles into a Proxy entry

Run `pnpm build` and inspect the build output and `.next/` for a compiled proxy/middleware entry.

- Inspect `.next/server/` for a `proxy.js` / middleware manifest entry, and read `.next/server/middleware-manifest.json` (or the 16.x equivalent) for a registered matcher.
- If NO proxy entry is emitted: Next.js is not picking up `proxy.ts`. Implication: the CSP + Reporting-Endpoints headers never run in production. Root cause candidate A = "proxy convention not wired" (wrong location, build excludes it, or a config/runtime mismatch). This is the most likely cause given that both proxy-only headers (`content-security-policy`, `reporting-endpoints`) are the ones missing.
- If a proxy entry IS emitted with the expected matcher: the proxy compiles. Implication: the CSP loss is downstream (runtime not invoking it on the matched path, or the header being stripped). Move the suspicion to Step 4.

### Step 3: Determine whether `next.config.ts` `headers()` applies

Build, then inspect for the resolved headers config and test locally against the production server.

- `pnpm build && pnpm start` (production server locally), then `curl -sI http://localhost:3000/` and read which of the `next.config.ts` headers appear.
- If only `strict-transport-security` appears locally too: the defect reproduces off-Vercel, so it is in the code/config, not the Vercel header layer. Implication: `headers()` is not applying as written (most likely the whole `headers()` async function is failing to load, OR a later layer overrides everything except HSTS). Note: HSTS surviving alone is a strong signal, because Vercel injects HSTS independently of `next.config.ts` for custom domains, so "only HSTS live" is consistent with `next.config.ts` `headers()` never applying at all and Vercel adding HSTS on its own.
- If all `next.config.ts` headers appear locally but not in production: the loss is at the Vercel platform layer (header stripping, a `vercel.json` override, or a project-level config). Implication: the fix is platform configuration, not application code. Capture the exact Vercel config involved.

### Step 4: Identify which layer drops the headers, and name the root cause

Cross the Step 2 and Step 3 outcomes:

| `proxy.ts` compiled? | `next.config.ts` headers apply locally? | Root cause class | Fix locus |
|---|---|---|---|
| No | No | Both application layers are inert; likely a build/convention/config regression affecting both (e.g. a config option, a Next 16 behavior change, or an entry both depend on) | Re-wire both; investigate shared cause |
| No | Yes | `proxy.ts` is not wired; static headers ride `next.config.ts` but CSP/Reporting-Endpoints are lost | Fix the proxy convention wiring |
| Yes | No | Proxy runs but `next.config.ts` `headers()` is not applying | Fix `headers()` loading/override |
| Yes | Yes (locally) but absent in prod | Both correct in code; Vercel platform strips/overrides | Vercel config |

Write the resulting root cause as one sentence in the PR body and in the commit message (the "root cause stated" condition). Only then proceed to Approach. The Approach below branches on this outcome; it does not assume which cell is true.

## Approach

1. Fix the wiring at whichever layer Step 4 identified. Do not change the layer that was already working. If both layers are inert from a shared cause, fix the shared cause once rather than patching each symptom.
2. Introduce a typed CSP directive builder at `lib/security/csp.ts`:
   - Represent the policy as a typed object, e.g. `type CspDirectives = Record<CspDirectiveName, readonly string[]>`, where `CspDirectiveName` is a union of the directive keys currently hand-listed in `proxy.ts` (`default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-ancestors`, `frame-src`, `object-src`, `base-uri`, `form-action`, `worker-src`, `report-to`, `report-uri`).
   - Export one `serializeCsp(directives: CspDirectives): string` function that joins `key value...` segments with `; `, producing a string byte-identical in shape to today's `CSP_DIRECTIVES.join('; ')` except for `script-src`.
   - Export a builder that takes the environment (`development` vs other) and the script hash set, so `proxy.ts` calls `serializeCsp(buildCsp({ env, scriptHashes }))` instead of holding a literal array. This is the single serialization point unit-tested on its output.
   - Keep the existing dev-only branch (dev `script-src` retains `'unsafe-eval'` and `https://va.vercel-scripts.com`; production drops both) as typed inputs to the builder, not as inline ternaries in `proxy.ts`.
3. Build-time hash extraction for inline scripts. The two known inline scripts in the static HTML are both in `app/layout.tsx`:
   - the `initScript` bootstrap (`<script dangerouslySetInnerHTML={{ __html: initScript }} />`), which sets `history.scrollRestoration`, scroll position, and `document.body.dataset.motion`;
   - the JSON-LD block `<script type="application/ld+json">{personJsonLd}</script>` in `<head>`.
   Mechanism: a build step (a `scripts/*.mjs` invoked in the build chain) computes `sha256-<base64>` for the exact byte content of each known inline script and produces a typed, generated hash set that `lib/security/csp.ts` consumes for `script-src`. Production `script-src` becomes `'self' 'sha256-...' 'sha256-...'` with no `'unsafe-inline'`. The hash set is the single source for both the served policy and the regeneration test (Test strategy item 4), so the served hashes and the asserted hashes cannot drift.
   - Static-generation constraint to honor (already documented in `proxy.ts`): the inline scripts are build-time constants, so their bytes are stable across requests and hashes are valid for the whole deploy. This is the precondition that makes hash-based CSP feasible where nonces are not. If the build step finds an inline script whose content is not in the known set, it must fail the build (loud, not silent), so a new inline script cannot ship without a hash.
   - `style-src 'unsafe-inline'` stays for now (React `style={{}}` props emit inline `style=""` attributes; those are attribute-level, not `<script>`, and are out of scope for this hotfix). The locked decision is hash-based strict `script-src`, not strict `style-src`. State this scope boundary explicitly in the builder and STANDARDS.md.
4. Reconcile `STANDARDS.md` Chapter 9 in the same PR: correct the CSP claim so it describes the hash-based `script-src` with no `'unsafe-inline'`, names `lib/security/csp.ts` as the typed builder, and names the live production smoke assertion as the control that actually proves the header ships (replacing the false "held by the in-process unit test" claim). Update the deferral comments in `proxy.ts` that say hash-based CSP "is not feasible today" / "does not yet exist," since this PR builds exactly that step.
5. Add the live production header assertion to `.github/workflows/smoke.yml` (see Test strategy). This is the mastery flourish: the assertion that runs against production, encoding the lesson that a green unit test hid a live gap.

## Architecture

### New files

| Path | Purpose |
|---|---|
| `lib/security/csp.ts` | Typed CSP directive builder. `CspDirectives` type, `serializeCsp()`, and `buildCsp({ env, scriptHashes })`. Single serialization point; the only place the policy string is assembled. |
| `lib/security/inline-script-hashes.generated.ts` | Generated, committed typed hash set (`sha256-...` per known inline script). Produced by the build step; consumed by `lib/security/csp.ts` and asserted by the regeneration test. Generated, not hand-edited. |
| `scripts/generate-csp-hashes.mjs` | Build step. Computes `sha256-<base64>` of each known inline script's exact bytes, writes `inline-script-hashes.generated.ts`, and fails if an unknown inline script is present in the built HTML. Wired into the build chain so a hash change cannot be skipped. |
| `lib/security/csp.test.ts` | Unit test on the serialized policy output of `serializeCsp` / `buildCsp` (production has no `'unsafe-inline'` in `script-src`, contains the expected hashes, dev branch retains `'unsafe-eval'` + `va.vercel-scripts.com`). |
| `__tests__/csp-hashes.test.ts` | Regenerates the inline-script hash set from current `app/layout.tsx` source and asserts it equals the committed `inline-script-hashes.generated.ts`, so an inline-script edit fails loudly until hashes are regenerated. |

### Modified files

| Path | Purpose |
|---|---|
| `proxy.ts` | Replace the hand-joined `CSP_DIRECTIVES` array and `.join('; ')` with `serializeCsp(buildCsp({ env, scriptHashes }))` from `lib/security/csp.ts`. Production `script-src` loses `'unsafe-inline'` and gains the SHA-256 hashes. Update the deferral comments (§5 "hash-based CSP not feasible today") to reflect that the build step now exists. If diagnosis points here, also fix the wiring that prevents the proxy from running in production. |
| `next.config.ts` | Only if diagnosis (Step 3/4) shows `headers()` is the failing layer. Otherwise unchanged. Do not touch the layer proven to be working. |
| `__tests__/proxy-csp.test.ts` | Update assertions: production `script-src` must NOT contain `'unsafe-inline'` and MUST contain the expected `sha256-` hashes. The current `expect(csp).toContain("script-src 'self' 'unsafe-inline'")` becomes a hash-aware assertion. Keep the nonce-absence and determinism assertions. Add a comment that this in-process test does NOT prove production wiring (the smoke job does). |
| `.github/workflows/smoke.yml` | Add a step that `curl -sI` the live production URL and fails if `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy`, `permissions-policy`, or `reporting-endpoints` is absent, and fails if `script-src` still contains `'unsafe-inline'`. |
| `STANDARDS.md` | Chapter 9 reconciled to the hash-based posture and the live-smoke control. |
| `DECISIONS.md` | One-line ADR: hash-based strict CSP shipped, root cause of the prod gap, reversibility note. |

### Coordination note (avoid PR collision)

WS0 ADDS the production header assertion step to `smoke.yml`. WS5 (PR order 8) RETARGETS the smoke workflow at the production URL and fixes the healthz 308. The two PRs both edit `smoke.yml`. To avoid a collision: WS0 writes its header-assertion step against the canonical production URL `https://erikunha.dev` directly (the homepage step already uses it), so the step is independent of WS5's retargeting of the other steps. WS5 must rebase onto WS0 and preserve the header-assertion step verbatim when it restructures the workflow. Record this dependency in the WS5 spec when it is written.

## Error handling and edge cases

- Preview deploys with different origins. `proxy.ts` already builds `Reporting-Endpoints` from `new URL(request.url).origin`, so the report endpoint is correct on preview domains. The CSP `script-src` hashes are origin-independent (they hash script bytes, not URLs), so the same hashed policy is valid on preview and production. The live smoke step targets the canonical production URL only; it must not run against preview origins (the existing job already filters to `deployment.environment == 'Production'`). Do not assert the production hostname inside the CSP value.
- Inline-script churn breaking hashes. If anyone edits `initScript` or `personJsonLd` (or adds a new inline `<script>`) without regenerating hashes, two things must happen and both are required: (1) `__tests__/csp-hashes.test.ts` fails in CI because the regenerated set differs from the committed set; (2) the build step `scripts/generate-csp-hashes.mjs` fails if it finds an inline script in the built HTML whose hash is not in the known set. The first catches edits to known scripts; the second catches entirely new inline scripts. Without (2), a brand-new inline script would silently be blocked at runtime by the strict CSP (the failure would only surface as a broken page in production), which is exactly the false-green class this PR exists to kill. Whitespace and trailing-semicolon sensitivity: the hash is over exact bytes, so the generator and the served value must use the identical string source (import the same constant, do not re-stringify), or hashes will mismatch silently.
- HSTS already present. The fix must not duplicate or weaken HSTS. `next.config.ts` already declares it and it is the one header observed live; leave it intact.
- Build-step ordering. `scripts/generate-csp-hashes.mjs` must run such that `inline-script-hashes.generated.ts` is current before `proxy.ts` is compiled into the deploy. If it depends on built HTML, it runs post-`next build` and the result must be committed (the generated file is checked in), so production reads a committed, reviewed hash set rather than a build-time surprise. Prefer hashing the source constants directly over scraping built HTML if the constants are the authoritative bytes, to keep the generator deterministic and CI-stable.
- Dev vs production divergence. Dev `script-src` keeps `'unsafe-eval'` and `https://va.vercel-scripts.com` (HMR + analytics dev runtime). The hash set applies to both, but dev additionally keeps `'unsafe-inline'` only if HMR injects un-hashable inline scripts; verify during diagnosis whether dev needs `'unsafe-inline'` retained. Production must not.

## Test strategy

TDD: the failing test is written first, before any fix code.

1. FAILING-FIRST production assertion (the headline test). Add the live header check to `.github/workflows/smoke.yml`: `curl -sI https://erikunha.dev` and grep for each of `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy`, `permissions-policy`, `reporting-endpoints`; fail the job if any is missing, and fail if `script-src` contains `'unsafe-inline'`. Against the current live deploy this step FAILS today (only HSTS is present). It turns green only after the fix is deployed. This is the test that, had it existed, would have caught the gap.
2. Unit test on the serialized policy: `lib/security/csp.test.ts`. Assert `serializeCsp(buildCsp({ env: 'production', scriptHashes }))` produces a `script-src` with `'self'`, the expected `sha256-` hashes, and NO `'unsafe-inline'`; that the dev branch adds `'unsafe-eval'` and `https://va.vercel-scripts.com`; that every static directive from the current policy is present and in stable order. This is the typed-builder contract test.
3. Update `__tests__/proxy-csp.test.ts`: change the `script-src` assertion from `toContain("script-src 'self' 'unsafe-inline'")` to assert production `script-src` has no `'unsafe-inline'` and contains the hashes (import the hash set, do not hardcode). Keep nonce-absence, determinism, `report-to` / `report-uri`, and the `Reporting-Endpoints` absolute-URL assertions. Add an explicit comment that this test exercises the function in-process and does NOT prove production wiring; the smoke job does.
4. Hash-set regeneration test: `__tests__/csp-hashes.test.ts`. Recompute the inline-script hashes from the current source of `initScript` and `personJsonLd` and assert they equal the committed `lib/security/inline-script-hashes.generated.ts`. An inline-script change without regeneration fails this test loudly.
5. Local production-server check before relying on CI: `pnpm build && pnpm start`, then `curl -sI http://localhost:3000/` to confirm all six headers and the hashed `script-src` appear off-Vercel. This separates "code fixed" from "Vercel-layer fixed" per the diagnosis.
6. Full review battery and runtime gates per project rules before push: `pr-review-toolkit:review-pr` + `accessibility-tester` + `security-auditor` (mandatory, this touches `proxy.ts`) + `performance-engineer` + `dependency-manager`, then `pnpm ci:local` and `pnpm gates:runtime`. No visual baseline impact (no rendering change).

## Acceptance criteria

Each is independently verifiable.

1. Live `curl -sI https://erikunha.dev` returns `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=()`, `reporting-endpoints`, and `strict-transport-security` (HSTS retained).
2. The live `content-security-policy` `script-src` contains `'self'` and one `sha256-` hash per known inline script, and does NOT contain `'unsafe-inline'`.
3. The post-deploy smoke job fails if any of the six headers is absent or if `script-src` regains `'unsafe-inline'`. Verified by reading the workflow run on the deploy that ships this PR (it must go from red, on the pre-fix deploy, to green).
4. `lib/security/csp.ts` is the only place the CSP string is assembled; `proxy.ts` no longer holds a literal directive array. Verified by `proxy.ts` importing the builder and containing no `.join('; ')` policy literal.
5. `__tests__/csp-hashes.test.ts` fails when an inline script in `app/layout.tsx` is edited without regenerating hashes (demonstrate by a throwaway local edit during review, then revert).
6. The build fails if an unknown inline script is present (no silent runtime block). Demonstrated by the generator failing on an injected test script locally.
7. `STANDARDS.md` Chapter 9 describes the hashed `script-src` and names the live smoke assertion as the control; it contains no claim that the in-process unit test proves production enforcement.
8. The root cause is stated in one sentence in the PR body and commit message, identifying which layer (`proxy.ts` wiring, `next.config.ts` `headers()`, or Vercel platform) dropped the headers.
9. `pnpm typecheck && pnpm test --run && pnpm build` pass; full 5-agent review battery clean.

## Out of scope

- Nonce-based CSP. Rejected and locked at the program level. Nonces force per-request rendering: `app/page.tsx` is static-generated, so its inline scripts are baked at build time before any request and carry no nonce, and under CSP-3 §6.7.2.4 a nonce-source on `script-src` makes browsers ignore co-listed `'unsafe-inline'` and require a matching nonce on every inline script, blocking the static page entirely (the `proxy.ts` comment documents the verified 44 violations). Nonces also force dynamic rendering, which risks the sub-1.8s LCP budget. Hashes are the correct strict-CSP mechanism for a statically generated page; they require no per-request work and add no LCP cost.
- Strict `style-src`. `style-src 'unsafe-inline'` stays. React `style={{}}` props emit inline `style=""` attributes (attribute-level, not `<script>`); hashing those is a larger, separate effort with no security parity to the script vector and is not part of this hotfix.
- The Vercel-platform investigation beyond identifying and fixing the header-stripping cause, if that is where the loss occurs. Broader platform hardening is not in this PR.
- WS5's smoke retargeting and healthz 308 fix (separate PR; coordination noted above).

## Risks and open questions

- Root cause is genuinely unknown. The single largest risk is fixing the wrong layer. The diagnosis protocol is the mitigation: no fix code until Step 4 names the cause. Confidence that the protocol isolates the cause: high. Confidence in any specific pre-diagnosis hypothesis: low.
- Strongest pre-diagnosis hypothesis (stated, not committed). "Only HSTS live, and HSTS is the one header Vercel injects independently for custom domains" points toward `next.config.ts` `headers()` not applying at all AND `proxy.ts` not running, i.e. both application layers inert from a shared cause (the bottom-left cell of the Step 4 table). Treat this as the prior to falsify first, not the answer. Discriminator: if `pnpm build && pnpm start` + local `curl` shows the `next.config.ts` headers locally, the cause is the Vercel layer, not the code, and the hypothesis is wrong.
- Build-step determinism on the CI runner. If `scripts/generate-csp-hashes.mjs` scrapes built HTML, runner-vs-local HTML differences could shift hashes. Mitigation: hash the source constants directly (`initScript`, `personJsonLd`) rather than scraping HTML, so the input is the same bytes everywhere. Open question: is there any framework-emitted inline script (React Float / RSC bootstrap) that also needs hashing in production static HTML, beyond the two known author scripts? If yes, the build step must enumerate and hash those too, or the strict `script-src` will block them. This must be answered during diagnosis by inspecting the built static HTML for all inline `<script>` tags, not assumed. If framework inline scripts cannot be reliably hashed across builds, escalate before dropping `'unsafe-inline'`, because a strict `script-src` that misses a framework script would break the page in production.
- Reversibility. Medium. The header wiring fix is low-risk and easily reverted. Dropping `'unsafe-inline'` from `script-src` is the higher-blast-radius change: if a hash is wrong or incomplete, the page breaks (scripts blocked). The live smoke assertion plus the local production-server check are the safety net that catches this before users do. If a regression surfaces post-deploy, the immediate rollback is restoring `'unsafe-inline'` to `script-src` (one line in the builder input) while keeping the four static headers, which are independently safe.
- Dev `'unsafe-inline'` retention. Open: does Next 16 HMR inject inline scripts in dev that are not in the known hash set? If so, dev `script-src` must keep `'unsafe-inline'` (production must not). Resolve by checking the dev page console for CSP violations after the change.

## Architect-reviewer gate findings (folded 2026-06-04, GATE_RESULT: PASS)

The architect gate passed all four spec gates and independently verified the diagnosis prior: live HSTS is bare `max-age=63072000` with no `includeSubDomains; preload`, while `next.config.ts` declares the full directive. The mismatch proves `next.config.ts` `headers()` is not applying and Vercel injects its own bare HSTS, strengthening the "both application layers inert from a shared cause" hypothesis. These findings become explicit plan tasks:

1. Inline-script enumeration is first-order. The build step must enumerate EVERY inline `<script>` in the built static HTML (including React 19 Float / RSC flight-payload and hydration bootstrap scripts), not only the two author scripts `initScript` and `personJsonLd`. Dropping `'unsafe-inline'` is gated on that enumeration succeeding. If framework inline scripts vary per build (RSC payload hashes shift on content edits), strict `script-src` is infeasible: the escalation path fires, `'unsafe-inline'` stays for `script-src` this PR, and the four static headers plus a CSP report-only rollout are the fallback.
2. Dual hashing paths. Author scripts hash from their imported source constant (deterministic). Framework scripts, if any need hashing, have no source constant and must be scraped from built HTML. The plan resolves this fork during diagnosis.
3. Rollback is atomic. Reverting must remove the hashes AND restore `'unsafe-inline'` together. Restoring `'unsafe-inline'` while leaving hashes in place still blocks inline scripts under CSP-3.
4. Shared-cause probe. `next.config.ts` is wrapped in `analyze(withMDX(...))`. A config-load failure anywhere in that chain would explain BOTH `headers()` not applying and proxy wiring failing. Diagnosis inspects the Vercel build log for config-load errors, not just the local build.
5. Smoke propagation tolerance. The production header assertion must tolerate CDN propagation lag (retry with max-time) so it does not flake red on a correct deploy, while still failing hard on a genuinely missing header.
