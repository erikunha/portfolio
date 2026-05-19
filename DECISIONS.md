# DECISIONS

ADR-lite running log. One bullet per decision · date · reversibility note.

## 2026-05-13 — Architecture pass

- **2026-05-13** · Stack locked: Next.js 15 App Router + React 19 + TS strict + Tailwind v4 + Biome + pnpm + Playwright. _Reversible at PR-1 stage; expensive after PR-3._
- **2026-05-13** · Vercel Edge end-to-end. _Reversible at any time (Next is portable), but stack pinned to Vercel-flavored APIs (Server Actions, OG image, edge runtime hints)._
- **2026-05-13** · No CMS; content lives in typed TS files under `content/` validated by Zod at build time. _Reversible at any time; current content fits in ~12 files._
- **2026-05-13** · `claude-haiku-4-5-20251001` for the `ask` endpoint. _Trivially reversible (model string swap); Sonnet upgrade path if quality complaints arise._
- **2026-05-13** · Upstash Redis for rate-limiting + KV log. _Replaceable with Vercel KV or any Redis-compatible store; ~half-day migration cost._
- **2026-05-13** · Resend for contact delivery. _Replaceable (Postmark, SES); ~2-hour migration._
- **2026-05-13** · Anthropic monthly hard cap at $50 with 80%/95% alert thresholds and graceful 503 fallback. _Critical for cost safety; never disable._
- **2026-05-13** · No CAPTCHA on contact form; honeypot + rate-limit only. _Reversible if spam volume justifies it._
- **2026-05-13** · Matrix loop must use `useRef.textContent` mutation, not per-keystroke `useState`. _Hard constraint to keep INP < 200ms; CI test enforces._
- **2026-05-13** · Two-token palette (`--signal` for headings/accents/large text; `--fg` for body) to pass WCAG AA on the green-on-black aesthetic. _Reversible but a11y CI gate enforces._
- **2026-05-13** · `/api/erik.json` + `/llms.txt` shipped for AI-agent recruiter parsing. _Reversible; adds ~5KB to build output, nothing more._
- **2026-05-13** · Single-page composition, no per-section routing. _Reversible at PR cost; current scope doesn't warrant routes._
- **2026-05-13** · Conventional Commits + squash merges to main. _Reversible but harms changelog clarity if abandoned mid-stream._

## 2026-05-15 — Audit fixes

- **2026-05-15** · CSP `script-src 'unsafe-inline'` kept instead of nonces. Inline scripts (motion IIFE, scroll-restoration) exist solely to prevent FOUC and cannot be extracted without breaking their purpose. Nonce injection requires middleware and adds latency per request. Portfolio has no user-generated content vectors that would make XSS meaningful. _Revisit if any third-party script injection surface is added. Reversible: add Next.js middleware to inject per-request nonces._

## 2026-05-15 — Principal review fixes

- **2026-05-15** · `LIGHTHOUSE_FALLBACK` changed from fabricated 100/100/98/100 scores to zeros. Display shows `—` when fallback is active; footer shows "PSI API unavailable." _Irreversible in spirit — never show fabricated data as live scores._
- **2026-05-15** · Contact route now writes to Upstash KV before calling Resend. Key `contact:msg:{uuid}`, 90-day TTL. Resend failure returns `{ ok: true, warn: 'delivery delayed' }` — message is durable. _Reversible: remove KV write if Upstash costs become a concern (currently free tier)._
- **2026-05-15** · Contact validation extracted to `lib/contact-validation.ts`. Server now enforces `message.length >= 10`, matching client-side `minLength={10}`. IP hashed with SHA-256 + DEPLOY_SALT before KV storage. _Reversible._
- **2026-05-15** · Monthly LLM budget cap implemented: Redis key `ask:tokens:YYYY-MM`, 400K token hard cap (≈$0.40 at Haiku pricing), fail-open on Redis unavailability. _Critical for cost safety; never disable without an alternative cap._
- **2026-05-15** · Anthropic prompt caching enabled on `ask` system prompt via `cache_control: { type: 'ephemeral' }`. ~93% cheaper on cached input tokens per call. _Trivially reversible._
- **2026-05-15** · Ask rate limit corrected to `slidingWindow(8, '1 h')` — aligns with documented value (was 10/min = 600/hr). _More restrictive; budget cap is now the primary spend control._
- **2026-05-15** · Skip-to-content link added to AppShell as first focusable element (WCAG 2.4.1 Level A). Targets `#main-content` on the `<main>` element. _Non-negotiable for WCAG compliance._
- **2026-05-15** · `/api/erik.json` implemented. Returns a `HiringProfile` document (custom type, no schema.org @context — `Engineer` is not a valid schema.org type). 24-hour edge cache. _Reversible; static data._

## 2026-05-18 — CSP cleanup

- **2026-05-18** · Bootstrap scripts externalized to `/public/init.js`, loaded via `<Script src strategy="beforeInteractive" />` in `app/layout.tsx`. `'strict-dynamic'` removed from CSP in `proxy.ts`; `'self'` now honors same-origin static scripts without nonces. Eliminates the `nonce={nonce}` + `suppressHydrationWarning` invariant chain (which caused one production CSP regression in `ae8e6ac` this session) and lets `RootLayout` become sync (no `headers()` await). _Reversible. Re-introduce `'strict-dynamic'` if any third-party script source is ever added (analytics, embeds); per CLAUDE.md out-of-scope list, none are planned. The two inline scripts are gone; their content is now in `/public/init.js`._

## 2026-05-18 — Mobile Lighthouse pass + CSS architecture lock-in

- **2026-05-18** · `content-visibility: auto` rule in `_layout.css` extended with a second selector for `details.module--mobile:nth-of-type(n+5)`. The original rule scoped to `section.module--desktop` only and never matched on mobile (where Module renders `<details>`), which is why mobile Lighthouse reported ~840ms style+layout for first paint. Below-fold deferral now covers both viewports. _Reversible. If the per-section content height variance grows beyond the 400px `contain-intrinsic-size` estimate, swap to per-section overrides._
- **2026-05-18** · Removed unused `@vercel/analytics` and `@vercel/speed-insights` from `package.json` — declared since scaffold but never imported. Site has no third-party origins on the critical path. _Trivially reversible; re-add and mount in `app/layout.tsx` if RUM data is wanted later._
- **2026-05-18** · `_sections.css` dead-code audit: removed full `.blame*` block (~95 lines, replaced by git-log format in `90a9ab4`), `.guitar__spec-label`, related mobile `.blame*` media block in `_layout.css`. _Irreversible in spirit — the underlying DOM no longer exists; restoring would require reintroducing the timeline component._
- **2026-05-18** · **Tailwind v4 removed.** Vestigial since scaffold: zero `@apply`, zero utility classes used anywhere in components — `@import "tailwindcss"` was the only reference. Was contributing ~2.25KB gzip of Preflight reset into the render-blocking CSS bundle and forced `style-src 'unsafe-inline'` via runtime style injection. Replaced by an explicit Preflight-subset reset inside `_base.css` (pseudo-element `box-sizing`, `text-size-adjust`, `tab-size`, image/svg `display: block + max-width`, form-control font inheritance, list reset). PostCSS pipeline also deleted (`postcss.config.mjs` gone); Next 16 + Turbopack now handles nesting + autoprefixing natively via Lightning CSS, driven by the existing `browserslist`. Final render-blocking CSS chunk: 13.30 KB gzip → 9.68 KB gzip (-27.2%). _Reversible in <1 minute: `pnpm add -D tailwindcss @tailwindcss/postcss`, restore `@import "tailwindcss"`, restore `postcss.config.mjs`. Reversal cost is low; cost of keeping was a CSP downgrade and a dep that did nothing for this codebase._
- **2026-05-18** · CSS architecture lock-in: **global CSS in 10 hand-rolled files**, BEM-ish naming, tokens centralized in `_tokens.css`, one entry point in `globals.css`. Explicitly rejected CSS Modules: per-component scoping would scatter the same volume across 18+ section files and break the architectural property (single grep-able surface) that made the audit above possible in <60 seconds. _Reversible at significant cost; revisit only if multi-app reuse or shared design-system extraction becomes in-scope (currently rejected in CLAUDE.md)._

## 2026-05-18 — Production observability shipped

- **2026-05-18** · Vercel Analytics + Speed Insights re-wired in `app/layout.tsx` after the silent removal in commit `ad5b58c` (declared-but-unused). CSP `connect-src` widened for `https://vitals.vercel-insights.com` (specific origin, no wildcard — principle of least privilege) and `https://va.vercel-scripts.com`. Real-user CWV closes the Pillar 7 (Flywheel) audit gap. _Reversible (unmount + revert CSP); ad-blocker coverage ~70-85% is expected and documented._
- **2026-05-18** · `pino` chosen as the underlying logger; `lib/log.ts` is a thin facade over it. The facade keeps call sites decoupled from pino directly (abstraction boundary), not the rejected alternative. Justified vs rolling a custom logger: (a) pino is server-only — no client bundle impact; (b) battle-tested JSON output + correlation-ID patterns are worth more than 80 LoC of bespoke code at this stage; (c) orthogonal to the CSS-pipeline lock-in (that covered PostCSS, not server runtime deps). _Reversible: `pnpm rm pino pino-pretty` + restore `console.*`._
- **2026-05-18** · Custom Upstash error endpoint (`/api/log`) chosen over Sentry. Zero new SaaS vendor; reuses existing Upstash infra and rate-limit primitive; ~50 LoC. Trade-off: no auto stack-trace grouping or source-map symbolication. Mitigation: Vercel's deployment pipeline retains source maps; operator manually symbolicates via `vercel inspect` when a captured production error needs deeper triage (post-merge ops checklist item 5). _Reversible: delete route + revert client bridge; KV records expire via 30-day TTL._
- **2026-05-18** · `/api/ask` Q+A logging shape locked: question truncated to 500 chars + answer to 1000 chars + meta (`{requestId, ts, ipHash, inputTokens, outputTokens, durationMs, status}`), 90-day TTL, IP hashed via SHA-256 + DEPLOY_SALT. Architect-review identified GDPR Art. 17 / LGPD Art. 18 right-of-erasure requirement; addressed by new `/api/log/forget` endpoint (POST `{requestId}` → idempotent DELETE across the last 90 day-partitions) + `X-Request-Id` response header + privacy notice on the /api/ask UI. The reviewer's alternative (drop question text entirely; meta-only) was considered and rejected — the brainstorming-stage value of "what users actually ask" + "what Haiku said about Erik retrospectively" is preserved by the forget mechanism rather than designed out. _Reversible: flip a feature flag in route.ts; operator can `SCAN ask:log:* | DEL` for hard reset._
