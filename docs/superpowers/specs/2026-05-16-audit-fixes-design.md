# Audit Fixes Design

> Auto-generated from brainstorming session on 2026-05-16. Source: full project quality audit (21 findings).

## Goal

Fix all 21 findings from the 2026-05-16 quality audit in a single, ordered implementation plan. Five thematic tasks, one commit each, executed sequentially by subagents.

## Architecture

No new files, no new abstractions. Every fix is a targeted edit to existing code:
- Content modules already have Zod schemas — section components just need to consume them
- `lib/motion.ts` already exports `readMotion()` — islands just need to call it
- `biome.json` and `tsconfig.json` already have the right flags — one needs a level bump
- Upstash client already supports pipelining — `incrementBudget` needs rewiring

## Tech stack

Next.js 15 App Router · React 19 · TypeScript strict · Biome · Upstash Redis · pnpm

---

## Task 1 — Content migration (findings #5, #10)

**Scope:** Move all inlined user-facing copy from JSX into `content/*.ts` modules. Fix `not-found.tsx`.

**Files to modify:**
- `components/sections/ReadmeSection.tsx`
- `components/sections/Footer.tsx` (DMESG kernel log entries)
- `components/sections/VisaSection.tsx`
- `components/sections/GuitarSection.tsx`
- `components/sections/ManPageSection.tsx`
- `components/sections/HottestTakesSection.tsx`
- `components/sections/UnknownsSection.tsx`
- `components/sections/ResponsibilitiesSection.tsx`
- `components/sections/CredentialsSection.tsx`
- `app/not-found.tsx`

**Content files to create or extend:**
- `content/readme.ts` — README desktop + mobile prose
- `content/dmesg.ts` — DMESG kernel log lines (Footer)
- Extend existing `content/visa.ts`, `content/guitar-rig.ts`, `content/man-page.ts`, `content/unknowns.ts`, `content/responsibilities.ts`, `content/credentials.ts` with any missing fields

**Rules:**
- Every content module must export a Zod-validated type from `content/schemas.ts`
- Section components consume the typed export — no raw strings in JSX
- `ManPageSection.tsx` has two sources of truth for the DESCRIPTION text (JSX and `content/man-page.ts` `descriptionMobile`). Unify: one field in content, both desktop and mobile read it
- `not-found.tsx`: remove `CRTOverlay` import (eliminates client island on 404), move any text to a content constant or inline static string in the server component

**Verification:**
- `pnpm validate-content` passes (Zod gates at build time)
- `pnpm ci:local` clean
- Visual spot-check: each migrated section renders identically

---

## Task 2 — Motion & a11y (findings #2, #4, #7, #9, #21)

**Scope:** Fix the user-controlled motion toggle bypass, add visibility-aware pausing, tighten contact form a11y, fix skip-to-content.

**Files to modify:**
- `components/sections/Hero.tsx`
- `components/responsive/MatrixRain.tsx`
- `components/client/RoleTyper.tsx`
- `components/client/InteractiveShell.tsx`
- `components/sections/Footer.tsx`
- `components/responsive/StatusBar.tsx`
- `components/client/ContactForm.tsx`
- `app/page.tsx`
- `app/css/_base.css`

**Changes:**

**Motion toggle fix (finding #7):**
Replace every `window.matchMedia('(prefers-reduced-motion: reduce)').matches` call with `readMotion()` from `lib/motion.ts` (inverted: `if (!readMotion()) { ...render static fallback... }`). Affected: `Hero.tsx` lines 251 and 369, `MatrixRain.tsx` line 34, `RoleTyper.tsx` line 19, `InteractiveShell.tsx` line 53.

**Visibility pause (finding #2):**
Subscribe the following to `document.visibilitychange`:
- `Hero.tsx` boot dialog `tick()` — call `ctrl.pauseDialog()` on hidden, `ctrl.resumeDialog()` on visible
- `Footer.tsx` clock `setInterval` — clear on hidden, restart on visible
- `StatusBar.tsx` clock `setInterval` — same pattern

`MatrixRain.tsx` already implements this correctly. Use the same pattern.

**Contact form a11y (finding #4):**
- Add `aria-busy={status === 'submitting'}` to the `<form>` element
- Wrap the submit button + status text in `aria-live="polite"`
- Add `role="status"` to the success state container

**Skip-to-content focusability (finding #9):**
- Add `tabIndex={-1}` to `<main id="main-content">` in `app/page.tsx`

**Skip-to-content CSS (finding #21):**
- Replace `top: -100%` with `clip-path: inset(50%); overflow: hidden` in `app/css/_base.css` `.skip-to-content` rule

**Verification:**
- `motion.test.ts`, `skip-to-content.test.ts`, `sysfail-loop.test.ts` still pass
- Manual: enable motion via topbar toggle → Hero boot, MatrixRain, RoleTyper all animate. Disable → all stop.
- Manual: keyboard-only navigation — skip link moves focus to `<main>`
- Manual: VoiceOver on contact form — "TRANSMITTING..." and success state announced

---

## Task 3 — Type safety (findings #1, #3, #6, #8, #20)

**Scope:** Eliminate non-null assertions in MatrixRain, fix Hero ref ordering, replace hardcoded font size, tighten Biome config, add typed custom event map.

**Files to modify:**
- `components/responsive/MatrixRain.tsx`
- `components/sections/Hero.tsx`
- `components/sections/GuitarSection.tsx`
- `biome.json`
- `lib/events.ts` (new file) or `app/globals.d.ts` (extend existing global declarations)

**Changes:**

**MatrixRain non-null assertions (finding #1):**
Inside `useEffect`, after the early-return guard that confirms `canvas` and `ctx` are non-null, bind:
```ts
const canvasEl = canvas;
const ctxEl = ctx;
```
Replace all `canvas!` with `canvasEl` and all `ctx!` with `ctxEl` throughout the closures. Removes all 11 assertions without changing behavior.

**Hero onFirstLoop ref (finding #3):**
In `DesktopHero` `useEffect`, capture `ctrl` from the `runBoot` return value and reference it directly in the `onFirstLoop` closure instead of reading `bootCtrl.current`. The `bootCtrl` ref is still needed for the effect cleanup return, but `onFirstLoop` should close over `ctrl` directly.

**GuitarSection font size (finding #6):**
Replace `fontSize: '11.5px'` inline style with a CSS class. Add `.guitar__spec-label { font-size: var(--fs-xs); }` to `app/css/_sections.css` and apply the class in `GuitarSection.tsx`.

**Biome config (finding #8):**
In `biome.json`, change `useExhaustiveDependencies` from `"warn"` to `"error"`. Fix any newly-surfaced violations before committing.

**Custom event types (finding #20):**
Add a global `WindowEventMap` extension. Either extend `app/globals.d.ts` or create `lib/events.ts`:
```ts
declare global {
  interface WindowEventMap {
    'module:open': CustomEvent<{ id: string }>;
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
  }
}
```
Remove all `as CustomEvent<...>` casts in consumer files — TypeScript now knows the type from the listener signature.

**Verification:**
- `pnpm tsc --noEmit` — zero errors
- `pnpm biome check .` — zero errors (no warnings promoted to errors)
- `matrix-rain.test.ts` still passes

---

## Task 4 — API & infra (findings #12, #13, #18, #19)

**Scope:** Deduplicate IP extraction, clean up `getBudgetKey` calls, fix InteractiveShell stream memory, make Redis budget increment atomic.

**Files to modify:**
- `lib/rate-limit.ts`
- `app/api/ask/route.ts`
- `app/api/contact/route.ts`
- `components/client/InteractiveShell.tsx`

**Changes:**

**Deduplicate IP extraction (finding #12):**
Add to `lib/rate-limit.ts`:
```ts
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
```
Remove the duplicated 4-line block from `ask/route.ts` and `contact/route.ts`, import `getClientIp` instead.

**getBudgetKey cache (finding #13):**
In `incrementBudget`, assign `const key = getBudgetKey()` once at the top of the function and use `key` throughout. Remove the two extra `getBudgetKey()` calls.

**Atomic Redis increment (finding #19):**
Replace the `incrby` + `.then` + `expire NX` chain in `incrementBudget` with an Upstash pipeline:
```ts
const pipe = getRedis().pipeline();
pipe.incrby(key, tokens);
pipe.expire(key, BUDGET_WINDOW_S, 'NX');
const [newTotal] = await pipe.exec<[number, number]>();
return newTotal;
```

**InteractiveShell stream rendering (finding #18):**
For the active streaming line, use a `useRef` pointing to the DOM node for the streaming `<span>` and mutate its `textContent` directly per chunk. On stream close, snapshot the completed text into the `history` state. This matches the pattern already used by `Hero.tsx` for the Matrix dialog loop and avoids O(n) array copies per chunk.

**Verification:**
- `redis-singleton.test.ts`, `budget-cap.test.ts` still pass
- `pnpm ci:local` clean
- Manual: ask the shell a question — streaming renders correctly, history preserved after stream closes

---

## Task 5 — Minor cleanup (findings #11, #14, #15, #16, #17)

**Scope:** use-breakpoint hydration, missing mobileHeader, stable React keys, CSP comment, font preload.

**Files to modify:**
- `lib/use-breakpoint.tsx`
- `components/sections/ContactSection.tsx`
- `components/sections/Footer.tsx`
- `components/sections/ReadmeSection.tsx`
- `components/sections/GitLogSection.tsx`
- `middleware.ts`
- `app/layout.tsx`

**Changes:**

**use-breakpoint (finding #11):**
Migrate from `useState` + `useEffect` pattern to `useSyncExternalStore` against the `matchMedia` media query. This eliminates the post-mount state flip and the hydration mismatch window:
```ts
const isMobile = useSyncExternalStore(
  (cb) => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
  () => mq.matches,
  () => false, // SSR snapshot — always assume desktop
);
```

**ContactSection mobileHeader (finding #14):**
Add `mobileHeader="CONTACT"` (or equivalent short label matching the pattern used by other sections) to the `<Module>` call in `ContactSection.tsx`.

**Stable React keys (finding #15):**
- `Footer.tsx` DMESG list: use the log line content or a slug derived from it as key (after Task 1, the content will be a typed array — use a stable `id` or `timestamp` field)
- `ReadmeSection.tsx`: use section heading or index derived from content structure
- `GitLogSection.tsx`: use commit hash as key (already available in the data shape)

**CSP comment (finding #16):**
In `middleware.ts`, add a one-line comment above `style-src 'unsafe-inline'`:
```ts
// 'unsafe-inline' required: Tailwind v4 injects styles at runtime; React inline style props cannot use nonces
"style-src 'self' 'unsafe-inline'",
```

**Display font preload (finding #17):**
In `app/layout.tsx`, set `preload: false` on the `inter-900.woff2` display font. It is only used for `.hero__name` on desktop — mobile overrides it to the mono stack. The font will still load on demand when the CSS rule is matched.

**Verification:**
- `pnpm ci:local` clean
- Manual: mobile viewport — no flash of wrong layout on first paint (use-breakpoint fix)
- Manual: contact section on mobile — short header visible in dock/module header
- Visual: check Footer, ReadmeSection, GitLogSection render identically (key changes are non-visual)

---

## Execution order rationale

| # | Task | Rationale |
|---|---|---|
| 1 | Content migration | Largest structural change; isolate first |
| 2 | Motion & a11y | Most user-visible Important findings; no dependency on Task 1 |
| 3 | Type safety | Biome level-up may surface violations — run after content/motion are committed |
| 4 | API & infra | Server-side only, low UI risk |
| 5 | Minor cleanup | No dependencies, safe final sweep |

Each task ends with `pnpm ci:local` (Biome + tsc + validate-content + Vitest) passing before committing.
