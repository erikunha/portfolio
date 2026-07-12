# Remove `<details>/<summary>` from the codebase — design

**Date:** 2026-07-12
**Status:** approved (owner); revised after architect gate (BLOCK → corrections applied)

## Goal

Remove collapsible disclosure entirely. Page sections and design-system code previews
render expanded, always. After this change `<details>`, `<summary>`, `::details-content`,
`[open]`, and `HTMLDetailsElement` appear **nowhere** in `components/`, `app/`, `lib/`, or
`design-system/`.

## Why

`Module.tsx`'s `<details>` is hardcoded `open`, so the *default* is already fully expanded
— the element only ever let a visitor collapse a section, and the ▸ chevron advertised an
interaction that adds nothing. It costs a11y complexity (a disclosure widget plus 20
focusable `<summary>` tab stops) and drags a whole `module:open` event path with it. The
design-system "VIEW SOURCE" toggle hides the one thing a reader of a component doc page
came for.

## Verified current state (all facts below were checked against the code)

- `components/responsive/Module/Module.tsx` renders `<details id open>` + `<summary>`
  (▸ chevron span + `<h2>`) + `<div class="module-body">`. **20 sections** consume it.
  `open` is hardcoded (`Module.tsx:34`).
- **The `module:open` path is LIVE.** `Dock.client.tsx:3` imports `dispatchModuleOpen`;
  `:88` calls it when `el.tagName === 'DETAILS'`, then `scrollIntoView`. `lib/events.ts`
  exports it; `AppShell.client.tsx` holds the delegated listener that sets `open = true`.
- **`Preview.tsx`'s `source` prop IS populated — at build time.**
  `lib/mdx/remark-preview-source.mjs` (a remark plugin wired in `next.config.ts:11`)
  injects it. Proof: the prerendered `/design-system/components` HTML contains **9
  `<details>` and 18 `VIEW SOURCE`**. The MDX call sites pass only `id`, which is why a
  naive `grep "source="` finds nothing. **Do not delete the `source` prop or the plugin.**
- `app/css/components.css`:
  ```css
  .module-body            { display: grid; grid-template-rows: 0fr; transition: …; }
  .module-root[open] .module-body { grid-template-rows: 1fr; transition: …; }
  .module-body-content    { opacity: 0; }        /* + transform */
  .module-root[open] .module-body-content { opacity: 1; }
  .module-chevron         { font-size: 24px; transition: transform …; }
  .module-root[open] .module-chevron { transform: rotate(90deg); }
  .module-root::details-content { … }
  ```
  plus `prefers-reduced-motion` / `body[data-motion="reduce"]` guards (≈lines 120-138).
- **No rule hides `.module-chevron` at any breakpoint.** It renders on desktop at 24px in a
  flex row whose `<h2>` is 12px, while the summary is `md:py-0 md:min-h-0`.

## Design

### 1. `Module.tsx` — the semantic swap

- `<details id={id} open>` → `<section id={id} tabIndex={-1} aria-labelledby={HEADER_ID(id)}>`.
- `<summary>` → a non-interactive `<header>` wrapping the existing `<h2 id={HEADER_ID(id)}>`.
- **`tabIndex={-1}` is required, not cosmetic.** `DesktopTopbar.client.tsx` links to
  `#sec-projects | #sec-perf-receipts | #sec-npm-stack | #sec-contact` with plain `href`
  and **no `preventDefault`** — native fragment navigation. `<details>` is a *focusable*
  element, so today the browser moves real DOM focus to the target on a hash jump. A bare
  `<section>` is not focusable and would fall back to the sequential-focus starting point,
  which is weakest in WebKit — and `webkit-desktop` + `webkit-mobile` are both gated
  projects. `tabIndex={-1}` adds **zero tab stops** (it is not tabbable) and only restores
  programmatic focusability, so fragment navigation lands. This is the codebase's own
  established pattern (`app/page.tsx`: `<main id="main-content" tabIndex={-1}>` for the
  skip link). No focus ring appears on click because `:focus-visible` will not match.
  (The Dock is unaffected either way — it `preventDefault`s, so focus never moved.)
- **Delete the chevron span.** A chevron means "this expands/collapses"; keeping it after
  removing the behavior is a lie the UI tells.
- Drop `cursor-pointer` and `focus-visible:outline-*` — the header is no longer focusable
  or activatable.
- **Keep** the mobile header-bar chrome (`bg-glow-04`, `border-b`, `min-h-11`, padding) and
  desktop overrides — section-header styling, not disclosure styling.
- **Keep** `.module-body`, `.module-body-content`, `data-variant`, `defer`, `data-cv-defer`,
  `module-deferred`. `content-visibility` deferral is orthogonal to disclosure and is
  load-bearing for the perf budget. (Confirmed safe: both attributes sit on the *root*, and
  `content-visibility: auto` behaves identically on `<section>`;
  `tests/e2e/_helpers/snapshot.ts` keys off `[data-cv-defer]` and still works.)

Rejected: `<details open>` + `pointer-events: none` on the summary (still exposes a
disclosure widget to assistive tech — the a11y tree is what matters, not the pointer); and
a bare `<div>` (discards sectioning semantics for nothing).

### 2. `app/css/components.css` — delete the collapse machinery (do NOT merely "de-qualify")

**Severity: site-breaking if done wrong.** The base state is *collapsed*, not "unstyled":
`.module-body` is `grid-template-rows: 0fr` and `.module-body-content` is `opacity: 0`, with
an inner `overflow-hidden`. A `<section>` has no `open` attribute, so any surviving
`.module-root[open] …` rule stops matching and **every section body collapses to zero height
and zero opacity — the entire site's content disappears.** No error, no build failure.

Mechanically stripping the `[open]` qualifier is also wrong: it yields contradictory
duplicate rules (`0fr` then `1fr`; `opacity: 0` then `opacity: 1`) and transitions that can
never fire. Correct instruction:

- **Merge** each `[open]` pair into a single unconditional rule carrying the expanded value
  (`grid-template-rows: 1fr`, `opacity: 1`, no transform offset). Better: since nothing
  collapses any more, delete the grid-rows collapse trick entirely and let the body be a
  normal block.
- Delete `.module-chevron` and `.module-root[open] .module-chevron`.
- Delete `.module-root::details-content`.
- Delete the now-unreachable transitions **and** their `prefers-reduced-motion` /
  `body[data-motion="reduce"]` counterparts (≈120-138), which would otherwise guard
  transitions that no longer exist.

**Also remove the collapse scaffolding itself** (explicit decision, not left open):
`.module-body`'s `display: grid` + `contain: layout style` and the inner
`<div className="min-h-0 overflow-hidden">` in `Module.tsx` exist **only** to make the
0fr→1fr grid-row collapse animate and clip. With nothing collapsing they are dead weight,
and a permanent `overflow: hidden` on an always-expanded body is a live **clipping hazard
for focus rings** on interactive content at the body's edge (the contact form sits inside
one). Delete the inner div and let the body be a normal block. This shifts the baselines
slightly further — accounted for in the regen below.

Verification is a **rendered-height assertion**, not just a grep: a behavioral test must
assert a section body has non-zero height and is visible. Unit tests that render to static
markup run **without CSS** and cannot catch this class — only a rendered/visual check can.

### 3. Remove the `module:open` path (as a unit)

- `Dock.client.tsx`: drop the `DETAILS` branch **and** the `dispatchModuleOpen` import.
  `onJump` keeps `preventDefault` + `getElementById` + `scrollIntoView` — **the Dock still
  scrolls, so no UX regression.**
- `AppShell.client.tsx`: remove the `module:open` `useEffect`.
- `lib/events.ts`: remove `dispatchModuleOpen` and the `'module:open'` `WindowEventMap`
  entry. Leave other events untouched.

Removing the export while Dock still imports it fails `typecheck`/`build` on a dangling
import — these three edits ship together.

### 4. `Preview.tsx` (design-system) — always render the source

- Replace `<details>/<summary>` with an always-rendered block: a static non-interactive
  label above the existing `<pre><code>`. Drop `cursor-pointer` and the `hover:` colour.
- **Keep the `source` prop and the remark plugin.** They are live (see Verified state).
- **The `<pre>` must become keyboard-focusable.** It is `overflow-x-auto` — a horizontally
  scrollable region. Today it is hidden inside a collapsed `<details>`, so axe skips it.
  Rendering it unconditionally makes axe's `scrollable-region-focusable` rule apply
  (WCAG 2.1.1), and axe gates all five `/design-system/*` routes. Give it `tabIndex={0}`
  and an `aria-label`.
  **Do not add `role="region"`** — the axe rule requires *focusability only*, and the role
  would promote every code block on `/design-system/components` (~6 previews) to a
  landmark. `tabIndex={0}` + `aria-label` satisfies the rule without landmark spam.

### 5. No magic values — shared consts/types in their own files (owner rule)

Literals must not be inlined. Extract into named consts/types in **separate, reusable
modules**, not buried in the component:

- `components/responsive/Module/module.constants.ts` — the header-id builder
  (`HEADER_ID = (id: string) => \`${id}-header\``), the body-id builder (already
  `${id}-body`), and any repeated class/aria strings. Export the `ModuleProps` variant union
  as a named type.
- `app/design-system/_components/preview.constants.ts` — the source label and the `<pre>`
  `aria-label`.

Rationale: the id suffixes are referenced from both the component and its tests; a shared
const makes the `aria-labelledby` ↔ `<h2 id>` contract impossible to drift (failure mode 4).
Test files remain exempt from the literal rule.

### 6. Tests — full surface (verified counts)

| File | Action |
|---|---|
| `__tests__/events.test.ts` | **DELETE** — the entire file is `describe('dispatchModuleOpen')` (4 tests) |
| `__tests__/appshell-module-open.test.tsx` | **DELETE** — tests the `module:open` listener |
| `__tests__/sections-smoke.test.tsx` | **REWRITE** — 28 `summary`/`details` refs across ~10 sections |
| `__tests__/dock.test.tsx` | 7 refs — drop the DETAILS→dispatch assertions; **keep/strengthen** a scroll-to-target assertion |
| `__tests__/perf-receipts-section.test.tsx` | 2 refs |
| `__tests__/readme-section.test.tsx` | 2 refs |
| `components/responsive/Module/Module.test.tsx` | `querySelector('details')` → `section`; add the new assertions below |
| `tests/e2e/design-system-pages.spec.ts:19` | "source toggle" premise gone → assert source visible **without interaction** + `<pre>` focusable |
| `tests/visual/visual.spec.ts:120` | delete the `.open = true` shim (no-op) |

Deleting two test files is an explicit coverage decision, not a side effect: both cover a
feature that ceases to exist. Net coverage must not drop for anything that *survives* —
hence the Dock scroll assertion is mandatory.

New `Module.test.tsx` assertions: the section renders; the `<h2>` text renders (desktop and
mobile variants); **body content is visible and has non-zero height without any
interaction** (guards failure mode 1); no `<summary>`/`<details>` exists;
`aria-labelledby` resolves to the heading; `defer` still emits `data-cv-defer`. Per the DS
pre-mortem: `querySelector` returns `null` (`.not.toBeNull()`), and rendering the component
twice must not collide — the header id derives from the `id` prop.

### 7. Docs (current-state only) — STANDARDS Ch.10 gates this

- `ARCHITECTURE.md:216` — `lib/events.ts # typed dispatchModuleOpen helper`
- `docs/04-components-and-state.md` — `:29` (mermaid "native details/summary"), `:39`
  (prose), `:92`/`:93` (mermaid `module:open` → "flips details open"), `:100` (prose)
- `docs/08-performance-and-accessibility.md:65` — "sections are native `<details>`/`<summary>`"
- `docs/09-hidden-knowledge.md` — `:27` (Dock/`module:open`), `:51` ("one details element
  per viewport")
- New ADR in `DECISIONS.md`.

Note `docs/04:39` also claims *"Desktop CSS hides the chevron so it reads as a plain `<h2>`"*
— **already false** (no rule hides it at any breakpoint). Correct it; do not propagate.

**Do not rewrite history:** `docs/superpowers/plans/*`, `docs/audit/*`, older specs, and
existing dated ADR bullets are point-in-time records. The new ADR supersedes.

## Consequences

**Accessibility — net improvement, with one new obligation.** A disclosure widget becomes a
named region; 20 `<summary>` tab stops disappear; heading order unchanged. `<header>` scoped
to `<section>` is *not* a banner landmark (banner applies only when scoped to `<body>`), so
no `landmark-banner-is-top-level` misfire; `aria-labelledby` yields 20 uniquely-named regions
(`landmark-unique` passes). The new obligation is the focusable `<pre>` (§4) — without it
this change would *red* the a11y gate it otherwise improves.

**Performance / CLS — no change for sections.** They were already `open`; no new content
enters the DOM at load; `content-visibility` deferral preserved. Client JS strictly shrinks
(the AppShell listener goes). DS pages get no taller — their source already renders.

**No UX regression.** The default was already fully expanded. Dock navigation still scrolls.

## Visual baselines — the real cost

**The predicate is "can anything above the captured section move," not "is the capture inside
a Module"** (per the `baseline-impact-layout-shift` rule). The 24px chevron sets the desktop
module-header row height; deleting it **shrinks every module header and shifts everything
below it upward, cumulatively down the page**. Expect diffs larger than a glyph-sized delete.

**CI-gated (`tests/visual/visual.spec.ts`) — darwin + linux regen.**

| Capture | Section | Changes? |
|---|---|---|
| `hero-above-fold` | plain `<section>`, sits **above** every Module | no |
| `contact-section` | `#sec-contact` (Module) | **yes** |
| `shell-idle` | `#sec-shell` (Module) | **yes** |
| `shell-mid-stream` | `#sec-shell` (Module) | **yes** |
| `hottest-takes-section` | `#sec-hottest-takes` (Module) | **yes** |

**DS component baselines (`tests/e2e/design-system-components.spec.ts`) — darwin regen only**
(the spec is `testIgnore`d on Ubuntu). It captures
`/design-system/components#button|field|badge|terminal-panel|stat-tile|cmd-line`, each
rendering a `<Preview source>` whose disclosure currently collapses the source. Removing the
`<summary>` row changes every one.

Follow `.claude/skills/visual-baseline-regen`: darwin locally; linux via the
`update_visual_baselines` CI dispatch + artifact download; **both sets committed in the same
commit as the code** so the first CI run is green. **Inspect every regenerated PNG before
committing.**

## Failure modes (inversion — each becomes a plan task)

1. **Orphaned/naively-de-qualified `[open]` CSS → the whole site goes blank.** Base state is
   `0fr` + `opacity: 0`. Merge (don't strip) and assert **rendered non-zero body height** in a
   test; grep `[open]` / `::details-content` → zero matches.
2. **axe `scrollable-region-focusable` regression.** The always-visible `overflow-x-auto`
   `<pre>` needs `tabIndex={0}` + `aria-label` (no `role="region"`), or the a11y gate reds
   on 5 DS routes.
2b. **Hash-link focus regression.** `DesktopTopbar` uses native fragment nav with no
   `preventDefault`; `<details>` was focusable, a bare `<section>` is not, so focus would
   stop landing on the target (weakest in the gated WebKit projects). Mitigate with
   `tabIndex={-1}` on the section; assert a hash jump moves focus to the section.
2c. **Focus-ring clipping.** Leaving the inner `overflow-hidden` collapse-scaffold div in
   place would clip focus rings on interactive content at the body's edge (the contact form
   lives inside one). Delete the inner div with the grid/`contain` scaffolding.
3. **Dangling import breaks the build.** Removing `dispatchModuleOpen` while `Dock` still
   imports it fails typecheck/build. Ship Dock + AppShell + `lib/events` together.
4. **`aria-labelledby` ↔ `<h2 id>` drift** silently loses the region's accessible name (axe
   may not fail). Shared const (§5) + a behavioral assertion.
5. **Duplicate id when a Module renders twice.** Header id derives from the `id` prop.
6. **Deferral regression.** Assert `defer` still emits `data-cv-defer`.
7. **Dock scroll broken.** Editing `onJump` must not disturb `scrollIntoView` — assert it.
8. **Deleting `source`/the remark plugin** would strip all DS source display. It is live —
   keep it.
9. **Stale baselines shipped.** Both sets regenerated (CI-gated: darwin + linux; DS: darwin),
   batched into one commit.
10. **Stale doc claims** (8 sites incl. `ARCHITECTURE.md:216`) violate STANDARDS Ch.10.

## Verification

`pnpm ci:local` · `pnpm test` · `pnpm gates:runtime` (LHCI desktop + mobile, axe on all 5 DS
routes, e2e) · visual regression green on **both** regenerated baseline sets ·
`pnpm bundle-check` · final sweep:
`grep -rn '<details\|<summary\|::details-content\|\[open\]\|HTMLDetailsElement\|dispatchModuleOpen' components/ app/ lib/ design-system/`
returns **zero** matches.
