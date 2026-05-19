# Portfolio Audit — Principal/Staff Pass

> **Subject:** erikunha.dev portfolio
> **Date:** 2026-05-19
> **Scope:** every layer (architecture, security, performance, a11y, types, tests, AI, DX, SEO/AEO)
> **Bar:** masterpiece reference standard
> **Method:** nine specialist subagents (architect, security, performance, a11y, typescript, test, ai, dx, seo) dispatched in parallel; findings synthesized via socratic debate on the five contested decisions.

---

## 0 · Executive verdict

This codebase is **already in the top decile of personal portfolios**: detailed budgets enforced in CI, explicit ADR log, multi-runtime gate stack, zero npm tracker tax, real edge architecture, and the right Principal-level moves at the macro level (no CMS, no CAPTCHA, no design-system extraction, no GraphQL — all rejected with reasons).

What's keeping it from being a *reference standard* is **drift between the docs and the code**. ARCHITECTURE.md describes a slightly different system than the one deployed. That drift creates three classes of damage simultaneously:

1. The security pitch is undercut by documented controls that don't exist (identical-question gate, prompt-injection sanitization, honeypot field).
2. The perf pitch is undercut by a single page-level `await` that opts the entire route out of CDN cache and is the actual root cause of the 3069 ms mobile LCP — not the CSS link the team has been chasing.
3. The AI-engineering pitch is undercut by a `cache_control: 'ephemeral'` directive that silently never hits because the system prompt is below Anthropic's 1024-token Haiku minimum.

**The single most valuable PR sequence**, in order of leverage:

| # | Change | Mechanism | Expected effect |
|---|---|---|---|
| 1 | Remove `await getIsMobileForRequest()` from `app/page.tsx:31` | Reverts route to static generation; CDN edge serves shell | Mobile LCP 3069 ms → ≈ 2000-2300 ms |
| 2 | Delete the CSP nonce machinery in `proxy.ts` + hoist static CSP to module scope | No reader for `x-nonce`; nonce token in CSP matches zero scripts | Cleaner security story + edge work removed per nav |
| 3 | Implement the 3 documented controls on `/api/ask` + `/api/contact` | Closes the doc-vs-code drift that *invalidates the security pitch* | Re-aligns artifact with claim |
| 4 | Pad the SYSTEM prompt above 1024 tokens by assembling from `content/*.ts` at build time | Anthropic Haiku ephemeral cache only triggers ≥ 1024 tokens — cache directive currently pays for nothing | ~90% input-token reduction per cached call |
| 5 | Move 8 `'use client'` files to `*.client.tsx` + add Biome custom rule + lazy-mount Footer | RSC discipline becomes provable | 43 KB client budget enforceable |

---

## 1 · The 12 themes (cross-agent convergence)

### Theme 1 — Doc-vs-code drift (the credibility issue)
**Leverage: maximum · Proof: 4 agents converged**

The biggest single risk to the artifact. An external reviewer can spot the drift in five minutes.

| # | Drift | Severity |
|---|---|---|
| 1.1 | `ARCHITECTURE.md` §6 lines 298-299 claim `/api/ask` rejects `system/role/assistant` tokens — `app/api/ask/route.ts:184-205` does not | Critical |
| 1.2 | `ARCHITECTURE.md` §6 claims identical `q` from same IP within 60 s is rejected — no such gate in code | Critical |
| 1.3 | `ARCHITECTURE.md` §7 + §1 promise a Server Action `/contact/action.ts` for progressive enhancement — file does not exist; `app/api/contact/route.ts` is the actual implementation and requires JS | High |
| 1.4 | `ARCHITECTURE.md` §7 + `lib/contact-validation.ts` claim a `field_company` honeypot — `components/client/ContactForm.tsx` does not render it; validator does not check it | Critical |
| 1.5 | `ARCHITECTURE.md` §2 + §9 claim a daily Vercel cron → PSI → KV — no `vercel.json` crons entry; cache fills lazily on the first `/api/lighthouse` GET after TTL → first unlucky visitor pays an 8 s PSI fetch in the LCP critical path | High |
| 1.6 | `ARCHITECTURE.md` §4 specifies `lib/observability/`, `lib/seo/`, `lib/edge/`, `lib/contact/`, `lib/ask/`, `lib/motion/` directories — actual `lib/` is flat with 16 sibling files | Medium |
| 1.7 | `ARCHITECTURE.md` §3 reserves "Tone.js" client-island budget — no `tone` in `package.json`, no `Tone` import anywhere | Low |
| 1.8 | `CLAUDE.md` claims a Vitest test enforces "Matrix loop must use `useRef.textContent` not `useState`" — no such test exists; `__tests__/matrix-rain.test.ts` tests a different component | High |
| 1.9 | `public/robots.txt` declares `Sitemap: https://erikunha.com.br/sitemap.xml` but deployment is `erikunha.dev` | Critical |

### Theme 2 — The CSP nonce Potemkin village
**Leverage: high · Proof: 3 agents converged**

`proxy.ts:5-46` does substantial work on every page request that produces zero security benefit and tells a false security story:

- `crypto.randomUUID()` → `Buffer.from(...).toString('base64')` per request
- `NextRequest` headers cloned, `x-nonce` set
- New `NextResponse` rewritten
- CSP includes `script-src 'self' 'nonce-${nonce}'`

**No code reads `x-nonce`.** `grep -r 'x-nonce'` returns one writer, zero readers. There is no `<script nonce={...}>` in the codebase. `app/layout.tsx:362` renders the JSON-LD as `<script type="application/ld+json">` with no nonce. The `/init.js` bootstrap is external (covered by `'self'`).

Subtle bug at `proxy.ts:5`: `Buffer.from(crypto.randomUUID()).toString('base64')` base64-encodes the **36-char UUID string** (with hyphens), not 16 random bytes. Entropy is the UUIDv4's 122 bits, under the CSP "≥ 128 bits" spec.

**Verdict (see Debate 1):** Hybrid fix — drop the `x-nonce` request-header rewrite, fix the entropy primitive, hoist static CSP to module scope, keep the nonce token in the CSP string with a comment "no consumer today; intentional — DECISIONS.md YYYY-MM-DD".

### Theme 3 — The real LCP killer (not CSS)
**Leverage: maximum · Proof: 1 agent + verified against build artifact**

DECISIONS.md attributes the 3069 ms mobile LCP to `render-blocking-resources` (the CSS link). That diagnosis is **partial and misleading**. Lighthouse reports only ~150 ms savings for deferring the CSS link — the LCP gap is 1269 ms.

The actual mechanism:

```ts
// app/page.tsx:31
const initialIsMobile = await getIsMobileForRequest();  // ← calls headers()
```

Calling `headers()` in the page RSC opts the **entire route** out of static generation. Every request becomes a live SSR round-trip. Under mobile simulate (562 ms `requestLatencyMs`) this adds 600-1000 ms to TTFB. The page can never be served from the Vercel CDN edge cache.

`initialIsMobile` is only used by `BreakpointProvider` to set the SSR snapshot for `useSyncExternalStore`. Its only practical effect is which chrome variant renders on first paint. The four sections that actually need UA detection (`ProjectsSection`, `GitLogSection`, `GuitarSection`, `VisaSection`) call `getIsMobileForRequest()` internally with `React.cache()` deduplication.

| Single optimization | Expected LCP delta |
|---|---|
| Remove page-level dynamic | -750 to -1000 ms |
| Defer `globals.css` | -150 ms |
| `inter-900.woff2` → `display: 'optional'` | -50 to -100 ms CLS path |
| Mount `MatrixRain` only when `!reducedMotion` | -30 ms INP |

### Theme 4 — RSC discipline is a slogan, not a system
**Leverage: high · Proof: 2 agents converged**

ARCHITECTURE.md §3 says "every client file ends in `.client.tsx`." Reality:

| File | `'use client'`? | Ends in `.client.tsx`? |
|---|---|---|
| `components/AppShell.client.tsx` | ✅ | ✅ |
| `components/ErrorBoundary.client.tsx` | ✅ | ✅ |
| `components/sections/Footer.tsx` | ✅ | ❌ |
| `components/responsive/CRTOverlay.tsx` | ✅ | ❌ |
| `components/responsive/DesktopTopbar.tsx` | ✅ | ❌ |
| `components/responsive/Dock.tsx` | ✅ | ❌ |
| `components/responsive/MatrixRain.tsx` | ✅ | ❌ |
| `components/responsive/StatusBar.tsx` | ✅ | ❌ |
| `components/responsive/MobileTitleBar.tsx` | ✅ | ❌ |
| `components/responsive/Module.tsx` | ✅ | ❌ |

8 client components don't follow the convention. There is no Biome custom rule, no `scripts/check-client-naming.mjs`, no CI gate.

**Bonus offender:** `components/sections/Footer.tsx` carries `'use client'` AND lives in `components/sections/` (RSC directory). It has 5 `useState`, 5 `useEffect`, a `MatrixRain` canvas, and a `setInterval` uptime counter. It hydrates immediately on every page load.

### Theme 5 — The API surface is 5 hand-rolled ladders
**Leverage: medium-high · Proof: 1 agent**

| Route | Order | Envelope | X-Request-Id? |
|---|---|---|---|
| `/api/ask` | limit → parse | `{ error }` or stream | ✅ |
| `/api/contact` | parse → limit | `{ ok: true }` / `{ error }` | ❌ |
| `/api/log` | parse → limit | `{ error, issues }` | ❌ |
| `/api/log/forget` | parse → limit | `{ ok: true, deleted }` | ❌ |
| `/api/erik.json` | force-static + dynamic Cache-Control header | data | ❌ |

The GDPR/LGPD erasure flow at `/api/log/forget` cannot correlate to a contact-form failure or an `/api/log` entry because only `/api/ask` exposes the request-id header. The `{ ok: true, deleted: 1 }` shape is also an existence oracle.

**Verdict (see Debate 3):** Extract a small `defineHandler({ schema, rateLimit, handler })` bounded to parse → rate-limit → envelope → log emission. Standardized envelope `{ ok, requestId, data?, error? }`. Documented scope in DECISIONS.md so future contributors don't grow it.

### Theme 6 — `lib/` is a flat junk drawer
**Leverage: medium**

16 files mixing server-only (log, ask-log, ip-hash, rate-limit, lighthouse-scores, contact-validation) and client-only (motion, error-bridge, use-breakpoint, breakpoint, boot-animation, stream-protocol). `lib/use-breakpoint.tsx` (React hook) sits next to `lib/ip-hash.ts` (server crypto).

Move to `lib/server/`, `lib/client/`, `lib/shared/`. Cheap rename, zero behavior change.

### Theme 7 — The AI feature is sub-Principal-grade
**Leverage: maximum for hiring narrative · Proof: 2 agents converged**

The portfolio targets *applied-AI roles specifically*. The `/api/ask` implementation has Principal-grade scaffolding but several mechanisms are silently broken:

| Finding | Mechanism | Fix |
|---|---|---|
| **Prompt cache silently never hits** | SYSTEM is ~750 tokens; Anthropic ephemeral cache min for Haiku is **1024 tokens**. | Assemble SYSTEM at build time from `content/*.ts` to push above 1024 tokens. ~90% input-token reduction per cached call. |
| **SYSTEM ↔ content drift** | The SYSTEM string is hand-typed Markdown; `content/perf-receipts.ts` has data SYSTEM doesn't reference. | Build-time assembly fixes both this and the cache (one PR). |
| **No abort propagation** | `route.ts:199` calls `anthropic.messages.create` without `signal: req.signal`. Client disconnects mid-stream still burn output tokens. | Forward AbortSignal end-to-end. |
| **Client doesn't abort either** | `InteractiveShell.tsx:166` `fetch` has no `AbortController`. Rapid commands cause orphan streams writing to removed DOM nodes. | Add AbortController, cancel on command switch. |
| **Cache token usage not tracked** | `incrementBudget(inputTokens, outputTokens)` ignores `cache_read_input_tokens` and `cache_creation_input_tokens`. | Track all four counters. |
| **Budget increment is fire-and-forget post-`controller.close()`** | On Edge that can be killed by request lifecycle. | Use `waitUntil()` or Next 15 `after()`. |
| **No eval loop** | 90-day Q+A log in Upstash is write-only. For an applied-AI pitch this is the *loudest* miss. | Build `pnpm ask:eval` that samples N recent questions, replays against current SYSTEM, scores against a rubric. |
| **No prompt-injection sanitization** | `route.ts:184-205` only truncates at 500 chars. | Delimited `<question>` block + regex reject on jailbreak markers. |
| **Shell UX** | No streaming cursor, no Up/Down history, no Tab completion. | ~30 LOC closes all three. |

### Theme 8 — Security gaps beyond Theme 1's doc drift
**Leverage: high · Proof: security-auditor**

- **High** — Budget counter accounting in `finally{}` undercharges on partial client disconnect. Fix: **reservation pattern** — INCRBY worst-case `max_tokens` before the call, refund after.
- **High** — Rate-limit + budget both **fail-open** on Redis outage (`lib/rate-limit.ts:89-93`). Out-of-band Anthropic spend alert is the only fail-closed control today.
- **High** — `style-src 'unsafe-inline'` enables CSS exfiltration. Replace JSX `style={{}}` with classes; drop `'unsafe-inline'`.
- **High** — `app/api/contact/route.ts:64` uses Resend sandbox sender `onboarding@resend.dev`. Production should be a verified domain with SPF/DKIM/DMARC.
- **Medium** — `/api/log` per-IP cap (10/min) doesn't bound sustained volume.
- **Medium** — `/api/log/forget` returns `{ deleted: count }` → existence oracle. Always return `{ ok: true }`.
- **Medium** — `connect-src https://va.vercel-scripts.com` in all envs — gate behind `NODE_ENV !== 'production'`.

### Theme 9 — Accessibility polish
**Leverage: medium**

- **High — InteractiveShell streaming via `textContent` mutation**. Screen readers do NOT receive `aria-live` partial-update announcements for mutated text on the same node — they wait and announce only the final value. WCAG 4.1.3 technically met, spirit violated. Fix: emit completed chunks as discrete `.shell__line` elements appended to history.
- High — ContactForm honeypot missing (Theme 1.4).
- Medium — `RoleTyper.tsx` rotates role names via `textContent` mutation behind `role="img"` + `aria-label`.
- Medium — MOTION toggle missing `aria-pressed={motionOn}` for state announcement.
- Low — `shell__chips` has `role="toolbar"` but no arrow-key navigation.
- Low — `Module.tsx` mobile `<details><summary>` without explicit heading; screen-reader heading nav skips mobile sections.

### Theme 10 — Test rigor: behavior vs source-grep
**Leverage: high · Proof: test-automator**

Several tests "pass" without testing what their name implies:

- **Critical** — `__tests__/budget-cap.test.ts` asserts that string `checkBudget` appears before `anthropic.messages.create` by string index in source. Passes if `checkBudget` is in a comment or dead branch.
- **Critical** — `__tests__/ask-killswitch.test.ts` has the same weakness.
- **Critical** — The CLAUDE.md "useRef vs useState" matrix-loop enforcement test **does not exist**. `__tests__/matrix-rain.test.ts` tests a different component.
- **High** — `tests/e2e/observability-smoke.spec.ts` issues real `request.post('/api/log')` hitting real Upstash in CI — violates the documented "no real services in CI" posture.
- **High** — `e2e-full` job is marked non-required → visual regression + INP guard never block merge.
- **High** — mock-backend's `ask: 'happy'` mock delivers entire body as one chunk via `route.fulfill({ body })` — no test exercises real chunked SSE streaming.
- **Medium** — `tests/a11y/axe.spec.ts:21` uses `page.waitForTimeout(500)` — guaranteed flake source on slow CI.

### Theme 11 — TypeScript drift
**Leverage: low-medium · Proof: typescript-pro**

- **High** — `content/shell-commands.ts` and `content/dmesg.ts` declare `: Type[] =` annotation WITHOUT calling `Schema.parse()` at module load. Runtime guard only via `scripts/validate-content.mjs`. Other content files all parse at import.
- **High** — `lib/stream-protocol.ts` exports only a sentinel constant; no discriminated union shared between server and client. Protocol contract is twice-described.
- **Medium** — `app/api/contact/route.ts:34` `body as Record<string, unknown>` cast adds no safety.
- **Medium** — Several `(err as Error).message` casts where `instanceof Error` is the right idiom.
- **Low** — `components/sections/GitLogSection.tsx:17` `c.date.split(' ')[0]` is `string | undefined` under `noUncheckedIndexedAccess`; template literal coerces silently.

### Theme 12 — SEO/AEO gaps for the 2026 recruiter agent
**Leverage: medium · Proof: seo-specialist**

- **Critical** — `public/robots.txt` sitemap URL wrong domain.
- **High** — `/llms.txt` should explicitly link to `/api/erik.json` with format hint + version.
- **High** — `/api/erik.json` HiringProfile missing: `roles_seeking`, `team_preferences`, `interview_process`, `timezone`, `work_constraints`.
- **Medium** — `app/sitemap.ts` returns only root URL.
- **Medium** — Twitter card uses static fallback instead of dynamic OG.
- **Medium** — Terminal-styled section headings keyword-invisible to crawlers. Compensate via JSON-LD intensification (FAQPage on HottestTakes, Article on Manpage) rather than rewriting the brand.

---

## 2 · Five debates (Socratic)

### Debate 1 — Should we kill the CSP nonce machinery?

**FOR:** Dead code that lies about the security posture. Per-request UUID + base64 + Headers clone for nothing. The `'self'` directive is doing all the matching.

**AGAINST:** Removing optionality — re-implementation cost when analytics or embeds eventually land. The entropy bug is a 4-line patch, not a reason to delete the mechanism.

**VERDICT: Modify, don't delete.** Drop the unused `x-nonce` request-header rewrite, fix the entropy primitive (16 random bytes, not the UUID string), hoist static CSP to module scope, keep the nonce token in the CSP string with a comment "no consumer today; intentional". Confidence: high.

### Debate 2 — Should we drop the page-level `await getIsMobileForRequest()`?

**FOR:** Largest LCP regressor in the codebase. Removing it converts the perf claim from aspirational to true.

**AGAINST:** Static-generate introduces a chrome flash on every mobile load. Layout flash undermines the aesthetic discipline that IS the brand. Real fix is `<Suspense>` + `unstable_postpone()`, not a cheap remove.

**VERDICT: Drop the await. Mitigate FOUC with an `init.js`-style pre-paint script (pattern already exists for `data-motion`). File Suspense restructure as a follow-up.** Expected LCP: 2200-2400 ms. Confidence: high.

### Debate 3 — Should we extract `defineHandler`?

**FOR:** Five routes is the canonical DRY threshold. Inconsistent envelopes propagate. Missing `X-Request-Id` everywhere breaks GDPR correlation.

**AGAINST:** Custom abstractions are notoriously sticky. Each route's envelope reflects semantics. The portfolio brand is "what we don't build."

**VERDICT: Extract a small `defineHandler`, but bound the abstraction.** Scope: input parse → rate-limit (in this order) → envelope `{ ok, requestId, data?, error? }` → log emission. Do NOT include response composition or error classification. Confidence: medium-high.

### Debate 4 — Should we enforce `.client.tsx` naming + lazy-mount Footer?

**FOR:** The convention is documented; the audit just established it's false. Enforcement is 1 hour of work.

**AGAINST:** The `'use client'` directive is its own marker. Custom Biome rules are overhead.

**VERDICT: Enforce.** Rename 8 files, add a Biome custom rule (or `scripts/check-client-naming.mjs`), separately lazy-mount Footer. Confidence: high. Key factor: the documentation already commits to the property.

### Debate 5 — Should we assemble the `/api/ask` SYSTEM prompt at build time from `content/*.ts`?

**FOR:** Fixes three problems simultaneously — cache (currently dead), drift, applied-AI demonstration.

**AGAINST:** Build-time codegen is exactly the indirection brand-promised against. The cache savings are cents per month. Editorial voice vs raw data are different communication channels.

**VERDICT: Pad SYSTEM above 1024 tokens (mandatory — the cache directive is currently dead). Use a hybrid:** keep the hand-edited narrative, append raw-data sections from 2-3 content files at build time, add a CI consistency-check test asserting SYSTEM doesn't reference metrics absent from content. Confidence: medium.

---

## 3 · Reference standards (the masterpiece guidelines)

These ten standards are the durable rules the audit established. Codified in `CLAUDE.md` alongside the dispatch matrix.

### Standard 1 — Doc-vs-code is a CI gate, not a discipline
- Every claim in `ARCHITECTURE.md` that mentions a file path, function name, or numeric budget MUST be verifiable by a script in `scripts/audit/`.
- `scripts/audit/check-architecture-claims.mjs` runs in CI, parses the doc, asserts each named artifact exists.
- ADR entries in `DECISIONS.md` describing code changes MUST reference the SHA they shipped in.

### Standard 2 — The `'use client'` boundary is named and CI-enforced
- Every file with `'use client'` MUST end in `.client.tsx`.
- A Biome custom rule or `scripts/check-client-naming.mjs` gates this.
- No file ending in `.client.tsx` may export an `async function` (RSC reserved).

### Standard 3 — One API envelope
- Every `/api/*` route returns `{ ok: true, requestId, data? } | { ok: false, requestId, error: { code, message, issues? } }`.
- Every route sets `X-Request-Id` header.
- Every route does `rate-limit → parse → validate → handle`, in this order.
- Centralized via `lib/server/route.ts` `defineHandler({ schema, rateLimit, handler })`.

### Standard 4 — No dead-code security theater
- Every CSP directive MUST have at least one consumer or be deleted.
- Every cache directive MUST verifiably activate (test: at runtime, log `cache_read_input_tokens > 0` within first 24h of deploy).
- Every claimed kill switch MUST have a Vitest **behavioral** test that exercises it, not a source-grep test.

### Standard 5 — Tests assert behavior, not source layout
- No `__tests__/*.ts` may use `indexOf` on file source to verify ordering.
- Every CI-gated behavioral claim has a Playwright spec that calls the endpoint and asserts the response.
- The `e2e-full` matrix is REQUIRED, not promote-after-stable.

### Standard 6 — Performance budgets bind in the smallest unit
- Bundle gate measures **application-only** JS (excluding Next framework bootstrap). 43 KB ceiling matches the doc.
- LCP gate is `≤ 1800 ms` on the calibrated mobile profile, no warn-mode.
- Any route opting out of static generation (calling `headers()`, `cookies()`, etc.) requires an explicit ADR entry justifying the dynamic cost.

### Standard 7 — AI features are measured, not asserted
- The `/api/ask` Q+A log is read by `pnpm ask:eval` weekly (or on every SYSTEM-prompt change).
- Eval rubric: cited a real receipt; did not fabricate; ≤ 200 words; refused if off-topic.
- Regression deltas committed to `DECISIONS.md` alongside the SYSTEM change.
- SYSTEM prompt MUST be ≥ 1024 tokens for the Haiku ephemeral cache to fire; cache hit rate (`cache_read_input_tokens / input_tokens > 0.7` in steady state) is a tracked metric.

### Standard 8 — Accessibility is a unit test, not an axe scan
- Every interactive client component has a Vitest test asserting: tab order, focus visibility, keyboard activation, screen-reader announcement.
- Streaming UI emits discrete DOM nodes per chunk (NOT `textContent` mutation on a shared node) so `aria-live` fires per update.

### Standard 9 — DX is measured in seconds per commit
- Pre-commit runs **only** `pnpm check` + the copilot-sync conditional (sub-second).
- `pre-push` runs `typecheck + validate-content + test` (~25 s before push, not per commit).
- `pnpm verify` is the named pre-PR command.
- `validate-content` runs one `tsx` subprocess that imports all content files, not 17.

### Standard 10 — Reproducibility is the default
- Every dep pinned to a major-locked range (`^16.2.6`, not `latest`) in `package.json`.
- `pnpm-lock.yaml` is the SOT; `pnpm install --frozen-lockfile` is the CI install.
- `strip-next-polyfills.mjs` verifies the target file's checksum before overwriting; if mismatch, fail loud.

---

## 4 · Prioritized fix roadmap

Each PR is bounded to ~2-3 hours of focused work. Each PR's ADR entry is one bullet.

| PR | Title | Themes | Effect |
|---|---|---|---|
| 1 | `fix: static-generate /, fix robots domain, fix critical doc drift` | 1, 3, 12 | LCP -750 ms, robots correct, doc aligned |
| 2 | `fix(security): implement documented controls + reservation budget` | 1, 8 | Identical-question gate, prompt-injection regex, honeypot field, budget reservation pattern |
| 3 | `chore(csp): hybrid nonce — drop x-nonce header, fix entropy, static CSP module` | 2, 8 | Truthful security artifact + entropy fix |
| 4 | `feat(ai): build-time SYSTEM assembly + cache verification + ask:eval` | 7 | Cache fires, drift eliminated, AI measured |
| 5 | `refactor(lib): split server/client/shared + defineHandler` | 5, 6 | Clean layering, unified envelope, requestId everywhere |
| 6 | `refactor(client): rename .client.tsx, Biome rule, lazy Footer` | 4 | RSC discipline enforceable |
| 7 | `test: replace source-grep tests with behavioral specs, promote e2e-full` | 10 | False-positive tests eliminated, INP guard blocks merge |
| 8 | `chore(dx): two-tier hooks, fast validate-content, CI cache .next` | DX | Per-commit tax 25-40s → <2s |

PRs 1-3 are the credibility-restoring set. PR 4 is the applied-AI signal. PRs 5-8 are reference-standard hardening.

---

## 5 · What this audit proves

A hiring reviewer reading this audit alongside the deployed site should walk away knowing:

- The author runs Principal-grade audits on their own work — this document is itself the artifact.
- The author distinguishes documented claims from implemented behavior — the most expensive Principal-level skill to teach.
- The author can debate themselves and arrive at a discriminator-first verdict — each of the five debates ends with one recommendation, not three "consider the tradeoffs" hedges.
- The author treats AI features with the same rigor as security features — the prompt-cache mechanic is taken as seriously as the CSP nonce.
- The author has standards that survive the next round of changes — the 10 standards above are the contract the next PR is held to.

That is the Staff/Principal hire. The audit is the proof.

---

*— end of document —*
