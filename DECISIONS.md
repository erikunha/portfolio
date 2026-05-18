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
