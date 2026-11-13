# Hidden Knowledge

> The tribal knowledge: implicit conventions, surprising behaviors, and "why is it like this" answers a new engineer would otherwise learn the hard way. Assume the reader knows none of it.

## Conventions you must follow (and the gate that catches you)

- **Client naming accepts a suffix or directory.** `check-client-naming.mjs` accepts `*.client.tsx`/`*.client.ts`, `/client/` directories and App Router error filenames. `components/client/**` is an explicit exception, not a gap in scanning.
- **Section data belongs in `content/*.ts`, keyed by locale.** Validated content modules supply profile data and most section copy, as a `Record<SiteLocale, ...>` with an `en` and a `pt` entry; a change to one language lands in the other. Components also contain presentation labels, and `content/contact-copy.ts` keeps the contact form copy free of Zod, and `content/contact-rules.ts` holds the helpers the client imports so the copy table stays out of client chunks. Client-consumed modules stay Zod-free; `content/_validate-client-content.ts` validates their schemas during `pnpm validate-content`. It is the only parse site for `content/terminal-chrome.ts`, whose `shellChrome` and `contactChrome` reach the shell and the contact form. The same file parses `brand.ts`, the home link name that the brand icon in every header carries.
- **No raw hex outside `app/css/theme.css`.** Use `var(--color-*)`. Enforced by `lint:css-tokens`, which also rejects literal z-index values and hand-written focus rings (`--z-*`, `--focus-ring`). Complex CSS patterns become named classes in an `app/css/components-*.css` partial under `@layer components`; everything else is a Tailwind utility.
- **Per-keystroke/per-pixel/per-frame updates must not re-render React.** Mutate `textContent`/`style`/`setAttribute` directly, or rAF-coalesce. This is the single most important runtime convention (it's a budget, not a preference).
- **`AGENTS.md` stays under its line budget and `CLAUDE.md` stays a thin import** (`check:harness-size`). New procedural rules go to a skill or a `.claude/rules/*` path-scoped file, not into `AGENTS.md`.
- **pnpm only.** Deps are pinned (no `latest`).
- **Commit scope is required** (`commitlint`), and `(design-system)`-scoped commits must regenerate the changelog (`pnpm changelog:sync`).

## Surprising behaviors (the "wait, what?" list)

- **`proxy.ts` is Next.js middleware**, just named `proxy`. It sets CSP per-request; the _static_ security headers live in `next.config.ts`. Two places on purpose.
- **The CSP is deliberately nonce-less** (`script-src 'self' 'unsafe-inline'`). Because `/` is static-generated, a nonce would break every inline RSC flight script (CSP-3 §6.7.2.4). This is documented at length and is not a vulnerability oversight.
- **`font-src` carries the `data:` scheme, and only `font-src`.** The platform inlines a font as a data: URI when it cannot load it from its own CDN; the policy used to refuse it, the browser logged the refusal, and the best-practices audit lost the points over a font. A font cannot execute script, so the relaxation stops at fonts: `script-src` still refuses a data: script, and `tests/e2e/csp.spec.ts` holds both halves of that at once.
- **`/api/ask` streaming is plain `text/plain` over a raw `ReadableStream`** - not SSE, and the AI SDK is server-side only. The wire protocol uses a NUL-prefixed `\x00ERR:` sentinel (`lib/stream-protocol.ts`) to carry mid-stream errors inside the text channel. The AI SDK does not throw on a provider failure: `onError` fires and `textStream` ends empty, so the route turns that into the sentinel itself. A stream the provider reports as `finishReason: 'interrupted'` (it ended without a completion signal) is treated the same way: the partial answer is kept, the sentinel follows, and the run is logged `errored`.
- **The AI persona imports shared content.** `lib/ask/system-prompt.ts` composes the system prompt from the _live_ `content/*` modules, and `PROMPT_VERSION` is a content hash of the prompt bytes. Change the content, the persona changes, and the prompt fingerprint changes.
- **The ask-eval corpus pulls ground truth from live content**, and includes expectations tied to those values. Run the eval after changing grounded claims; shared imports do not guarantee every narrative statement agrees.
- **The guitar EQ strip reads its values from `EqSpectrumSchema`, not from the markup.** The bands (high-pass 140 Hz, 3 dB cut at 400 Hz, 5 dB boost at 2.8 kHz, low-pass 9 kHz) are illustrative until the real settings replace them in `content/guitar-rig.ts`. The curve, the 72 bars, the axis positions and the accessible name all follow from those bands. The DAW mixer refines `last === 'MASTER'`.
- **Failure behavior depends on the operation.** Rate limits and dedup fail open; logging failures are quiet. Ask budget reservation (monthly and daily) fails closed with 503. Contact audit and outbox persistence fail closed with 502.
- **The spend budget fails _closed_:** a Redis error during reservation rejects the request, and if `/api/ask` can't resolve token usage it keeps the reservation (so a metering bug can't leak spend). Both are deliberate.
- **`ASK_ENABLED` is an off-list; `LANGFUSE_ENABLED` is an on-list.** `/api/ask` answers 503 only when `ASK_ENABLED`, trimmed and lower-cased, is one of `false`, `0`, `off`, `no` or `disabled`; unset or any other value leaves it on, a misspelled value included. Telemetry stays inert unless `LANGFUSE_ENABLED` is exactly `'true'`. The two flags guard opposite directions on purpose.
- **`StatusBar` initializes its clock to `''` and uses `suppressHydrationWarning`.** A `new Date()` at render would be a dynamicIO prerender hazard; the empty initial avoids prerendering a timestamp.
- **`next-env.d.ts` flips on a local prod build** (dev path ↔ prod path). Inspect that diff before deciding whether it belongs in the change.
- **The MCP `ask_erik` tool limits and de-duplicates per caller.** It re-invokes `/api/ask` in-process via a synthetic `Request` and copies `x-forwarded-for` and `x-real-ip` from the MCP request (`ctx.http.req`), so `getClientIp` sees the caller. A request the transport delivers without those headers (an in-memory transport) falls back to `'unknown'` and shares one bucket. Failures set `isError`; the result carries the request id in `_meta.requestId` and in a second text block, for `/api/log/forget`.
- **There is no root `app/layout.tsx`.** The site has two root layouts, `app/(en)/layout.tsx` and `app/(pt)/layout.tsx`, each setting `<html lang>` and rendering `RootShell`. Routes under `(pt)` are `/pt/**` and `/links`; routes under `(en)` are `/`, `/cv`, `/summary`, `/links/en` and `/design-system/**`. So `/links` is the Portuguese page and `/links/en` the English one.
- **Static routes declare `ensureStatic = 'navigation'`.** The export makes Next fail the build if the route reads `connection()`, `cookies()`, `headers()` or uncached data. `__tests__/meta/ensure-static-routes.test.ts` holds the list of routes.
- **Only the DAW mixer reads the user agent.** `lib/ua.ts` `getIsMobile()` picks the mixer variant inside the guitar module, behind a `Suspense` fallback (`MixerLoading`). No other section branches on the device; layout differences are CSS.
- **Motion starts on.** A first visit has `body[data-motion="full"]` even when the operating system asks for reduced motion; only a stored `erik.motion = off` starts it off. `pnpm install` also empties Next's legacy polyfill bundles in `node_modules` (`scripts/strip-next-polyfills.mjs`).
- **The ask log stores redacted text.** `lib/ask-log.ts` runs `redactPii` (emails and phone numbers) over the question and answer, cuts them to 500 and 1000 characters, and keeps the row 90 days; `/api/log/forget` deletes it by request id.
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
| `lib/*.client.ts(x)`           | the rare client-side lib (`use-breakpoint`, `error-bridge`, `request-refs`, `report-client-error`, `forget-request`, `use-copy-feedback`, `use-in-view`) |

## Things that look wrong but are intentional

- `/api/erik.json` does **not** use the `defineHandler` envelope. It's a machine-readable _document_, not an _operation_, so it returns raw JSON with long cache headers.
- The fixed-opacity color stops (`-subtle`, `-border`, ...) are explicit hex, not `color-mix()`. That's a byte-identical / contrast-stable choice.
- `lib/cn.ts` uses `clsx` but deliberately _not_ `tailwind-merge`, a bundle-budget call; the cost is that no two utilities in one component may set the same property, held by `__tests__/design-system-class-conflicts.test.tsx`.
- The DS docs `theme-tokens.ts` and the `contrast-check.mjs` gate parse `theme.css` with the _same regex_ on purpose, to read the same declarations. Parser changes still need comparison.

## "Where is X?" quick index

| Looking for...             | It's in...                                                |
| -------------------------- | --------------------------------------------------------- |
| the page composition       | `components/SiteHome.tsx`                                 |
| a section's copy           | `content/<section>.ts`                                    |
| the API contract           | `lib/server/route.ts` (`defineHandler`)                   |
| rate limits / spend budget | `lib/rate-limit.ts`                                       |
| the AI system prompt       | `lib/ask/system-prompt.ts` (facts in `content/ask-facts.ts`) |
| the ask request pipeline   | `lib/ask/preflight.ts` then `lib/ask/stream.ts`           |
| the AI evals               | `scripts/ask-eval.ts`, `scripts/agent-eval.ts`, `lib/eval/`, `content/ask-eval-*.ts`, `evals/agents/` |
| MCP tools                  | `lib/agent/mcp-tools.ts` (route in `app/api/mcp/route.ts`) |
| the section order and ids  | `content/section-registry.ts`                             |
| locale helpers and paths   | `content/site-locale.ts`                                  |
| the YouTube feed           | `lib/links/feed.ts`                                       |
| which CI jobs a change runs | `scripts/detect-changes-paths.mjs`                        |
| CSP / security headers     | `proxy.ts` (per-request) + `next.config.ts` (static)      |
| design tokens              | `app/css/theme.css` (`@theme`)                            |
| motion state               | `lib/motion.ts` + `body[data-motion]` (not React)         |
| cross-island events        | `lib/events.ts` (window CustomEvents)                     |
| why a decision was made    | `DECISIONS.md` (search by date/topic)                     |
| an enforcement rule        | `STANDARDS.md` (chapter) + `.husky/*` + `scripts/check-*` |
