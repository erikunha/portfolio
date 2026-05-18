# Production Harness Hardening — Gates & Stop-Loss

> **Spec 1 of 3** in the post-audit harness trilogy.
> Companion to `2026-05-18-production-observability-design.md` (Spec 2) and `2026-05-18-llm-provider-abstraction-design.md` (Spec 3).
>
> **Author:** Erik Henrique Alves Cunha
> **Date:** 2026-05-18
> **Status:** Draft (pending architect-reviewer four-gate)
> **Source:** 8-pillar production-harness audit, this session, against the framework from João Lucas Moreira Tardim's Anatomia de um Harness de Produção.

---

## 1. Purpose

Address the four highest-leverage findings from the 2026-05-18 8-pillar audit, scoped to **CI gates** and **stop-loss controls**. Two sibling specs cover observability (Spec 2) and the LLM provider abstraction (Spec 3); deliberately out of scope here.

The pattern across all four fixes: **make the implicit explicit**. The audit found promises (in CLAUDE.md, in DECISIONS.md) that were not yet enforced in the harness itself. This spec converts those promises into either runtime constants or CI assertions.

---

## 2. Scope

### In scope (four fixes)

| # | Fix | Pillar | Audit reference |
|---|---|---|---|
| 1 | Mobile LHCI gate (parallel CI job, mobile-tuned thresholds) | 4 — Gates | "The single big hole: `lighthouserc.json` runs `"preset": "desktop"` only" |
| 2 | Explicit Anthropic + Resend client timeouts | 6 — Resiliência | "Missing: explicit Anthropic + Resend client timeouts" |
| 3 | `ASK_ENABLED` env-var kill switch for `/api/ask` | 5 — Limites | "No `ASK_ENABLED=false` env-var kill switch. If abuse spikes, you must redeploy or wait for per-IP limit." |
| 4 | Claude harness permissions lockdown (committed baseline + drop risky entries) | 5 + 8 — Limites + Sandbox | "`.claude/settings.local.json` has `defaultMode: bypassPermissions`. The 40 explicit allowlist entries are decorative" |

### Out of scope (handled by other specs or deferred)

- **Spec-rot CI gate** — deferred to dedicated spec; design surface (what counts as "drift", how to handle historical plans) warrants its own brainstorm.
- **LLM provider abstraction** (Vercel AI Gateway, `lib/llm-provider.ts` seam) — Spec 3.
- **Vercel Analytics + Speed Insights wiring** — Spec 2.
- **Error tracking (Sentry / custom)** — Spec 2.
- **`/api/ask` answer + question logging** — Spec 2 (depends on its observability primitives).
- **CSP `style-src 'unsafe-inline'` removal** — depends on React inline-style audit, separate effort.
- **Worktree isolation as workflow default** — separate concern, lower-priority audit follow-up.

### Anti-goals (explicit non-goals)

- Will **not** add CAPTCHA (per DECISIONS.md 2026-05-13).
- Will **not** add Sentry in this spec (deferred to Spec 2).
- Will **not** add live-toggle infrastructure (Vercel Edge Config, Redis-flag) for the kill switch — env var is sufficient at single-author scale.
- Will **not** rewrite the rate-limit module — the per-IP + monthly-token-cap design is sound.
- Will **not** tighten desktop LHCI thresholds beyond current values — mobile gate is the immediate win; desktop tuning is separate effort.

---

## 3. Reversibility profile

Every fix in this spec is single-commit-revertable. No data migrations, no schema changes, no destructive operations.

| Fix | Reversal |
|---|---|
| Mobile LHCI gate | Delete the new job from `.github/workflows/ci.yml`; delete `lighthouserc.mobile.json` |
| API timeouts | Remove `timeout:` option from Anthropic init; remove `Promise.race` wrapper from Resend call |
| ASK_ENABLED kill switch | Remove env-var check from route handler; unset/`true` makes it a no-op |
| Permissions lockdown | `git rm .claude/settings.json`; restore deleted entries in `.claude/settings.local.json` |

---

## 4. Fix 1 — Mobile LHCI gate

**Pillar:** 4 (Gates).
**Outcome:** Mobile regressions caught pre-merge.

### What

Add a second Lighthouse-CI gate that runs against the mobile preset with mobile-tuned thresholds, in parallel with the existing desktop gate.

### Where

- **New file:** `lighthouserc.mobile.json` — sibling to existing `lighthouserc.json`, identical structure with `"preset": "mobile"` and loosened TBT/TTI thresholds.
- **Modified:** `.github/workflows/ci.yml` — new `lhci-mobile` job, parallel to `build-and-gate` (no `needs:`). Runs: install → build → start server → `pnpm lhci autorun --config=lighthouserc.mobile.json`.
- **Modified:** `package.json` — current `lhci` script gains `--config=lighthouserc.json` (explicit); new `lhci:mobile` script for symmetric local runs.

### Threshold delta from desktop config (TARGETS, pending calibration)

| Assertion | Desktop (existing) | Mobile (target) |
|---|---|---|
| `categories:performance` | ≥ 0.95 | ≥ 0.95 |
| `categories:accessibility` | = 1.0 | = 1.0 |
| `categories:best-practices` | ≥ 0.95 | ≥ 0.95 |
| `categories:seo` | = 1.0 | = 1.0 |
| `largest-contentful-paint` | < 1800 | < 1800 |
| `cumulative-layout-shift` | < 0.05 | < 0.05 |
| `total-blocking-time` | < 200 | < 400 |
| `interactive` | < 2500 | < 3500 |
| `render-blocking-resources` | `warn` | **`error`** |

The single per-mobile difference in assertion severity (`render-blocking-resources: error`) is intentional: that finding is the exact one that prompted today's perf pass. Promoting it to error on mobile prevents recurrence.

**These mobile thresholds are TARGETS, not measured.** Implementation MUST start with a calibration step before the workflow PR opens (see §11 for the explicit step). The calibration runs `pnpm lhci autorun --config=lighthouserc.mobile.json` locally against current `main` for 3 runs, takes the p50, adds 20% headroom, and bakes the result into `lighthouserc.mobile.json`. If observed-p50 already exceeds these targets, the spec author must either (a) loosen thresholds to `observed_p50 × 1.2` or (b) open a follow-up perf PR before the gate ships — never (c) merge the gate at unmet thresholds, which would create the "turn off the gate to merge" anti-pattern explicitly forbidden in CLAUDE.md.

### Failure mode

Job fails the PR. Same severity as desktop LHCI today. No bypass path.

### Edge case

Vercel cold-start variance can inflate a single LHCI run. The existing `numberOfRuns: 3` (median) already mitigates; carry over to the mobile config.

---

## 5. Fix 2 — Anthropic + Resend client timeouts

**Pillar:** 6 (Resiliência).
**Outcome:** No upstream call can occupy a warm function instance indefinitely.

### What

Bound every upstream HTTP call to a maximum wall-clock duration with an explicit, named constant.

### Where

- **`app/api/ask/route.ts:9`** — change `new Anthropic()` to `new Anthropic({ timeout: 30_000 })`.
  - 30s covers normal Haiku-4.5 streams (typical: <10s; cap with `max_tokens: 512` already in place).
  - **Keep the SDK default `maxRetries: 2`.** Stream initialization is idempotent — no SSE events have been emitted to the client before the first `content_block_delta`, so retrying the initial handshake on a transient 5xx is safe and absorbs short-lived upstream blips without surfacing them as user-visible errors. Once the stream starts, the SDK no longer retries (correct: retries would re-emit text). The 30s timeout is the resource-bound guarantee; retries are the user-experience guarantee. Earlier draft of this spec proposed `maxRetries: 0` — rejected after architect-review because it offered no measurable protection (no observed retry-storm evidence) and exported every transient blip directly to users.
- **`app/api/contact/route.ts:58-64`** — wrap `getResend().emails.send(...)` in `Promise.race` against `setTimeout(10_000)`. Resend SDK v6 does not accept `AbortSignal` natively; race pattern is the cleanest workaround.
  - On timeout, treat as Resend error: existing `catch` at `route.ts:68-70` logs `[contact] resend unavailable` with `msgId`; durability-first design (KV write before send) means client still receives `{ ok: true }`.

### Failure modes

| Source | Behavior |
|---|---|
| Anthropic timeout during stream init | Existing `try/catch` at `app/api/ask/route.ts:167-169` writes `STREAM_ERR_SENTINEL` to the stream. Client (`InteractiveShell.tsx`) strips the sentinel and renders a typed error line. **Zero new client-side code.** |
| Anthropic timeout mid-stream (no per-chunk watchdog) | Not handled by this fix. See edge case below. |
| Resend timeout | Existing catch path. Message persisted in KV with `msgId` for manual recovery. Client receives `{ ok: true }`. |

### Edge case (documented, out of scope)

Streaming responses don't tick the SDK timeout per-chunk. If Anthropic stops sending data mid-stream but the TCP connection stays open, the 30s timeout doesn't fire. Mitigation requires a per-chunk watchdog (`setTimeout` reset on each `content_block_delta`). Acceptable to defer: not observed today, addressable later as `Spec 1 follow-up` if it manifests.

---

## 6. Fix 3 — `ASK_ENABLED` env-var kill switch

**Pillar:** 5 (Limites).
**Outcome:** One-flag emergency stop for `/api/ask` without code change; ~60-90s Vercel redeploy round-trip.

### What

An environment-variable check at the top of the `/api/ask` `POST` handler. Any "off" keyword (case-insensitive, trimmed) returns 503 with the email-fallback message; any other value or unset keeps the route live.

### Where

- **`app/api/ask/route.ts`** — add early check before rate-limit + budget calls (so a kill-switch trip doesn't cost a Redis round-trip):
  ```ts
  // Kill switch: any "off" keyword (case-insensitive, trimmed) disables the route.
  // Asymmetry is intentional: a typo during a billing/abuse emergency must STILL
  // disable the route. The cost of "stays on accidentally" during a cost incident
  // is exactly what this switch exists to prevent.
  const askFlag = (process.env.ASK_ENABLED ?? '').trim().toLowerCase();
  const OFF_KEYWORDS = new Set(['false', '0', 'off', 'no', 'disabled']);
  if (OFF_KEYWORDS.has(askFlag)) {
    return Response.json(
      { error: 'temporarily unavailable — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }
  ```
  Also add a cold-start log line at module scope so deploy logs prove the env var landed without grepping Vercel config:
  ```ts
  // Module scope, runs once per warm instance:
  console.info('[ask] kill-switch on cold start:', process.env.ASK_ENABLED ?? 'unset');
  ```
- **`.env.example`** — add `ASK_ENABLED=true` (documented default) with a comment listing the off-keywords (`false | 0 | off | no | disabled`, case-insensitive).
- **`ARCHITECTURE.md §6`** (the `/api/ask` deep-dive) — append a "Kill switches" subsection documenting the flag, its semantics, and the cold-start log line.
- **`DECISIONS.md`** — one bullet dated 2026-05-18 capturing the choice of env-var over Edge Config or Redis flag (rationale: 90s redeploy acceptable for cost-emergency scenarios; live-toggle infra not justified at this scale). One bullet capturing the off-by-keyword semantics with the explicit asymmetry rationale.

### Semantics

| `ASK_ENABLED` after `.trim().toLowerCase()` | Result |
|---|---|
| `'false'`, `'0'`, `'off'`, `'no'`, `'disabled'` | **Disabled** (503 + email-fallback message) |
| `'true'`, `'1'`, `'on'`, `'yes'`, `'enabled'`, any other value, **unset** | Enabled |

Rationale for the asymmetric strictness: this is a **kill switch**, not a feature flag. During a cost or abuse incident the operator is reaching for the off lever; if their typing varies (`FALSE`, `0`, `off`, `disabled`), the route must STILL disable. The opposite asymmetry ("typos default to enabled") was rejected at architect-review: it inverts the purpose of the control. False-positive disablement (typing `'no'` when meaning to enable) is recoverable in 60-90s via env-var edit + redeploy; false-negative non-disablement during a billing emergency is exactly the outcome the switch exists to prevent.

### Failure mode

None new. The fallback message matches the existing budget-cap fallback at `app/api/ask/route.ts:127`, so the client UI (`InteractiveShell.tsx` error-line renderer) handles it with zero changes.

### Edge case

Build-time env vars are baked into the static build. `/api/ask` has `export const dynamic = 'force-dynamic'` (`route.ts:6`), so `process.env.ASK_ENABLED` is read at request time. Verified safe.

---

## 7. Fix 4 — Claude harness permissions lockdown

**Pillars:** 5 (Limites) + 8 (Sandbox).
**Outcome:** Documented project-level security baseline; destructive entries no longer one accidental tool call away.

### What

Establish a committed project baseline (`.claude/settings.json`) for Claude Code permissions; drop the three destructive `Bash(...)` entries from the personal local config; replace `bypassPermissions` with `acceptEdits` so the allowlist actually gates execution.

### Where

**New file (committed):** `.claude/settings.json`
```json
{
  "permissions": {
    "allow": [
      "Skill(superpowers:brainstorming)",
      "Skill(superpowers:writing-plans)",
      "Skill(superpowers:verification-before-completion)",
      "Skill(superpowers:systematic-debugging)",
      "Skill(commit-commands:commit)",
      "Skill(commit-commands:commit-push-pr)",
      "Skill(code-review:code-review)",
      "Skill(pr-review-toolkit:review-pr)",
      "Skill(security-review)"
    ],
    "defaultMode": "acceptEdits"
  }
}
```

Rationale: minimum project-mandated allowlist. Every entry is a skill named in CLAUDE.md's agent or skill dispatch table. Any fresh clone or contributor gets `acceptEdits` (auto-approve file edits, prompt for everything else). No personal preferences leak into version control.

**Modified file (local, gitignored):** `.claude/settings.local.json`
- **Remove** these three entries:
  - `"Bash(rm -rf .git)"`
  - `"Bash(git init *)"`
  - `"Bash(git branch *)"`
- **Remove** `"defaultMode": "bypassPermissions"` so the project baseline (`acceptEdits`) takes effect.
- Keep everything else (browser MCPs, thinking-* skills, etc. — machine-local personal preferences).

**Settings inheritance** (Claude Code documented model): project `settings.json` is loaded, then local `settings.local.json` merges and overrides. Effective config on Erik's machine = project baseline + personal additions.

### Failure mode

In `acceptEdits`, any tool not in the merged allowlist prompts for approval. Trade-off: more prompts for ad-hoc commands; benefit: destructive surprises require explicit consent.

### Edge case

If a one-off scenario genuinely needs `rm -rf .git` (e.g., re-init from scratch), single prompt-and-approve is acceptable. Not worth keeping in the durable allowlist.

---

## 8. Testing strategy

| Fix | Test surface | Test type | Location |
|---|---|---|---|
| 1 — Mobile LHCI gate | The gate is the test. Verify via (a) green job on baseline PR, (b) intentional-regression PR (e.g., 200KB CSS bloat) fails it. | CI smoke + manual regression | `.github/workflows/ci.yml` job result |
| 2 — Anthropic timeout | Mock the Anthropic SDK to reject after >30s; assert response stream ends with `STREAM_ERR_SENTINEL` prefix. | Vitest unit | new `__tests__/ask-timeout.test.ts` |
| 2 — Resend timeout | Not separately unit-tested. Existing `__tests__/contact-validation.test.ts` covers the graceful-fail integration shape; timeout re-uses that path. | Trusted by existing coverage | n/a |
| 3 — ASK_ENABLED kill switch | `process.env.ASK_ENABLED='false'` → POST → assert 503 + fallback message. | Vitest unit | new `__tests__/ask-killswitch.test.ts` |
| 4 — Permissions lockdown | Not automatically testable. Verified by: (a) `.claude/settings.json` committed, (b) local file no longer contains the 3 risky entries or the `bypassPermissions` line, (c) fresh Claude session in this repo resolves `defaultMode` to `acceptEdits`. | Manual + commit review | n/a |

**Explicit non-tests** (named so reviewers don't request them):
- No load test on the LHCI gate.
- No "timeout during streaming" test (out of scope per Fix 2 edge case).
- No fuzz on `ASK_ENABLED` env-var values — `'false'` is the only off signal by design.

---

## 9. Success criteria

Binary checks; each must hold before merge.

1. CI on the implementing PR shows three jobs green: `build-and-gate` ✓, `lhci-mobile` ✓, `e2e` ✓.
2. `pnpm vitest run __tests__/ask-timeout.test.ts __tests__/ask-killswitch.test.ts` → 2 new tests pass; pre-existing 54 tests still pass.
3. `.claude/settings.json` committed; `.claude/settings.local.json` has no entries matching `/^Bash\((rm -rf \.git|git init |git branch )/` and no `"defaultMode": "bypassPermissions"` line. The effective merged allowlist is inspectable via the documented recipe (see criterion 8).
4. `app/api/ask/route.ts` contains the `ASK_ENABLED` off-keyword check above the rate-limit call **and** the module-scope cold-start log line; `.env.example` documents the flag with its off-keywords.
5. `ARCHITECTURE.md §6` updated with the "Kill switches" subsection. `DECISIONS.md` has one new bullet for the `ASK_ENABLED` env-var choice, one bullet for the kill-switch off-by-keyword semantics, and one bullet for the permissions lockdown — all three dated 2026-05-18.
6. **Production-config verification** (replacing the previous criterion 6, which was a manual checklist not CI-verifiable): the cold-start log line from §6 emits in Vercel runtime logs on the first request after deploy. Operator confirms `ASK_ENABLED` value is what was intended by inspecting the log line, not by inspecting the env-var dashboard. The log line is the deploy-time proof; the env-var dashboard is the source-of-truth. (The previous "set `ASK_ENABLED=true` explicitly in Vercel" instruction is now a *post-merge ops checklist item*, not a success criterion — it's a one-time human action, not a code property.)
7. Existing CI bundle gate (`< 320 KB client total`) still passes; no regression from new test dependencies.
8. **Effective Claude permissions are inspectable.** The repo includes a documented one-liner (in `ARCHITECTURE.md §13` under "Claude harness configuration", a new subsection):
   ```bash
   jq -s '(.[0].permissions.allow + (.[1].permissions.allow // [])) | unique' \
     .claude/settings.json .claude/settings.local.json 2>/dev/null
   ```
   Running this prints the effective merged allow-list. Optional for the implementer: a `scripts/print-claude-permissions.mjs` wrapper, but the `jq` recipe is sufficient for the criterion.
   Recipe corrected post-implementation 2026-05-18: original spec text used `.[0].permissions + (.[1].permissions // {}) | .allow` which jq evaluates as object-merge (overwrites allow arrays on conflict) rather than array union. Current recipe correctly concatenates and dedupes.

---

## 10. Risks + reversibility

| # | Risk | Likelihood | Severity | Mitigation | Reversal effort |
|---|---|---|---|---|---|
| R1 | Mobile LHCI flakes on Vercel cold start → PR fails intermittently | Medium | Low | Existing `numberOfRuns: 3` (median) absorbs single-run variance | Trivial — delete job from `ci.yml` |
| R2 | 30s Anthropic timeout shorter than legitimate long answer → 503s users mid-stream | Low | Medium | Haiku-4.5 typical completes <10s; `max_tokens: 512` caps duration; 30s = 3× headroom | Trivial — bump timeout constant |
| R3 | `ASK_ENABLED` accidentally typo'd in prod env (`'true '` w/ space, `'TRUE'`, etc.) → unintended state | Low | Medium | Only literal `'false'` disables. Typos default to enabled | Trivial — env edit + redeploy |
| R4 | `acceptEdits` causes prompt-fatigue for routine Bash → temptation to restore `bypassPermissions` | Medium | Medium (defeats the fix) | Local `settings.local.json` can add commonly-used safe Bash entries (`pnpm *`, `git status`, etc.) per-machine after observing real friction | Reversible — restore the line in local file; document the choice in DECISIONS if you do |
| R5 | A skill or hook that needs one of the dropped `Bash(...)` entries breaks silently | Low | Low | Run a full real session post-change (commit, push) to verify standard workflow; prompts that fire identify the gap | Trivial — add entry to local allowlist with a "why" comment |
| R6 | Mobile thresholds (TBT < 400, TTI < 3500) prove unachievable on first CI run despite today's perf pass | Medium | **Medium** (was Low) | Resolved upstream by the §11 calibration step: thresholds are not finalized in `lighthouserc.mobile.json` until local 3-run p50 against current `main` confirms feasibility with 20% headroom. The PR opening the workflow change MUST include the calibration evidence in its description. If calibration shows targets are unmet, fix the underlying perf issue before opening the gate PR — never ship the gate at known-failing thresholds | Trivial — adjust `lighthouserc.mobile.json`, but the calibration step prevents needing this reversal |

**Aggregate reversibility:** single-commit-revertable. No data migrations, no schema changes, no destructive operations.

---

## 11. Recommended implementation order

Informative for the plan-writing skill; final order may shift on dependency analysis.

1. **Fix 4 — Permissions lockdown.** Smallest, no test surface, validates inheritance model first. Establishes the "fresh-session smoke test" workflow for later fixes.
2. **Fix 3 — ASK_ENABLED.** Adds new test, simple env-var read, exercises the new vitest workflow.
3. **Fix 2 — API timeouts.** Adds new test, modifies existing route handlers; validate sentinel path end-to-end.
4. **Fix 1 prep — Mobile LHCI calibration.** Before any CI workflow change: run `pnpm lhci autorun --config=lighthouserc.mobile.json` locally against current `main` for 3 runs. Capture observed p50 for `total-blocking-time`, `interactive`, `largest-contentful-paint`. Compute `observed_p50 × 1.2` as the bake-in threshold. Decision branch:
   - If `observed_p50 × 1.2 ≤` the targets in §4 → use the §4 targets (the site already meets them).
   - If `observed_p50 × 1.2 >` a §4 target → either loosen `lighthouserc.mobile.json` to `observed_p50 × 1.2` for that assertion, OR open a follow-up perf PR to fix the underlying issue before the gate PR opens. Never ship the gate at known-failing thresholds.
   The calibration evidence (the 3-run output) MUST be included in the gate PR description.
5. **Fix 1 ship — Mobile LHCI workflow change.** With calibrated thresholds locked in `lighthouserc.mobile.json`, add the `lhci-mobile` parallel job to `ci.yml` and the `lhci:mobile` script to `package.json`. Validated last after smaller changes confirm CI health.

---

## 12. References

- 8-pillar production-harness framework: João Lucas Moreira Tardim's "Anatomia de um Harness de Produção (Os 8 Pilares)"
- `CLAUDE.md` — operating contract (stack, gates, dispatch matrix)
- `ARCHITECTURE.md §6` — `/api/ask` deep dive (current state pre-Fix 3)
- `ARCHITECTURE.md §13` — Deployment + CI/CD (current state pre-Fix 1)
- `DECISIONS.md` 2026-05-13 — Anthropic monthly hard cap rationale (relates to Fix 3)
- `DECISIONS.md` 2026-05-18 — CSP cleanup (adjacent context for Fix 4)
- Today's session audit output — full 8-pillar scorecard with evidence per pillar
