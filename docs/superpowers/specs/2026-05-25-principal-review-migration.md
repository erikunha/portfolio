# Principal Engineer Review — Migration Plan
**Date:** 2026-05-25  
**Scope:** Comprehensive fresh review of erikunha.dev (10 agents: code, a11y, security, perf, deps, CSS/DX, type-design, silent-failure, test, architecture)  
**Goal:** All findings below are candidates. Review and call off what you don't want. Everything else goes into a single PR separate from #52.

---

## P0 — Critical (bugs in production right now)

### P0-1: Contact form delivery silently fails for unverified recipients
**File:** `app/api/contact/route.ts`  
**Finding:** `from: 'onboarding@resend.dev'` is Resend's sandbox sender. Resend restricts delivery to the account owner's verified email only. Every contact form submission appears to succeed (200 OK) but emails sent to any other recipient are silently dropped by Resend.  
**Fix:** Set `from:` to a verified sender on your Resend account (e.g. `contact@erikunha.dev` or `noreply@erikunha.dev`). Requires the domain to be verified in Resend dashboard.  
**Previously flagged:** `docs/audit/2026-05-19-principal-audit.md:166` as High. Never fixed.

### P0-2: OG image points to a file that does not exist
**File:** `app/layout.tsx`  
**Finding:** `openGraph: { images: [{ url: '/og-image.png' }] }` — `/og-image.png` does not exist in `public/`. The actual image generator is the Next.js `opengraph-image` route handler. Social previews on every platform (LinkedIn, Twitter/X, Slack, iMessage) are broken — they either show nothing or a broken image.  
**Fix:** Remove the static `images` array from both `openGraph` and `twitter` metadata fields (if present). Next.js automatically picks up the `opengraph-image.tsx` route handler when no static `images` override is present.

### P0-3: Budget counter permanently overcounts after each request
**File:** `app/api/ask/route.ts` (the `settleAndPersist` closure)  
**Finding:** `void settleBudget(...)` and `void persistAskInteraction(...)` inside `settleAndPersist()` fire-and-forget instead of being awaited. The function is `async` — the `void` calls discard their promises, so `settleBudget` is not guaranteed to run before the function returns. If the process exits early or an error occurs, the monthly token budget reservation (~2,712 tokens per request) may not be refunded. Over enough requests, the counter could hit the 3M cap and the ask endpoint would return 402 even though actual usage is lower.  
**Fix:** `await settleBudget(...)` and `await persistAskInteraction(...)` inside `settleAndPersist`. Remove the `void` prefix.

### P0-4: `lib/ip-hash.ts` permanently breaks after any salt-resolution failure
**File:** `lib/ip-hash.ts`  
**Finding:** The `resolvePromise` variable is set to a rejected promise if `resolveSalt()` throws. On every subsequent call to `hashIp()`, the cached rejected promise throws immediately. All rate-limiting, dedup, and audit-log operations that call `hashIp()` fail for the entire process lifetime — equivalent to a silent DoS on those features.  
**Fix:** Set `resolvePromise = null` (not `undefined` — the type is `Promise<string> | null`) inside a `.catch()` handler so the next call retries salt resolution rather than serving the cached rejection.

---

## P1 — High (security / accessibility / correctness)

### P1-1: `providerMetadata.anthropic` cast silences budget-refund safety check
**File:** `app/api/ask/route.ts:399`  
**Finding:** `meta?.anthropic as { cacheReadInputTokens?: number; ... }` — `meta.anthropic` is typed as `JSONObject`, not the asserted shape. If the AI SDK ever changes key naming (it has before: `cache_read_input_tokens` vs. `cacheReadInputTokens`), the cast silently returns `undefined` and the `?? 0` fallback fires. Budget refund uses the wrong values; over-refunds lower the monthly cap protection.  
**Fix:** Replace the cast with a type guard:
```ts
function isAnthropicCacheMeta(v: unknown): v is {
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
} {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    (obj['cacheReadInputTokens'] === undefined || typeof obj['cacheReadInputTokens'] === 'number') &&
    (obj['cacheCreationInputTokens'] === undefined || typeof obj['cacheCreationInputTokens'] === 'number')
  );
}
```

### P1-2: CSP `report-uri` deprecated — violations invisible in Chrome 94+
**File:** `proxy.ts:80`  
**Finding:** `report-uri /api/csp-report` was deprecated in Chrome 94 (released 2021) in favor of `report-to`. Chrome silently ignores `report-uri` and sends nothing. The CSP violation observability system described in the file-level comment is effectively dead on all Chromium-based browsers.  
**Fix:** Add a `Reporting-Endpoints` response header and replace `report-uri` with `report-to`:
```ts
response.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"');
// In CSP_DIRECTIVES:
'report-to csp-endpoint',
```
Keep `report-uri` as a fallback for Safari/Firefox compatibility.

### P1-3: `connect-src` includes dead Anthropic origin
**File:** `proxy.ts:72`  
**Finding:** `https://api.anthropic.com` in `connect-src` — AI calls are server-side only. No browser-side `fetch()` ever hits `api.anthropic.com`. This directive is dead and widens the allowed connect surface for no reason.  
**Fix:** Remove `https://api.anthropic.com` from `connect-src`.

### P1-4: Missing CSP directives
**File:** `proxy.ts`  
**Finding:** Three missing directives that lock down underspecified surfaces:
- `form-action 'self'` — prevents form hijacking to external URLs (contact form)
- `frame-src 'none'` — explicit frame blocking (distinct from `frame-ancestors`)
- `worker-src 'self'` — prevents external service worker injection  
**Fix:** Add all three to `CSP_DIRECTIVES`.

### P1-5: Motion toggle missing `aria-label` and `aria-pressed` (WCAG 1.3.1, 4.1.2)
**File:** `components/responsive/DesktopTopbar/DesktopTopbar.client.tsx`  
**Finding:** The motion effects toggle button has no `aria-label` — screen readers announce it as an unlabeled button. It also lacks `aria-pressed={motionOn}` — the toggle state is not exposed to assistive technology. Both are WCAG 2.1 Level A violations.  
**Fix:**
```tsx
<button
  aria-label="Toggle motion effects"
  aria-pressed={motionOn}
  onClick={toggle}
>
```

### P1-6: External links missing new-window indication (WCAG 3.2.2)
**File:** `DesktopTopbar.client.tsx` and other link consumers  
**Finding:** Links with `target="_blank"` have no visual or accessible indication that they open a new window. Screen reader users and keyboard-only users are not warned. This is a WCAG 2.1 Level A violation.  
**Fix:** Add `<span className="sr-only"> (opens in new window)</span>` inside external links, or use a visually hidden text + icon pattern. At minimum add `rel="noopener noreferrer"` if not already present.

### P1-7: Empty catch block swallows all errors in MCP ask tool
**File:** `lib/agent/mcp-tools.ts` (the `try/catch` around the ask fetch)  
**Finding:** The catch block is `} catch { /* Non-JSON error body */ }`. Any exception in the `try` block — network failure, thrown `TypeError`, unexpected response shape — is swallowed completely. No logging, no rethrow, no structured error. The MCP tool returns an indeterminate state to the caller.  
**Fix:** Replace with:
```ts
} catch (e) {
  log.error('mcp ask tool: request failed', { err: e });
  return { ok: false, error: 'request failed' };
}
```

---

## P2 — Medium (correctness, type safety, observability)

### P2-1: `BreakpointProvider initialIsMobile={false}` hardcoded — mobile layout flash
**File:** `app/page.tsx`  
**Finding:** `<BreakpointProvider initialIsMobile={false}>` hardcodes the initial SSR value as desktop. On mobile devices, React renders desktop layout on the server, ships it to the browser, then flips to mobile after hydration. This causes a layout flash (CLS) and briefly shows the wrong layout.  
**Fix:** Use `getIsMobile()` from `lib/ua.ts` (reads the `User-Agent` header via `headers()`) to pass the correct `initialIsMobile` based on the actual request. This is already the pattern used in the dual-variant Suspense sections.

### P2-2: 18 sections have no ErrorBoundary
**File:** `app/page.tsx`  
**Finding:** Only `Hero` and `FooterLazy` are wrapped in `ErrorBoundary`. If any of the 18 middle sections (Skills, GitLog, Shell, etc.) throws during render, the entire page crashes. Given that several sections use `use client` + `useEffect` patterns that can fail in edge cases (Redis timeout, malformed content, intersection observer unavailable), this is a real risk.  
**Fix:** Wrap each section in a `<SectionErrorBoundary>` that renders a minimal fallback (the section header + "–" placeholder). This is a defensive change, not a known active bug.

### P2-3: `req.json() as { question?: unknown }` — false narrowing in ask route
**File:** `app/api/ask/route.ts:154`  
**Finding:** The cast asserts a shape without any runtime check. If the body is a JSON array or non-object, `body.question` silently returns `undefined` and the downstream null check handles it — but TypeScript was disabled at the boundary for no benefit.  
**Fix:** Remove the cast; keep `body` as `unknown`. The existing `typeof body.question !== 'string'` guard already handles all invalid shapes correctly — remove the cast and let TypeScript enforce that `body` is treated as `unknown` throughout.

### P2-4: `AskInteractionStatus` conflates rate-limit and dedup rejections
**File:** `lib/ask-log.ts:17`  
**Finding:** Both IP rate-limit and identical-question dedup rejections persist as `'rate-limited'`. Observability logs cannot distinguish between "user sent 8+ requests in an hour" and "user sent the same question twice in 60s". Operationally they require different responses.  
**Fix:** Add `'dedup-rejected'` to the union. Change the `earlyExitPersist` call on the dedup path to use it.

### P2-5: `ParsedStreamChunk` flat type instead of discriminated union
**File:** `lib/stream-protocol.ts:16`  
**Finding:** `{ displayText: string; errorMessage: string | undefined }` allows the "no error" and "stream error" states to coexist in one shape, requiring null checks at every consumer.  
**Fix:**
```ts
export type ParsedStreamChunk =
  | { ok: true; displayText: string }
  | { ok: false; displayText: string; errorMessage: string };
```

### P2-6: `ApiError.code: string` — no union constraint
**File:** `lib/server/route.ts:59`  
**Finding:** Error codes are documented as stable machine-readable identifiers but typed as `string`. New routes can introduce `'rateLimited'` or `'rate-limited'` silently.  
**Fix:** Export `type ApiErrorCode = 'rate_limited' | 'invalid_json' | 'validation_failed' | 'storage_unavailable'` and use it in `ApiError.code`.

### P2-7: `hero:sysfail:show` / `hero:sysfail:hide` not in `WindowEventMap`
**File:** `lib/events.ts`  
**Finding:** Two custom events dispatched and listened to are missing from the TypeScript augmentation. Name typos are invisible to the compiler.  
**Fix:** Add both to the `WindowEventMap` declaration in `lib/events.ts`.

### P2-8: CRT overlay animations missing `will-change`
**File:** `components/responsive/CRTOverlay/CRTOverlay.module.css`  
**Finding:** `.noise` (animates `transform`) and `.flicker` (animates `opacity`) have no `will-change`. The browser re-rasterizes these full-screen fixed elements on every frame. On mobile, this is sustained INP overhead during scroll.  
**Fix:** Add `will-change: transform` to `.noise` and `will-change: opacity` to `.flicker`.

### P2-9: `contain-intrinsic-size: auto 520px` — CLS on small sections
**File:** `components/responsive/Module/Module.module.css`  
**Finding:** Sections as small as 70px on mobile use a 520px placeholder during `content-visibility: auto` offscreen state. On first paint, the browser allocates 520px, then collapses to actual height — causing CLS on every section that wasn't yet measured.  
**Fix:** Switch to `contain-intrinsic-size: auto` (no fixed fallback) for sections known to be small, or measure actual section heights and set accurate per-section intrinsic sizes.

### P2-10: Budget counter TOCTOU on month boundary + non-atomic refund
**File:** `lib/rate-limit.ts`  
**Finding:** `reserveBudget()` does INCRBY then conditional DECRBY — two separate Redis commands. If the server crashes or Redis times out between them, the over-cap refund never happens and the counter is permanently stuck inflated. Additionally, reservations made near the end of a month (key `ask:tokens:2026-05`) refund to the new month's key (`ask:tokens:2026-06`) if the stream completes after midnight.  
**Fix:** Use a Lua script or Upstash pipeline to make reserve+check atomic. For the month-boundary issue, pass the `key` from `reserveBudget` to `settleBudget` and use it for the refund rather than calling `getBudgetKey()` again.

### P2-11: Vitest coverage missing `branches`, `functions`, `statements` thresholds
**File:** `vitest.config.ts`  
**Finding:** Only `lines: 80` is configured. Branch coverage and function coverage thresholds are absent — functions with untested branches pass silently.  
**Fix:** Add `branches: 70, functions: 80, statements: 80` alongside `lines: 80`.

### P2-12: `no-source-grep.test.ts` doesn't scan `.test.tsx` files or co-located tests
**File:** `__tests__/meta/no-source-grep.test.ts`  
**Finding:** The enforcement gate only scans `__tests__/**/*.test.ts`. Co-located `*.test.tsx` files (the majority of tests after the co-location migration) are completely invisible to this gate. Tests that call `readFileSync` in co-located files slip through.  
**Fix:** Expand the glob to `['**/*.test.ts', '**/*.test.tsx']` and exclude `node_modules`.

### P2-13: `mock-backend.ts` returns `deleted` field; production API omits it
**File:** `tests/e2e/_helpers/mock-backend.ts`  
**Finding:** Mock responses return `{ ok: true, deleted: 1 }` but the production `/api/forget` handler returns `{ ok: true, requestId }` — the `deleted` field is not in the production envelope. E2E tests pass against a mock that doesn't match the real API contract.  
**Fix:** Remove `deleted` from the mock response shape to match the production envelope.

---

## P3 — Low / DX (maintainability, tooling hygiene)

### P3-1: Token system is aspirational, not enforced
**File:** `design-system/tokens/`, `scripts/lint-no-magic-values.allowlist.json`  
**Finding:** 71 raw `gap: Npx` usages, 104 raw `padding: Npx` usages, 0 `var(--ds-layer-*)` usages (the layer tokens are dead code), 31 `rgba(0,255,65,X)` escapes. The no-magic-values allowlist has grown to 45 px entries — it ratifies drift rather than preventing it. The gate's own allowlist comment for `12px` says "ds-space-3 = 12px, equivalent token exists but files migrated to module CSS retain numeric form."  
**Decision required:** Pick one:
- (A) Drop `lint-no-magic-values` — it's not preventing anything. Keep `lint-token-boundary` + `contrast-check` which do work.
- (B) Fix the underlying problem: add `--ds-color-signal-alpha-{02,04,06,12,25,35,45}` tokens for rgba leaks, add missing space tokens, run a one-shot migration script, then require the gate with zero allowlist entries.

### P3-2: `--ds-layer-*` tokens don't match reality
**File:** `design-system/tokens/layer.json`  
**Finding:** Layer tokens (`base: 0, sticky: 50, overlay: 100, headline: 150`) don't match actual z-index values in use (`109, 110, 115, 120, 150`). Dead tokens shipped in `dist/tokens.css` that no consumer uses.  
**Fix:** Either rewrite to match reality and migrate all z-index usages, or delete `layer.json` entirely.

### P3-3: `_base.css` cascade pollution contradicts CSS Modules model
**File:** `app/css/_base.css:146-172`  
**Finding:** `h1/h2/h3` get `text-shadow` globally; `button` gets `border: 1px solid` globally; responsive `@media` blocks override token values (three viewport-dependent token shapes not visible in `dist/tokens.css`). This undercuts the "each component owns its styles" guarantee.  
**Fix:** Move `h1/h2/h3` styling to a `Heading` primitive in the design system. Move `button` border reset to each component that needs it. Move responsive token shifts to explicit `--ds-space-rhythm-mobile` / `--ds-space-rhythm-desktop` tokens.

### P3-4: `HiringProfile` unvalidated at build time
**File:** `lib/hiring-profile.ts:153`  
**Finding:** Every other content module runs through `z.array(Schema).parse()` — caught by `pnpm validate-content`. `HIRING_PROFILE` uses `typeof HIRING_PROFILE` inferred from the literal, with no Zod parse step. Shape violations (wrong type for a field) are invisible until runtime.  
**Fix:** Add a `HiringProfileSchema` and `HiringProfileSchema.parse(data)` call, aligned with the rest of the content module pattern.

### P3-5: `STREAM_ERR_SENTINEL` duplicated in test helper
**File:** `tests/e2e/_helpers/mock-backend.ts:32`  
**Finding:** Deliberately duplicated with a comment. But `lib/stream-protocol.ts` has zero Next.js imports — the "avoiding the source tree" concern is unfounded.  
**Fix:** Import directly from `lib/stream-protocol.ts`.

### P3-6: `noPropertyAccessFromIndexSignature: false` in tsconfig
**File:** `tsconfig.json:14`  
**Finding:** Arrays are protected by `noUncheckedIndexedAccess: true` but index-signature object access is unprotected — inconsistent.  
**Fix:** Enable `"noPropertyAccessFromIndexSignature": true` and fix the handful of violations (likely Redis pipeline results and `JSONObject` accesses).

### P3-7: `verbatimModuleSyntax: false` — type imports unenforced
**File:** `tsconfig.json:22`  
**Finding:** The codebase uses `import type` consistently but the compiler doesn't enforce it. Value imports of type-only symbols pass through, which can bring in module graphs unnecessarily on Edge cold starts.  
**Fix:** Enable `"verbatimModuleSyntax": true`. The existing codebase already satisfies the requirement — this should be zero or near-zero violations.

### P3-8: CLAUDE.md at 244/250 line ceiling with no pruning protocol
**Finding:** The harness-size gate fires at 250 lines. The PR merge gate block alone is 60+ lines. No rule in the system asks "is this rule still load-bearing?"  
**Fix:** Split into `CLAUDE.md` (≤120 lines: stack, budgets, dispatch tables) and `CLAUDE-process.md` (PR workflow, merge gate). Add a "last-failed-without-this" annotation to rules; demote any rule not triggered in 90 days from the hot-loaded file.

### P3-9: Script directory has no shared utilities
**File:** `scripts/`  
**Finding:** 25 scripts, 3,060 lines. ANSI color constants duplicated in 5 files. `inspect-pr-comments.mjs` and `check-pr-comments.ts` likely share logic. Three CSS-scanning scripts glob the same files independently.  
**Fix:** Create `scripts/lib/ansi.ts`, `scripts/lib/gh.ts`, `scripts/lib/scan-css.mjs`. Refactor the 5 PR-flow scripts to share `scripts/lib/gh.ts`. Target: 10-15% LOC reduction.

### P3-10: CI `quality` job runs 12 lint steps sequentially
**File:** `.github/workflows/ci.yml`  
**Finding:** All 12 checks run in one job, sequentially. The slowest (tsc + biome) block all the fast checks. A failure in step 1 reports only one error instead of all.  
**Fix:** Parallelize into a matrix: fast-checks (`biome`, `validate-content`, `check:*` scripts) and slow-checks (`tsc`, `tokens:check`). Move `bundle-check` before provenance attestation.

### P3-11: 43KB client-island budget not enforced by CI
**File:** `scripts/check-bundle-size.mjs`  
**Finding:** The script's own comment says: "The 43KB app-island figure is a design target tracked via `pnpm bundle:analyze`, not gated here." CLAUDE.md lists this as "non-negotiable" but CI has no gate for it.  
**Fix:** Parse `.next/build-manifest.json` post-build to sum gzipped client island chunks and fail if total exceeds 43KB. This is the same technique `check-bundle-size.mjs` already uses for per-route JS.

### P3-12: DS component docs gate checks H2 presence only
**File:** `scripts/check-component-docs-coverage.mjs`  
**Finding:** The gate passes if `## ComponentName` appears anywhere in the docs MDX. A component with 5 props can ship with an empty section.  
**Fix:** Use `ts-morph` (TypeScript is already a devDep) to extract `*Props` types and assert each named prop appears under the component's H2. This makes the gate semantic.

### P3-13: `lint-no-magic-values.mjs` is fragile and misses rgba leaks
**File:** `scripts/lint-no-magic-values.mjs:50-52`  
**Finding:** The `var()` stripping regex is not properly nested — magic values inside `calc(var(--x) + 8px)` are masked. Additionally, `rgba(0,255,65,X)` color literal leaks (31 instances) are not caught because there's no rgba pattern in `checks`.  
**Fix:** Either switch to PostCSS for proper AST-based scanning, or at minimum add an `rgba(\s*\d+\s*,\s*\d+\s*,\s*\d+` check to catch the color literals.

### P3-14: `migrate-tokens.mjs` is a one-shot migration script in the live scripts dir
**File:** `scripts/migrate-tokens.mjs`  
**Finding:** The script's comment says "run once; idempotent." It was used during the Tailwind migration. Keeping it in `scripts/` adds to CLAUDE.md context cost on every session.  
**Fix:** Move to `scripts/migrations/2026-05-XX-token-rename.mjs` or delete (it's in git history).

### P3-15: `dist/tokens.ts` generated but never imported
**File:** `design-system/sd.config.ts`  
**Finding:** The Style Dictionary config generates CSS, TypeScript, and JSON artifacts. Only CSS is imported. The TypeScript platform output is dead weight.  
**Fix:** Remove the `ts` platform from `sd.config.ts`.

---

## Summary by priority

| Priority | Count | Theme |
|---|---|---|
| P0 (critical, bugs now) | 4 | Email delivery, OG image, budget math, hash failure |
| P1 (security/a11y) | 7 | CSP, accessibility, silent failure |
| P2 (correctness/type safety) | 13 | Type casts, state bugs, test accuracy |
| P3 (DX/tooling) | 15 | Token enforcement, tooling hygiene, CI optimization |

**Recommended order of execution:**
1. Fix P0-1 through P0-4 in a single commit (small, all correctness fixes)
2. Fix P1 items in a second commit (security + a11y — two independent concerns but small blast radius)
3. Fix P2-1 through P2-7 (type safety changes — low blast radius, high coverage value)
4. Fix P2-8 through P2-13 (test fixes + CSS fixes)
5. P3 items: defer to a dedicated "tooling hygiene" PR, pick by value

**Not recommended for this PR (defer or reconsider):**
- P3-3 (`_base.css` cascade pollution) — scope creep, touches every component
- P3-1 option B (full token migration) — large blast radius, separate PR
- P3-8 (CLAUDE.md split) — separate maintenance PR, no runtime impact
- P3-12 (DS docs gate with ts-morph) — build tooling investment, separate PR
