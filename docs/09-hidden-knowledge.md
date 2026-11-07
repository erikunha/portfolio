# Hidden Knowledge

> The tribal knowledge: implicit conventions, surprising behaviors, and "why is it like this" answers a new engineer would otherwise learn the hard way. Assume the reader knows none of it.

## Conventions you must follow (and the gate that catches you)

- **Client naming accepts a suffix or directory.** `check-client-naming.mjs` accepts `*.client.tsx`/`*.client.ts`, `/client/` directories and App Router error filenames. `components/client/**` is an explicit exception, not a gap in scanning.
- **Section data belongs in `content/*.ts`.** Validated content modules supply profile data and most section copy. Components also contain presentation labels, and `content/contact-copy.ts` keeps the contact form copy free of Zod, and `content/contact-rules.ts` holds the helpers the client imports so the copy table stays out of client chunks. Client-consumed modules stay Zod-free; `content/_validate-client-content.ts` validates their schemas during `pnpm validate-content`. It is the only parse site for `content/terminal-chrome.ts`, whose `shellChrome` and `contactChrome` reach the shell and the contact form. The same file parses `brand.ts`, the home link name that the brand icon in every header carries.
- **No raw hex outside `app/css/theme.css`.** Use `var(--color-*)`. Enforced by `lint:css-tokens`. Complex CSS patterns become named classes in an `app/css/components-*.css` partial under `@layer components`; everything else is a Tailwind utility.
- **Per-keystroke/per-pixel/per-frame updates must not re-render React.** Mutate `textContent`/`style`/`setAttribute` directly, or rAF-coalesce. This is the single most important runtime convention (it's a budget, not a preference).
- **`AGENTS.md` stays under its line budget and `CLAUDE.md` stays a thin import** (`check:harness-size`). New procedural rules go to a skill or a `.claude/rules/*` path-scoped file, not into `AGENTS.md`.
- **pnpm only.** Deps are pinned (no `latest`).
- **Commit scope is required** (`commitlint`), and `(design-system)`-scoped commits must regenerate the changelog (`pnpm changelog:sync`).

## Surprising behaviors (the "wait, what?" list)

- **`proxy.ts` is Next.js middleware**, just named `proxy`. It sets CSP per-request; the _static_ security headers live in `next.config.ts`. Two places on purpose.
- **The CSP is deliberately nonce-less** (`script-src 'self' 'unsafe-inline'`). Because `/` is static-generated, a nonce would break every inline RSC flight script (CSP-3 §6.7.2.4). This is documented at length and is not a vulnerability oversight.
- **`/api/ask` streaming is plain `text/plain` over a raw `ReadableStream`** - not SSE, and the AI SDK is server-side only. The wire protocol uses a NUL-prefixed `\x00ERR:` sentinel (`lib/stream-protocol.ts`) to carry mid-stream errors inside the text channel. The AI SDK does not throw on a provider failure: `onError` fires and `textStream` ends empty, so the route turns that into the sentinel itself.
- **The AI persona imports shared content.** `lib/ask/system-prompt.ts` composes the system prompt from the _live_ `content/*` modules, and `PROMPT_VERSION` is a content hash of the prompt bytes. Change the content, the persona changes, and the prompt fingerprint changes.
- **The ask-eval corpus pulls ground truth from live content**, and includes expectations tied to those values. Run the eval after changing grounded claims; shared imports do not guarantee every narrative statement agrees.
- **The guitar EQ strip reads its values from `EqSpectrumSchema`, not from the markup.** The bands (high-pass 140 Hz, 3 dB cut at 400 Hz, 5 dB boost at 2.8 kHz, low-pass 9 kHz) are illustrative until the real settings replace them in `content/guitar-rig.ts`. The curve, the 72 bars, the axis positions and the accessible name all follow from those bands. The DAW mixer refines `last === 'MASTER'`.
- **Failure behavior depends on the operation.** Rate limits and dedup fail open; logging failures are quiet. Ask budget reservation (monthly and daily) fails closed with 503. Contact audit and outbox persistence fail closed with 502.
- **The token budget fails _closed_:** a Redis error during reservation rejects the request, and if `/api/ask` can't resolve token usage it keeps the reservation (so a metering bug can't leak spend). Both are deliberate.
- **`ASK_ENABLED` fails OFF; `LANGFUSE_ENABLED` fails OFF.** The kill switch must disable on a typo; the telemetry must stay inert unless the string is exactly `'true'`. Asymmetric by intent.
- **`StatusBar` initializes its clock to `''` and uses `suppressHydrationWarning`.** A `new Date()` at render would be a dynamicIO prerender hazard; the empty initial avoids prerendering a timestamp.
- **`next-env.d.ts` flips on a local prod build** (dev path ↔ prod path). Inspect that diff before deciding whether it belongs in the change.
- **The MCP `ask_erik` tool limits and de-duplicates per caller.** It re-invokes `/api/ask` in-process via a synthetic `Request` and copies `x-forwarded-for` and `x-real-ip` from the MCP request (`ctx.http.req`), so `getClientIp` sees the caller. A request the transport delivers without those headers (an in-memory transport) falls back to `'unknown'` and shares one bucket. Failures set `isError`; the result carries the request id in `_meta.requestId` and in a second text block, for `/api/log/forget`.
- **`/api/log/forget` never returns a deleted count** and answers a known and an unknown id with the same body, and `/api/log` stores no IP. Both are anti-oracle / minimization choices, not omissions.

## Naming map (decode the filesystem)

| Pattern                        | Meaning                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `Foo/Foo.tsx` + `Foo/index.ts` | one component per folder, barrel-exported                            |
| `*.client.tsx`                 | client island/chrome (ships JS)                                      |
| `*Lazy.{tsx,client.tsx}`       | inspect the module: Contact/Shell use dynamic imports                |
| `*Desktop.tsx` / `*Mobile.tsx` | dual-variant inner RSC selected by `getIsMobile()`                   |
| `_components/` `_lib/`         | route-private (underscore = not public API)                          |
| `sec-*` (id)                   | section or nested anchor; nested anchors may be exempt from ordering |
| `*.e2e.ts` / `*.test.tsx`      | Playwright / Vitest, co-located                                      |
| `lib/*.client.tsx`             | the rare client-side lib (breakpoint, error-bridge)                  |

## Things that look wrong but are intentional

- `/api/erik.json` does **not** use the `defineHandler` envelope. It's a machine-readable _document_, not an _operation_, so it returns raw JSON with long cache headers.
- The fixed-opacity color stops (`-subtle`, `-border`, ...) are explicit hex, not `color-mix()`. That's a byte-identical / contrast-stable choice.
- `lib/cn.ts` uses `clsx` but deliberately _not_ `tailwind-merge`, a bundle-budget call.
- The DS docs `theme-tokens.ts` and the `contrast-check.mjs` gate parse `theme.css` with the _same regex_ on purpose, to read the same declarations. Parser changes still need comparison.

## "Where is X?" quick index

| Looking for...             | It's in...                                                |
| -------------------------- | --------------------------------------------------------- |
| the page composition       | `components/SiteHome.tsx`                                 |
| a section's copy           | `content/<section>.ts`                                    |
| the API contract           | `lib/server/route.ts` (`defineHandler`)                   |
| rate limits / token budget | `lib/rate-limit.ts`                                       |
| the AI system prompt       | `lib/ask/system-prompt.ts`                                |
| CSP / security headers     | `proxy.ts` (per-request) + `next.config.ts` (static)      |
| design tokens              | `app/css/theme.css` (`@theme`)                            |
| motion state               | `lib/motion.ts` + `body[data-motion]` (not React)         |
| cross-island events        | `lib/events.ts` (window CustomEvents)                     |
| why a decision was made    | `DECISIONS.md` (search by date/topic)                     |
| an enforcement rule        | `STANDARDS.md` (chapter) + `.husky/*` + `scripts/check-*` |
