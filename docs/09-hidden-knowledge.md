# Hidden Knowledge

> The tribal knowledge: implicit conventions, surprising behaviors, and "why is it like this" answers a new engineer would otherwise learn the hard way. Assume the reader knows none of it.

## Conventions you must follow (and the gate that catches you)

- **Client files are `*.client.tsx`.** A `'use client'` file elsewhere is drift (`check:client-naming`). *Exception that exists today:* `components/client/**` interactive files are `'use client'` but not suffixed `.client.tsx` - see "Surprising behaviors."
- **Content never lives in JSX.** All copy is a `content/*.ts` module validated by Zod at import. If you type user-facing text into a `.tsx`, you're doing it wrong.
- **No raw hex outside `app/css/theme.css`.** Use `var(--color-*)`. Enforced by `lint:css-tokens`. Complex CSS patterns become named classes in `components.css` `@layer components`; everything else is a Tailwind utility.
- **Per-keystroke/per-pixel/per-frame updates must not re-render React.** Mutate `textContent`/`style`/`setAttribute` directly, or rAF-coalesce. This is the single most important runtime convention (it's a budget, not a preference).
- **`CLAUDE.md` stays under 275 lines** (`check:harness-size`). New procedural rules go to a skill or a `.claude/rules/*` path-scoped file, not into `CLAUDE.md`.
- **pnpm only.** `bash-guard.sh` blocks npm/yarn. Deps are pinned (no `latest`).
- **Commit scope is required** (`commitlint`), and `(design-system)`-scoped commits must regenerate the changelog (`pnpm changelog:sync`).

## Surprising behaviors (the "wait, what?" list)

- **`proxy.ts` is Next.js middleware**, just named `proxy`. It sets CSP per-request; the *static* security headers live in `next.config.ts`. Two places on purpose.
- **The CSP is deliberately nonce-less** (`script-src 'self' 'unsafe-inline'`). Because `/` is static-generated, a nonce would break every inline RSC flight script (CSP-3 §6.7.2.4). This is documented at length and is not a vulnerability oversight.
- **`/api/ask` streaming is plain `text/plain` over a raw `ReadableStream`** - not SSE, and the AI SDK is server-side only. The wire protocol uses a NUL-prefixed `\x00ERR:` sentinel (`lib/stream-protocol.ts`) to carry mid-stream errors inside the text channel.
- **The AI persona can't drift from the page.** `lib/ask/system-prompt.ts` composes the system prompt from the *live* `content/*` modules, and `PROMPT_VERSION` is a content hash of the prompt bytes. Change the content, the persona changes, and the cache key changes - automatically.
- **The ask-eval corpus pulls ground truth from live content**, so if you change `visa.ts`/`projects.ts`/etc. and forget to update the corpus, the eval *fails* - that's the intended drift signal, not a flake.
- **The guitar signal chain is a Zod `tuple`, not an array** (`schemas.ts:105-108`). An array of length 4 would let two INPUT nodes pass validation and silently break the renderer. Same idea for the DAW mixer's `last === 'MASTER'` refine.
- **Everything fails open.** A Redis outage doesn't 500 anyone - rate-limits allow, budget allows, dedup allows, logs go quiet. The *real* backstop against runaway spend is an out-of-band Anthropic/Upstash billing alert, not the in-app limiter.
- **The token budget fails *closed* in exactly one spot:** if `/api/ask` can't resolve token usage, it keeps the reservation (so a metering bug can't leak spend). Redis-down is fail-open; usage-unresolvable is fail-closed. Both are deliberate.
- **`ASK_ENABLED` fails OFF; `LANGFUSE_ENABLED` fails OFF.** The kill switch must disable on a typo; the telemetry must stay inert unless the string is exactly `'true'`. Asymmetric by intent.
- **`StatusBar` initializes its clock to `''` and uses `suppressHydrationWarning`.** A `new Date()` at render would be a dynamicIO prerender hazard; the empty initial avoids prerendering a timestamp.
- **`next-env.d.ts` flips on a local prod build** (dev path ↔ prod path). A stray modified `next-env.d.ts` is a build artifact, not your change - `git checkout` it.
- **The MCP `ask_erik` tool shares one global rate-limit bucket.** It re-invokes `/api/ask` in-process via a synthetic `Request` with no IP header, so `getClientIp` returns `'unknown'` and every MCP caller worldwide hits the same `rl:ask` bucket. Documented limitation in `lib/agent/mcp-tools.ts`.
- **`/api/log/forget` never returns a deleted count**, and `/api/log` stores no IP. Both are anti-oracle / minimization choices, not omissions.

## Naming map (decode the filesystem)

| Pattern | Meaning |
|---|---|
| `Foo/Foo.tsx` + `Foo/index.ts` | one component per folder, barrel-exported |
| `*.client.tsx` | client island/chrome (ships JS) |
| `*Lazy.{tsx,client.tsx}` | `next/dynamic` wrapper for code-splitting |
| `*Desktop.tsx` / `*Mobile.tsx` | dual-variant inner RSC selected by `getIsMobile()` |
| `_components/` `_lib/` | route-private (underscore = not public API) |
| `sec-*` (id) | a page section; must have a mobile flex-order rule |
| `*.e2e.ts` / `*.test.tsx` | Playwright / Vitest, co-located |
| `lib/*.client.tsx` | the rare client-side lib (breakpoint, error-bridge) |

## Things that look wrong but are intentional

- `/api/erik.json` does **not** use the `defineHandler` envelope. It's a machine-readable *document*, not an *operation*, so it returns raw JSON with long cache headers.
- The fixed-opacity color stops (`-subtle`, `-border`, ...) are explicit hex, not `color-mix()`. That's a byte-identical / contrast-stable choice.
- `design-system/lib/cx.ts` reimplements a 3-line classname joiner instead of importing `clsx`/`tailwind-merge` - a bundle-budget call. (`lib/cn.ts` uses `clsx` but deliberately *not* `tailwind-merge`, for the same reason.)
- The DS docs `theme-tokens.ts` and the `contrast-check.mjs` gate parse `theme.css` with the *same regex* on purpose, so the docs and the gate can never disagree.

## "Where is X?" quick index

| Looking for... | It's in... |
|---|---|
| the page composition | `app/page.tsx` |
| a section's copy | `content/<section>.ts` |
| the API contract | `lib/server/route.ts` (`defineHandler`) |
| rate limits / token budget | `lib/rate-limit.ts` |
| the AI system prompt | `lib/ask/system-prompt.ts` |
| CSP / security headers | `proxy.ts` (per-request) + `next.config.ts` (static) |
| design tokens | `app/css/theme.css` (`@theme`) |
| motion state | `lib/motion.ts` + `body[data-motion]` (not React) |
| cross-island events | `lib/events.ts` (window CustomEvents) |
| why a decision was made | `DECISIONS.md` (search by date/topic) |
| an enforcement rule | `STANDARDS.md` (chapter) + `.claude/hooks/*` + `scripts/check-*` |
