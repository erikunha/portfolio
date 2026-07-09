# Visual tweaks + nav sidebar — design

**Date:** 2026-07-08
**Status:** Approved (user, 2026-07-08)
**Scope:** Two independent parts, shipped as two PRs. Part A: seven targeted visual tweaks. Part B: a slide-in navigation sidebar for desktop and mobile.

## Part A — Visual tweaks

All color changes use the existing `text-primary-400` token (`#4ade80`, identical to Tailwind `green-400`). No new tokens, no raw hex. `lint:contrast` mechanically verifies contrast; green-400 on `#000` passes WCAG AA for small text.

Decision (user, 2026-07-08): recolor applies to the **whole style group**, not only the literally quoted strings — a single green caption among gray siblings inside the same panel row would be inconsistent.

### A1 — Green-400 recolor

| # | File / site | Current | Change |
|---|---|---|---|
| 1 | `components/sections/LivePerfSection/LivePerfSection.tsx` footer row (`SOURCE: PageSpeed Insights · <strategy>` + `LAST_CHECK`) | `text-secondary-200` | `text-primary-400` |
| 2 | `components/sections/AiMetricsSection/AiMetricsSection.tsx` — all four metric captions (lines 61/72/83/94, includes "end-to-end · slowest 5% of answers") | `text-secondary-200` | `text-primary-400` |
| 3 | `components/sections/GitLogSection/GitLogSection.tsx` — commit body spans at all three render sites (lines 60/103/147; includes "first job. shipped 5-OS cross-platform from one Ionic + Angular + Electron codebase.") | `text-tertiary-50` | `text-primary-400` |
| 4 | `components/sections/HottestTakesSection/HottestTakesSection.tsx` footer ("willing to be wrong on any of these. willing to argue first.") — container div and `>` prefix span | `text-primary-500` | `text-primary-400` |
| 5 | `components/sections/UnknownsSection/UnknownsSection.tsx` footer span ("> open to roles that push me harder on any of the above.") | `text-primary-500` | `text-primary-400` |

### A2 — LiveCam (`▶ REC · LIVE`) smaller on mobile

Decision (user, 2026-07-08): the **whole live-cam block** scales down on mobile, not just the status header.

`components/sections/GuitarSection/GuitarSection.tsx` `LiveCam`:
- photo container `min-h-[200px]` → add `max-md:min-h-[140px]`
- header and caption bars `text-xs` → add `max-md:text-[10px]`
- header/caption padding `px-[9px] py-[6px]` → add `max-md:px-[7px] max-md:py-1`

Desktop rendering unchanged.

### A3 — Influences list bigger (proportionally)

`components/sections/GuitarSection/GuitarSection.tsx` `InfluencesList` + `InfluenceBars`:
- row text `text-xs max-md:text-[10px]` → `text-xs max-md:text-xs` (i.e. drop the 10px mobile downgrade)
- name span `md:text-[13px]` → `md:text-sm`; active name `md:text-sm` → `md:text-[15px]`
- rank column stays `36px` (fits the larger glyphs)
- strength bars ("square at right") `w-[6px] h-[10px]` → `w-[7px] h-[12px]`, gap unchanged

### A4 — Mobile shell command chips bigger

`components/client/InteractiveShell/InteractiveShell.tsx` mobile toolbar buttons (`help`, `whois`, etc.):
- `max-md:text-[10px]` → `max-md:text-xs`
- `min-h-[28px]` → keep desktop, add `max-md:min-h-[40px]`
- `px-2 py-1` → add `max-md:px-3`

Also improves tap-target size (current 28px is below the 44px guideline).

## Part B — Nav sidebar (drawer)

Decisions (user, 2026-07-08): **toggle drawer** on desktop (not a persistent rail); contents = **all sections, grouped**.

### Architecture

- One new client island: `components/responsive/NavSidebar/NavSidebar.client.tsx`, mounted once in `components/AppShell/AppShell.client.tsx`. Serves both breakpoints — no desktop/mobile fork.
- Content module: `content/nav.ts`, Zod-validated at build (`validate-content`), per content discipline. Shape: ordered groups, each `{ label, items: [{ label, target }] }` where `target` is an existing `sec-*` id.
- Grouping (tunable at implementation): `WORK` (readme, projects, responsibilities, git-log) · `PROOF` (perf-receipts, live-perf, ai-metrics, sys-health, credentials) · `SYSTEM` (shell, npm-stack, man-page, unknowns, hottest-takes) · `HUMAN` (guitar, daw-mixer, community, now, visa) · `CONTACT` (contact).

### Triggers

- Desktop: `INDEX` button in `DesktopTopbar` (visible `md+` — also gives sub-`xl` desktops navigation; current topbar links are `xl`-only and remain).
- Mobile: `MENU` item in the `Dock`.

### Behavior

- Slide-in panel from the left over a dimmed backdrop; terminal tree aesthetic (`~/erikunha.dev` root, group branches, `├──`/`└──` glyphs). 1px borders, sharp corners, two-token palette.
- Closes on: Esc, backdrop click, link click.
- A11y: `role="dialog"` + `aria-modal="true"`, focus trapped while open, focus returns to the trigger on close, trigger has `aria-expanded` + `aria-controls`. Slide animation disabled under `prefers-reduced-motion: reduce`.
- Link activation: navigate to `#sec-*` and dispatch the existing `module:open` custom event (same pattern as `Dock`) so collapsed `<details>` sections open before scroll.
- Body scroll locked while open.

### Error handling

- A `target` id that doesn't resolve at runtime degrades to a plain anchor jump (no crash); the Zod schema plus a unit test asserting every `content/nav.ts` target exists in the rendered page prevent this statically.

### Budget

- Estimated ~2-3KB gzipped; must hold the 43KB total client-JS budget and `bundle-check`. Lighthouse a11y = 100 and axe gate must stay green.

## Testing

- TDD (tests first) for NavSidebar: open/close via trigger, Esc close, backdrop close, focus trap + focus return, `module:open` dispatch on link click, `aria-expanded` state, reduced-motion (no animation class), body scroll lock, every nav target exists as a section id.
- Part A: existing section tests updated only where they assert the changed classes; DS component pre-mortem checklist applies.
- Playwright MCP visual inspection at 1280×720 and 375×812 before writing/updating tests.
- **Visual baselines impacted: YES** — hottest-takes footer and shell chips are inside CI-gated baselines (`tests/visual/visual.spec.ts`); the sidebar trigger changes the topbar (hero baseline). `visual-baseline-regen` (darwin + linux) is a mandatory pre-PR step for both PRs.

## Delivery

- PR 1: Part A tweaks (single scope-block commit set + baseline regen).
- PR 2: Part B sidebar (content module, island, triggers, tests, baseline regen).
- Both go through the standard gates: thinking-inversion before the plan, architect-reviewer gate before `superpowers:writing-plans`, 5-agent battery before push, `ready-for-pr` before opening.
