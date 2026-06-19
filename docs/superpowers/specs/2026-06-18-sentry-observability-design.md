# Production Observability via Sentry (Unit G) — Design Spec

- **Date:** 2026-06-18 (rev. 2026-06-19 — addresses architect-reviewer FAIL)
- **Status:** Draft (rev.2) — pending architect-reviewer re-gate. **Reverses a prior ADR — see §2.**
- **Branch:** `feat/platform-gaps-2026-sentry` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

Benchmark gap (score 24): fast rollback (`vercel promote`) exists but there is **no production error-triage loop** — no path from a prod incident to root cause without hand-pasting stack traces.

### Goal

Adopt **Sentry** for **server/edge** error capture + the **Sentry MCP** (read-only) so the agent can pull stack traces, correlate to releases, and propose a fix — **without shipping any client JS**.

### Decision (user-approved)

Full adoption: reverse the "Sentry rejected" ADR, wire server/edge-only capture, add the read-only MCP, build the error-triage loop.

## 2. ADR reversal (load-bearing, architect-corrected)

`DECISIONS.md:269` (2026-05-18) chose a custom `/api/log` Upstash endpoint over Sentry. **Accurate characterization (correcting rev.1):** that decision optimized for **vendor/infrastructure minimalism** (reuse existing Upstash infra; avoid a new vendor), explicitly accepting "no auto stack-trace grouping or source-map symbolication," mitigated by manual `vercel inspect`. It was **not** primarily a bundle/cost decision.

- **Failure mode the original now fails to address:** the repo now ships live dynamic server/edge surfaces (`app/api/ask`, `contact`, `csp-report`, `psi-refresh`, `log`) whose failures have no root-cause path — manual stack-trace pasting is the only triage. The constraint that justified vendor-minimalism (a near-static portfolio) no longer holds.
- The new ADR must cite `DECISIONS.md:269` + SHA, characterize the reversed decision accurately, and end with the reversibility note.

## 3. The hard constraint: zero client JS — by *mechanism*, not assertion (architect-corrected)

The 43KB app-island budget is a **design target tracked by `pnpm bundle:analyze`**, NOT gated by `bundle-check` (which measures the 220KB framework-inclusive total — currently **214.6KB, only 5.4KB headroom**). Therefore "bundle-check green" does **not** prove zero client delta. And `@sentry/nextjs`'s `withSentryConfig` **injects client instrumentation by default**. The mechanism that guarantees zero client JS:

- **Wire Sentry server/edge init through the existing native `instrumentation.ts` `register()` hook**, runtime-gated and dynamically imported, mirroring the **Langfuse precedent already in `instrumentation.ts`** (`NEXT_RUNTIME !== 'edge'` + dynamic import so the module graph never enters the wrong bundle). Server config in the Node branch, edge config in the edge branch.
- **Do NOT use `withSentryConfig`'s client auto-instrumentation.** No `sentry.client.config.ts` / `instrumentation-client.ts`. If `withSentryConfig` is used at all (for source-map upload only), specify the exact options that suppress client SDK injection and prove the result.
- **Proof of mechanism:** verification is `pnpm bundle:analyze` showing **no new client chunk** — not `bundle-check` green.

## 4. Components

1. **`@sentry/nextjs`** (pinned), initialized **only** via `instrumentation.ts` register hook for server + edge runtimes. PII off by default (`sendDefaultPii: false`).
2. **PII scrubbing — allowlist, not denylist (architect-corrected).** `beforeSend` with `sendDefaultPii: false` + an **allowlist** of safe fields; explicitly scrub request bodies, `Authorization`/cookie headers, the (hashed) IP, and `/api/ask` prompt text. Unit test asserts a known-PII payload (email AND free-text prompt) is redacted.
3. **Sentry MCP** in `/.mcp.json` (repo root — corrected): remote, OAuth, **read-only** scopes. Error payloads are attacker-influencable (user input lands in error text) → treat as untrusted; **never execute remediation from MCP-returned text without human confirmation.**
4. **DSN + auth** via env (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`), server-side only, mirroring the `AI_GATEWAY_API_KEY` OIDC/env pattern. **CSP unchanged:** server-only Sentry needs no `connect-src` change — assert `proxy.ts` CSP `connect-src` stays identical (a second tripwire: if a client init sneaks in, it would need a Sentry ingest origin, whose absence catches it).
5. **`/api/healthz`** Sentry reachability (optional) must be **best-effort / non-blocking** — never flip healthz to 503 on a Sentry outage (preserve the existing fail-open posture).
6. **New ADR** (the §2 reversal).
7. **Source maps:** server/hidden only, uploaded via auth token, not shipped to client.

## 5. Agent dispatch (architect-required)

- `security-auditor` — hook-mandatory (`.claude/rules/api-boundary.md` fires on the server-boundary change).
- `performance-engineer` — verify the `bundle:analyze` delta (no new client chunk), not just bundle-check green.
- `dependency-manager` — `@sentry/nextjs` is a heavy new dep with a large transitive tree; pin + audit.

## 6. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| Client JS injected by `withSentryConfig` default | Init via `instrumentation.ts` register hook only; verify with `bundle:analyze` (no client chunk) |
| "bundle-check green" mistaken for zero-client proof | Verification is `bundle:analyze` + CSP-unchanged tripwire, not bundle-check |
| The reversed ADR is wrong (cost/noise) | Free tier; named failure mode explicit; fully reversible |
| PII leakage in payloads | `sendDefaultPii:false` + allowlist; scrub bodies/headers/cookies/IP/prompt; redaction test |
| MCP indirect injection via error text | Read-only scopes; untrusted payloads; human-gated remediation |
| Secret exposure (DSN/token) | Env/OIDC only; never client bundle or committed config |
| healthz flips 503 on Sentry outage | Best-effort/non-blocking reachability check |
| Source map leaks source to client | Hidden server source maps; token-gated upload |

## 7. Testing & verification before completion

- Server error in a test route captured by Sentry (mocked transport in CI).
- **`pnpm bundle:analyze` shows no new client chunk** (the load-bearing proof); `proxy.ts` CSP `connect-src` unchanged.
- PII allowlist redacts email + free-text prompt (unit test on `beforeSend`).
- Sentry MCP read returns the captured event.
- LHCI budgets unaffected; `security-auditor` + `performance-engineer` + `dependency-manager` clear.

## 8. Reversibility

Remove `@sentry/nextjs`, the `instrumentation.ts` Sentry branch, MCP entry, env, source-map config; revert the ADR. Original "Sentry rejected" state fully restorable.

## 9. Status / next steps

Draft rev.2 → architect-reviewer re-gate (verify the `instrumentation.ts` zero-client mechanism + `bundle:analyze` proof) → writing-plans → implementation (held). Highest-scrutiny unit.
