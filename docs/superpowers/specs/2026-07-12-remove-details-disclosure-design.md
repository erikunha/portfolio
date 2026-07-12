# Remove the `<details>/<summary>` disclosure from page sections — design

**Date:** 2026-07-12
**Status:** approved (owner), pending implementation plan

## Goal

Remove the collapsible disclosure from **page sections**. Every section renders
expanded, always — no `<details>`, no `<summary>`, no chevron, no collapse affordance.

## Scope

**In scope:** `components/responsive/Module/Module.tsx` (the wrapper for all 20 page
sections) and everything coupled to its `<details>`-ness.

**Out of scope (owner call):** `app/design-system/_components/Preview.tsx` keeps its
`<details>/<summary>` "show code" toggle. That is a docs-page code disclosure, not a
page section, and collapsing a long code snippet there is legitimate progressive
disclosure. The design-system layout's mobile nav disclosure is likewise untouched.

## Why

The `<details>` in `Module.tsx` is hardcoded `open`, so the *default* experience is
already fully expanded. The element only ever let a visitor collapse a section, and
the ▸ chevron advertised an interaction that adds nothing. It costs a11y complexity
(a disclosure widget plus 20 focusable `<summary>` tab stops) and drags a whole
`module:open` event path along with it, while buying no default-state benefit.

## Current state

- `Module.tsx` renders `<details id open>` + `<summary>` (▸ chevron span + `<h2>` with
  icon and desktop/mobile header variants) + `<div class="module-body">`. **20
  sections** consume it.
- `open` is hardcoded — sections already render expanded; content is already in the DOM.
- **The `module:open` path is LIVE, not dead.** `Dock.client.tsx` `onJump` does:
  ```js
  if (el.tagName === 'DETAILS') dispatchModuleOpen(target);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  ```
  `lib/events.ts` exports `dispatchModuleOpen`; `AppShell.client.tsx` holds a single
  delegated listener that flips `target.open = true`. Purpose: open a section the
  visitor had collapsed *before* scrolling to it from the mobile Dock.
- `app/css/components.css` carries `.module-chevron` (+ `[open]` rotation +
  reduce-motion rules), `.module-root::details-content`, and `[open]`-qualified
  `.module-body` / `.module-body-content` rules.

## Design

### 1. `Module.tsx` — the semantic swap

- `<details id={id} open>` → `<section id={id} aria-labelledby={`${id}-header`}>`.
  A titled page section is exactly what `<section>` + an accessible name is for; this
  replaces a disclosure widget with a named region.
- `<summary>` → a non-interactive `<header>` wrapping the existing
  `<h2 id={`${id}-header`}>` (icon + desktop/mobile header spans unchanged).
- **Delete the chevron** `<span className="module-chevron" aria-hidden>▸</span>`. A
  chevron means "this expands/collapses"; keeping it after removing the behavior is a
  lie the UI tells.
- Drop `cursor-pointer` and `focus-visible:outline-*` from the header — it is no
  longer focusable or activatable.
- **Keep** the mobile header-bar chrome (`bg-glow-04`, `border-b border-primary-quiet`,
  `min-h-11`, padding) and the desktop overrides — that is section-header styling, not
  disclosure styling.
- **Keep** `.module-body`, `.module-body-content`, `data-variant`, the `defer` prop,
  `data-cv-defer`, `module-deferred`. The `content-visibility` deferral is orthogonal
  to disclosure and is load-bearing for the perf budget.

Rejected: keeping `<details open>` and neutering `<summary>` with
`pointer-events: none` (still exposes a disclosure widget to assistive tech — the a11y
tree is what matters, not the pointer); and a bare `<div>` (discards sectioning
semantics for nothing).

### 2. `app/css/components.css`

- Delete `.module-chevron`, `.module-root[open] .module-chevron`, and the
  reduce-motion rules referencing `.module-chevron`.
- Delete `.module-root::details-content` (a `<details>`-only pseudo-element).
- Strip the `[open]` qualifier from `.module-root[open] .module-body`,
  `.module-root[open] .module-body-content` and their media-query variants — these now
  apply unconditionally.

**This is the sharpest failure mode.** A `<section>` has no `open` attribute, so any
rule left qualified by `[open]` silently stops matching and its declarations vanish —
no error, no build failure, the body just loses its padding/opacity/transform. Every
`[open]` and `::details-content` occurrence must be deleted or de-qualified; none may
be left as-is.

### 3. Remove the `module:open` path (it becomes unnecessary)

Once sections are always expanded there is nothing to open, and `el.tagName === 'DETAILS'`
is never true. Remove the whole path together:

- `Dock.client.tsx`: drop the `if (el.tagName === 'DETAILS') dispatchModuleOpen(target)`
  branch and the `dispatchModuleOpen` import. `onJump` keeps `getElementById` +
  `scrollIntoView` — **the Dock still scrolls to the section, so there is no UX
  regression.**
- `AppShell.client.tsx`: remove the `module:open` `useEffect` (listener, handler,
  `HTMLDetailsElement` narrowing).
- `lib/events.ts`: remove `dispatchModuleOpen` and the `'module:open'` entry from
  `WindowEventMap`. Leave the other event declarations untouched.

### 4. Tests

- **Delete** `__tests__/appshell-module-open.test.tsx` — it tests a feature that no
  longer exists (opening a `<details>` from the event).
- `__tests__/events.test.ts` — remove the `dispatchModuleOpen` coverage; keep the rest.
- `__tests__/dock.test.tsx` — drop the "opens a collapsed section" assertion; keep and
  strengthen the assertion that clicking a Dock item scrolls to the target section.
- `components/responsive/Module/Module.test.tsx` — keep the `data-variant` and
  `data-cv-defer` behavioral tests (rename the `details` locals), and add: the section
  renders, the `<h2>` header text renders, the body content is **visible without any
  interaction**, no `<summary>`/`<details>` exists, and `aria-labelledby` resolves to
  the heading element.
- `tests/visual/visual.spec.ts` test 5 — delete the
  `if (el.tagName === 'details') el.open = true` shim; it becomes a no-op.

Per the DS component pre-mortem: `querySelector` returns `null` (assert
`.not.toBeNull()`), and the component must survive being rendered twice — so the header
id must derive from the `id` prop (`${id}-header`), never be hardcoded.

### 5. Docs (current-state only)

`STANDARDS.md` Ch.10 requires doc claims to match live code. Update:

- `docs/04-components-and-state.md:39` (Module renders `<details open>`, chevron, mobile
  collapsible chrome) and `:100` (Dock dispatches `module:open`, AppShell flips the
  `<details>`).
- `docs/08-performance-and-accessibility.md:65` ("sections are native
  `<details>`/`<summary>`").
- `docs/09-hidden-knowledge.md:27` (the Dock/`module:open` delegated-listener note).
- New ADR in `DECISIONS.md`.

**Do not rewrite historical records:** `docs/superpowers/plans/*`, `docs/audit/*`, older
`docs/superpowers/specs/*`, and existing dated ADR bullets (incl. the 2026-05-18
`content-visibility` ADR that mentions `details.module--mobile`) are point-in-time
history. The new ADR supersedes; it does not edit the past.

## Consequences

**Accessibility — improves.** A disclosure widget becomes a named region; 20 focusable
`<summary>` tab stops disappear; heading structure is unchanged. axe-core and
Lighthouse a11y = 100 gate CI and must still pass.

**Performance / CLS — no change.** Sections were already `open`; no new content enters
the DOM at load. `content-visibility` deferral is preserved.

**No UX regression.** The default was already fully expanded, so we remove an affordance
a visitor had to go out of their way to use — not a default. Dock navigation still
scrolls to sections.

## Visual baselines — the real cost

Four of the five CI-gated captures in `tests/visual/visual.spec.ts` live inside a
`Module` and **will change** (the header loses its chevron; the summary becomes a
header):

| Capture | Section | Changes? |
|---|---|---|
| `contact-section` | `#sec-contact` (Module) | **yes** |
| `shell-idle` | `#sec-shell` (Module) | **yes** |
| `shell-mid-stream` | `#sec-shell` (Module) | **yes** |
| `hottest-takes-section` | `#sec-hottest-takes` (Module) | **yes** |
| `hero-above-fold` | plain `<section>`, not a Module | no |

Requires a full **darwin + linux** regen per `.claude/skills/visual-baseline-regen`
(darwin locally; linux via the `update_visual_baselines` CI dispatch + artifact
download), committed **in the same commit as the code** so the first CI run is green.
Baselines must be **inspected before committing**, never blind-updated.

`tests/e2e/design-system-components.spec.ts` baselines are **not** expected to change —
`Preview.tsx` is out of scope.

## Failure modes (inversion — each becomes a plan task)

1. **Orphaned `[open]` CSS.** A `.module-root[open] …` rule left in place stops matching
   a `<section>` and its declarations silently disappear — no error. Verify: grep
   `[open]` and `::details-content` in `components.css`, assert zero matches.
2. **Duplicate id when a Module renders twice.** The header id must derive from the `id`
   prop, never a constant.
3. **`aria-labelledby` pointing at nothing.** If the `<h2>` id and the `aria-labelledby`
   value drift, the region silently loses its accessible name — axe may not fail, so a
   behavioral test must assert the association.
4. **Deferral regression.** Dropping `data-cv-defer` / `module-deferred` while editing
   would silently change paint behavior and could move LCP/TBT. Assert `defer` still
   emits the attribute.
5. **Dock left dispatching into the void.** If the Dock's `DETAILS` branch is removed but
   `dispatchModuleOpen` is not (or vice versa), we leave a dead export or a dangling
   import. Remove Dock branch + AppShell listener + `lib/events.ts` export + the
   `WindowEventMap` entry together, and delete the AppShell test.
6. **Dock scroll broken.** Editing `onJump` must not disturb `scrollIntoView` — a test
   must assert Dock navigation still scrolls to the target.
7. **Stale baselines shipped.** Pushing code without regenerating all four baselines reds
   the visual gate. Batch code + darwin + linux baselines into one commit.
8. **Stale doc claims.** `docs/04`, `docs/08`, `docs/09` assert the `<details>` design;
   left unedited they violate STANDARDS Ch.10.

## Verification

`pnpm ci:local` · `pnpm test` · `pnpm gates:runtime` (LHCI desktop + mobile, axe-core,
e2e) · visual regression green on regenerated baselines · `pnpm bundle-check` ·
grep `[open]`/`::details-content`/`<details`/`<summary` in `components/` + `app/css/`
returns zero matches outside `app/design-system/`.
