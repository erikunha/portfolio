# Platform Mastery Program: Design Spec

> Status: REVISED (2026-06-04) — WS0 dissolved (false-positive CRITICAL); WS1 is now PR 1. See "Correction" below.
> Date: 2026-06-04
> Author: Erik Cunha
> Origin: full AI-native engineering audit, 2026-06-04 (this session)
> Delivery: independent small PRs to `main`, WS1 first
>
> **Shipped status (2026-06-04):** WS1 merged (#88 — `lib/env.ts` + single `ASK_MODEL` + hardened polyfill strip). WS6 merged (#89 — `scripts/check-doc-drift.mjs` + ARCHITECTURE.md tree truth-up). WS0 dissolved (false positive; residual header smoke folded into WS5). Remaining: WS2, WS3, WS4, WS5, WS7. Per-workstream specs live alongside this file.

## Correction (2026-06-04, post-verification)

Live verification against the **canonical** production host falsified WS0's CRITICAL finding.
The audit (and the architect-reviewer gate) measured `curl -sI https://erikunha.dev` (apex)
without following the 308 redirect to `https://www.erikunha.dev`; a 3xx response carries only
redirect-layer headers. On the canonical 200 response all seven security headers are present and
correctly shaped (HSTS matches `next.config.ts:37` byte-for-byte). CSP is enforced, `headers()`
applies, and STANDARDS.md Ch.9 is accurate. The "locked" plan to drop `script-src 'unsafe-inline'`
via hashes is infeasible (≈202 content-volatile RSC inline scripts) and was already rejected and
documented in `proxy.ts:37-40` + DECISIONS.md 2026-05-15. WS0 is **dissolved**; its one real
residual (a canonical-host header smoke) folds into WS5. See
`2026-06-04-ws0-prod-security-hotfix-design.md` → Resolution for the full write-up. The table,
locked decisions, WS0 section, and sequencing below are corrected accordingly.

## Purpose

Close every finding from the 2026-06-04 platform audit, and do so at a depth that makes
this repository a working reference of principal-level engineering. The optimization
target is deliberately not "minimal viable." It is "another engineer studies this to learn
how the technique is done correctly." The one constraint that survives that reframe: depth
goes into demonstrative surfaces (gates, tooling, tests, docs) freely, but anything added to
the live request path must justify its failure surface. Showcase rigor in CI; restraint in prod.

## Context: what the audit found

One verified critical, several real-but-low-severity gaps, and a class of fragility.

| Severity | Finding | Status |
|---|---|---|
| ~~CRITICAL~~ FALSE POSITIVE | ~~Production serves only HSTS...~~ Falsified 2026-06-04: the audit measured the apex 308-redirect, not the canonical `www` 200, which carries all seven headers correctly. CSP enforced; Ch.9 accurate. The only residual is the already-rejected `script-src 'unsafe-inline'` drop (infeasible: ≈202 volatile RSC inline scripts). | WS0 DISSOLVED → header smoke folds into WS5 |
| Medium | No Zod env schema at boot. Missing `AI_GATEWAY_API_KEY` / `UPSTASH_*` fail lazily on first request, not at deploy. | WS1 |
| Medium | Model string `anthropic/claude-haiku-4-5` hardcoded in both `route.ts` and `ask-eval.ts`. The eval gate can grade a different model than ships. | WS1 |
| Medium | `strip-next-polyfills.mjs` monkey-patches `node_modules` and silently no-ops if Next reorganizes the target path (repo just moved to Next 16). | WS1 |
| Low | `/api/ask` model output streams to client with no validation (length, shape, system-prompt-leak). | WS2 |
| Low | No prompt versioning. Eval results cannot be correlated to a prompt revision except by git blame. | WS2 |
| Low | AI telemetry is lagging (last CI eval), not live. | WS2 / WS5 |
| High (fragility) | Many "hard gates" in CLAUDE.md are honor-system. The `.review-passed` stamp proves `review:stamp` ran, not that five agents ran. `architect-reviewer`-before-`writing-plans`, `security-auditor`-on-API-edits, `gates:runtime`-before-push have no backing artifact. | WS4 |
| Medium (drift) | ARCHITECTURE.md file tree references 6+ paths that no longer exist. (The earlier "STANDARDS.md Ch.9 is false" claim is itself false — Ch.9 is accurate; see WS0 Resolution. Verify each remaining drift claim against current code, not the stale audit tree.) | WS6 |
| Low (DX) | CLAUDE.md (~234 always-loaded lines) carries procedures that belong in on-demand skills. | WS7 |

Process note: the audit's parallel research agents read the local working tree, which was 2
commits behind `origin/main`. PRs #86/#87 had already shipped healthz, post-deploy smoke,
`.nvmrc`, and full-SHA action pinning. Those are NOT gaps. The first action in this program
is `git pull`. Audit agents should pin to `origin/main`, captured as a routing lesson in WS6.

## Locked decisions

1. **Delivery:** independent small PRs to `main`, one per workstream, WS1 first. No integration branch. Each workstream ships the moment it is green.
2. **Gate enforcement (WS4):** make every claimed gate mechanically real. No honor-system gates survive.
3. ~~**CSP strategy (WS0):** hash-based strict CSP.~~ REVERSED 2026-06-04. Hash-based strict `script-src` is infeasible on this static Next 16 / React 19 app (≈202 content-volatile RSC inline scripts; a strict `script-src` blanks the page on any unhashed script). `script-src 'unsafe-inline'` stays — a documented, accepted constraint (`proxy.ts:37-40`, DECISIONS.md 2026-05-15). Nonce-based remains rejected (forces dynamic render). CSP is already enforced in prod.
4. **AI observability (WS5):** AI SDK `experimental_telemetry` feeding the Vercel AI Gateway dashboard, plus a Langfuse span processor wired behind an env flag (off in prod by default). Per-request tracing on demand, no mandatory hot-path dependency.
5. **Hook implementation (WS4):** sophisticated hook types (`agent` / `prompt`) for semantic gates, not brittle transcript greps.

## Explicitly out of scope (rejected with reason)

These were considered and rejected because they add live-path failure surface or maintained
complexity disproportionate to a single Haiku endpoint, and would make the reference *worse*
by modeling cargo-cult over-building:

- Nonce-based CSP (forces dynamic rendering, risks the sub-1.8s LCP budget)
- Always-on self-hosted OTel collector pipeline (always-on hot-path dependency)
- Model routing, provider failover, fallback-model state machine (single-vendor endpoint with a kill switch is the correct design)
- New subagents beyond the existing six (codebase too small to justify them; the real gap is enforcement that they ran, addressed in WS4)
- MCP server expansion (maps to products not in use)
- A managed prompt-versioning platform (git + derived hash is sufficient at one endpoint)
- Memory architecture, incident-response rotations, AI cost-governance tooling

## Workstreams

Each workstream is one PR. Acceptance criteria are behavioral. TDD per project standards:
the failing test is written first.

### WS0 — DISSOLVED (was: production security hotfix)

**Status:** removed 2026-06-04. The CRITICAL premise was a false positive (apex-redirect vs
canonical-host measurement error; full write-up in the WS0 spec → Resolution). CSP and all
headers are enforced in prod; Ch.9 is accurate; the `'unsafe-inline'` drop is infeasible and
already rejected.

**Salvaged residual → folded into WS5:** add a post-deploy smoke step that `curl -sIL` the
**canonical** production host and fails if any of the seven security headers is absent or
mis-shaped. This is the control whose absence let the false positive hide. No application-code,
`proxy.ts`, `next.config.ts`, or STANDARDS.md change is warranted.

### WS1 — Boot-time config integrity (small, high-value)

**Closes:** no env Zod schema; duplicated model string; strip-polyfills silent no-op.

**Approach:**
1. `lib/env.ts`: hand-rolled Zod schema parsed once at module load (no new dependency, showcases the pattern). Required vars throw at boot with a precise message; optional vars typed. Exports a typed `env` object; every `process.env.*` read migrates to it.
2. `lib/ask/model.ts`: single `ASK_MODEL` const. `route.ts` and `ask-eval.ts` both import it. Kills eval-drift at the source.
3. `strip-next-polyfills.mjs`: assert the target file exists and matches the expected shape; throw (not warn, not no-op) if not.

**Mastery flourish:** a test asserting that omitting a required env var throws at import time, proving the fail-at-boot contract.

**Acceptance:** missing required env fails `pnpm build`. Grep proves zero direct `process.env` reads for managed vars outside `lib/env.ts`. Model string exists in exactly one source location.

### WS2 — AI feature hardening (showcase)

**Closes:** no output validation; no prompt versioning; lagging telemetry (live half).

**Approach:**
1. `lib/ask/output-guard.ts`, two layers:
   - Streaming pass-through guard: scans chunks for system-prompt-leak sentinels and enforces the length cap mid-stream, aborting the stream with the existing `STREAM_ERR_SENTINEL` on violation. Streaming UX preserved.
   - Post-hoc full-answer validation: runs on the buffered answer, logged, feeds the eval corpus as a regression signal.
2. Prompt versioning: `PROMPT_VERSION` derived as a content hash of assembled `SYSTEM_TEXT` (cannot drift from the actual prompt). Logged per request, stamped into `ask:eval:latest`.
3. `experimental_telemetry: { isEnabled: true }` on the `streamText` call.

**Mastery flourish:** the prompt version is *derived*, not hand-bumped. The system makes the lie (stale version tag) impossible.

**Acceptance:** a crafted leak-attempt answer is aborted mid-stream (behavioral test). `ask:eval:latest` carries the prompt hash. Gateway dashboard shows token/latency/spend.

### WS3 — Eval and AI-quality elevation (showcase)

**Closes:** corpus depth; judge calibration; model-drift assertion.

**Approach:**
1. Expand `content/ask-eval-corpus.ts` with output-validation cases.
2. Judge-calibration gate: a small set of human-labeled gold cases the LLM judge must agree with, failing if judge-vs-human agreement drops below threshold. Catches judge drift.
3. Model-drift assertion: a test failing if `route.ts` and the harness reference different model strings (trivial after WS1, but asserted).
4. Optional: snapshot regression for deterministic refusal strings.

**Mastery flourish:** judge calibration is the LLM-as-judge invariant most teams skip. Including it signals understanding of judge failure modes.

**Acceptance:** calibration gate runs in the `ai-eval` CI job and fails on judge drift. Model-drift test passes.

### WS4 — Make every gate mechanically real (biggest scope)

**Closes:** honor-system gates.

**Approach (sophisticated hook types):**
1. **API-edit security gate:** `PostToolUse` on `app/api/**`, `lib/rate-limit.ts`, `proxy.ts`. Blocks the next push until `security-auditor` ran (transcript-verified via an `agent`-type verifier hook).
2. **architect-before-writing-plans gate:** `PreToolUse` intercepting `writing-plans`; blocks unless `architect-reviewer` returned `GATE_RESULT: PASS`.
3. **5-agent-battery verification:** `review:stamp` refuses to write `.review-passed` unless the transcript shows all five agents dispatched. The stamp stops being a rubber stamp.
4. **gates:runtime in pre-push** for non-docs changes.
5. Any CLAUDE.md claim that cannot be backed by an artifact is downgraded to "convention" in the same PR. No claim outlives its enforcement.

**Mastery flourish:** semantic gates use `agent` / `prompt` hook types to inspect whether required agents genuinely ran, rather than grep heuristics.

**Acceptance:** each gate blocks live (verified by a real attempt, not its printed message, per the project's exit-2 rule). CLAUDE.md gate language matches what is mechanically enforced.

### WS5 — Observability and ops truth (ops)

**Closes:** healthz 308 in prod; smoke against CI localhost not prod; AI telemetry visibility.

**Approach:**
1. `/api/healthz`: re-verify against the canonical host first. `curl https://www.erikunha.dev/api/healthz` currently returns **503 `degraded`** (`psiLastRun: null`) — the apex "308" in the original note was the canonical redirect, not the real issue. Decide whether `degraded` is correct (PSI never ran) or the check is mis-reporting, and fix the true cause.
2. Point post-deploy smoke at the deployed **canonical** production URL (follow redirects / use `www`), not the apex.
3. **Salvaged from WS0:** add a smoke step that `curl -sIL` the canonical host and fails if any of the seven security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Reporting-Endpoints, HSTS) is absent or mis-shaped, tolerating CDN propagation lag with a bounded retry. This is the regression guard whose absence let the WS0 false positive hide.
4. Langfuse span processor behind an env flag (off by default in prod), consuming the WS2 telemetry. On only for debugging.

**Acceptance:** `curl https://www.erikunha.dev/api/healthz` returns the intended status (200 healthy, or `degraded` only when a dependency genuinely is). Smoke exercises the canonical production deploy and fails on any missing security header. Langfuse traces appear when the flag is on, nothing changes in the hot path when off.

### WS6 — Documentation truth and drift control (reference integrity)

**Closes:** ARCHITECTURE.md stale tree; STANDARDS.md reconciliation; plan-checkbox rot; audit-against-origin lesson.

**Approach:**
1. Fix the ARCHITECTURE.md file tree to current reality.
2. `scripts/check-doc-drift.mjs`: parses the ARCHITECTURE.md file tree and fails CI if any referenced path does not exist. Drift becomes a build failure. (The scoped, lightweight cousin of the rejected meta-framework, aimed at the highest-drift artifact.)
3. Update the 2026-06-03 reliability plan checkboxes to reflect shipped work.
4. Record two audit-methodology lessons in memory: (a) audits pin to `origin/main`, not the working tree; (b) live HTTP-header verification must follow redirects to the canonical host — a 3xx response carries only redirect-layer headers (the root cause of the WS0 false positive).

**Acceptance:** `check-doc-drift.mjs` is a CI gate and passes. No stale paths remain.

### WS7 — Claude Code architecture refactor (DX)

**Closes:** CLAUDE.md bloat.

**Approach:** extract `pr-merge-gate`, `visual-baseline-regen`, and `ai-eval-update` procedures from CLAUDE.md into project-local skills under `.claude/skills/`. CLAUDE.md retains standing facts and the high-frequency rules. Each extracted skill follows progressive-disclosure structure (SKILL.md under 200 lines, references one level deep).

**Acceptance:** CLAUDE.md line count materially reduced. Each extracted skill invocable and self-contained. No behavioral rule lost (only relocated).

## Sequencing and PR plan

`git pull` (sync local main) is the precursor to everything. WS0 is dissolved (see Correction);
its salvaged header smoke rides WS5.

| Order | PR | Gates that must pass | Visual baseline impact |
|---|---|---|---|
| 1 | WS1 config integrity | ci:local + build | none |
| 2 | WS6 doc truth + drift gate | ci:local (docs + new gate) | none |
| 3 | WS4 gate enforcement | ci:local + live hook-block verification | none |
| 4 | WS7 CLAUDE.md refactor | ci:local | none |
| 5 | WS2 AI hardening | ci:local + ai-eval | none |
| 6 | WS3 eval elevation | ai-eval (incl. calibration gate) | none |
| 7 | WS5 observability + ops (incl. salvaged canonical-host header smoke) | ci:local + post-deploy smoke against canonical prod | none |

Rationale for order: WS1 and WS6 are low-risk foundations and now lead. WS4 lands before the AI
workstreams so the new enforcement covers them. WS2 depends on WS1 (shared model const, env).
WS3 depends on WS2 (output-validation cases). WS5 depends on WS2 (telemetry) and carries the
WS0 residual. No workstream touches a visual-regression baseline, so no baseline regen is
required across the entire program.

## Per-workstream verification protocol

Every PR runs the full 5-agent review battery before push (pr-review-toolkit:review-pr,
accessibility-tester, security-auditor, performance-engineer, dependency-manager), then
`pnpm ready-for-pr`, per existing project rules. WS4 and WS5 additionally require live
verification (live hook-block attempts for WS4; canonical-host prod curl for WS5's header smoke)
because their correctness is not provable by unit tests alone. Live curls in any workstream MUST
use `-L` / the canonical `www` host — the lesson of the dissolved WS0.

## Open question for implementation phase

WS4 hook type default is `agent` / `prompt` (sophisticated). If portability of the hooks to
a plain-shell environment becomes a requirement, fall back to `command` hooks with explicit
transcript inspection. Decide per-hook at implementation time.
