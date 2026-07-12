# Remove the `<details>/<summary>` disclosure pattern — design

**Date:** 2026-07-12
**Status:** approved (owner), pending implementation plan

## Goal

Drop collapsible disclosure from the site entirely. Every page section, and every
design-system code preview, renders expanded, always. No visitor-facing collapse
affordance remains.

## Why

Owner decision: the collapse affordance is not a good idea for this site. The
`<details>` in `Module.tsx` is already hardcoded `open`, so the *default* experience
is fully expanded — the element only ever let a visitor collapse a section, and the
▸ chevron advertised an interaction that adds nothing. The pattern costs a11y
complexity (a disclosure widget plus 20 focusable tab stops) and dead machinery
(`module:open`) while buying no default-state benefit.

## Current state

- `components/responsive/Module/Module.tsx` renders `<details id open>` +
  `<summary>` (▸ chevron span + `<h2>` with icon and desktop/mobile header variants)
  + `<div class="module-body">`. **20 sections** consume it.
- `open` is hardcoded, so sections already render expanded. Content is already in the
  DOM at load.
- `app/design-system/_components/Preview.tsx` uses a separate `<details>/<summary>`
  as a "show code" toggle on the design-system docs pages.
- `components/AppShell/AppShell.client.tsx` listens for a `module:open` event and sets
  `target.open = true` on an `HTMLDetailsElement` (re-opens a collapsed section).
- `lib/events.ts` exports `dispatchModuleOpen(id)` and declares `'module:open'` in
  `WindowEventMap`. **It has zero call sites** — the whole event path is dead code.
- `app/css/components.css` carries `.module-chevron` (+ `[open]` rotation +
  reduce-motion rules), `.module-root::details-content`, and `[open]`-qualified
  `.module-body` / `.module-body-content` rules.

## Design

### 1. `Module.tsx` — the semantic swap

`<details>` → `<section>`; `<summary>` → a non-interactive `<header>`.

- `<section id={id} aria-labelledby={headerId}>` where `headerId` is derived from `id`.
  A titled page section is exactly what `<section>` + an accessible name is for. This
  replaces a disclosure widget with a named region.
- `<header>` wraps the existing `<h2 id={headerId}>` (icon + desktop/mobile header
  spans unchanged).
- **Delete the chevron** `<span className="module-chevron" aria-hidden>▸</span>`. A
  chevron's only meaning is "this expands/collapses"; keeping it after removing the
  behavior would be a lie the UI tells.
- Drop `cursor-pointer` and `focus-visible:outline-*` from the header — it is no
  longer focusable or activatable.
- **Keep** the mobile header-bar chrome (`bg-glow-04`, `border-b border-primary-quiet`,
  `min-h-11`, padding) and the desktop overrides. This is section-header styling, not
  disclosure styling.
- **Keep** `.module-body`, `.module-body-content`, `data-variant`, the `defer` prop,
  `data-cv-defer`, and `module-deferred`. The content-visibility perf deferral is
  orthogonal to disclosure and must survive.

Rejected alternatives: keeping `<details open>` and neutering `<summary>` with
`pointer-events: none` (still exposes a disclosure widget to assistive tech — the
a11y tree is what matters, not the pointer); and a bare `<div>` (throws away the
sectioning semantics for nothing).

### 2. `app/css/components.css`

- Delete `.module-chevron`, `.module-root[open] .module-chevron`, and the
  reduce-motion rules that reference `.module-chevron`.
- Delete `.module-root::details-content` (a `<details>`-only pseudo-element; it
  matches nothing once the element is a `<section>`).
- Strip the `[open]` qualifier from `.module-root[open] .module-body`,
  `.module-root[open] .module-body-content`, and their media-query variants — these
  styles now apply unconditionally.

The `[open]` attribute selectors are the sharp edge here: a `<section>` has no `open`
attribute, so any rule left qualified by `[open]` silently stops matching and its
declarations vanish. Every `[open]` rule must be either deleted or de-qualified —
none may be left as-is.

### 3. Dead-code removal

- `AppShell.client.tsx`: remove the `module:open` `useEffect` (listener, handler, and
  the `HTMLDetailsElement` narrowing). With no `<details>` and no dispatcher, it is
  unreachable.
- `lib/events.ts`: remove `dispatchModuleOpen` and the `'module:open'` entry from
  `WindowEventMap`. Leave the other event declarations untouched.

### 4. `Preview.tsx` (design-system)

Replace the `<details>/<summary>` code toggle with an always-rendered code block under
a static, non-interactive label. Keep the existing border/typography treatment so the
DS pages keep their visual rhythm; only the disclosure behavior goes.

### 5. Tests

- `components/responsive/Module/Module.test.tsx`: replace disclosure assertions with
  behavioral ones — the section renders, the `<h2>` header text renders (desktop and
  mobile variants), the body content is present **and visible without interaction**,
  and no `<summary>`/`<details>` element exists. Assert `aria-labelledby` resolves to
  the heading. Per the DS component pre-mortem: `querySelector` returns `null` (use
  `.not.toBeNull()`), and the component must survive being rendered twice — so the
  header id must derive from the `id` prop, never be hardcoded.
- `tests/visual/visual.spec.ts` test 5: delete the
  `if (el.tagName === 'details') el.open = true` shim — it becomes a no-op.
- Grep for any other test asserting `summary`, `details`, `module-chevron`, or
  `.open`.

## Consequences

**Accessibility — improves.** A disclosure widget becomes a named region; 20 focusable
`<summary>` tab stops disappear; heading structure is unchanged. axe-core and
Lighthouse a11y = 100 must still pass (they gate CI).

**Performance / CLS — no change.** Sections were already `open`, so no new content
enters the DOM at load. The `data-cv-defer` content-visibility deferral is preserved,
so the deferred-paint behavior that the perf budget depends on is untouched.

**Nothing is lost.** Because `open` was hardcoded, the default was already fully
expanded. We are removing an affordance a visitor had to go out of their way to use,
not a default behavior.

## Visual baselines — the real cost

Four of the five CI-gated captures in `tests/visual/visual.spec.ts` live inside a
`Module` and **will change** (the header loses its chevron and the summary becomes a
header):

| Capture | Section | Changes? |
|---|---|---|
| `contact-section` | `#sec-contact` (Module) | **yes** |
| `shell-idle` | `#sec-shell` (Module) | **yes** |
| `shell-mid-stream` | `#sec-shell` (Module) | **yes** |
| `hottest-takes-section` | `#sec-hottest-takes` (Module) | **yes** |
| `hero-above-fold` | plain `<section>`, not a Module | no |

This requires a full **darwin + linux** regen per `.claude/skills/visual-baseline-regen`
(darwin locally; linux via the `update_visual_baselines` CI dispatch + artifact
download), committed **in the same commit as the code** so the first CI run is green.
`tests/e2e/design-system-components.spec.ts` (darwin-only, ignored on Ubuntu in CI) may
also shift from the `Preview.tsx` change — regen darwin for it if so.

Baselines must be **inspected before committing**, never blind-updated.

## Failure modes (inversion — each becomes a plan task)

1. **Orphaned `[open]` CSS.** A `.module-root[open] …` rule left in place stops
   matching a `<section>` and its declarations silently disappear — the body loses
   padding/opacity/transform with no error. Mitigation: grep `[open]` in
   `components.css` and assert zero matches remain.
2. **`::details-content` left behind.** Same class of silent no-op.
3. **Duplicate id if a Module renders twice.** The header id must be derived from the
   `id` prop (`${id}-header`), never a constant.
4. **`aria-labelledby` pointing at nothing.** If the `<h2>` id and the
   `aria-labelledby` value drift, the region loses its accessible name — axe will not
   necessarily fail, so a behavioral test must assert the association.
5. **Deferral regression.** Dropping `data-cv-defer` / `module-deferred` while editing
   would silently change paint behavior and could move LCP/TBT. Assert the `defer`
   prop still emits the attribute.
6. **Stale baselines shipped.** Pushing code without regenerating all four baselines
   reds the visual gate. Batch code + darwin + linux baselines into one commit.
7. **Dead `module:open` type left in `WindowEventMap`.** Harmless but drifty; remove
   with the function.

## Out of scope

- Any redesign of section headers beyond removing the chevron.
- Touching the `defer` / content-visibility perf strategy.
- The `Hero` section (not a `Module`).

## Verification

`pnpm ci:local` · `pnpm test` (Module behavioral tests) · `pnpm gates:runtime`
(LHCI desktop + mobile, axe-core, e2e) · visual regression green on regenerated
baselines · `pnpm bundle-check`.
