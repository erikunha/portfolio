# Font Size Normalization — Design Spec

**Date:** 2026-05-16  
**Status:** Approved  
**Approach:** B — T-shirt 9-step px scale, tokenize + rationalize

---

## Problem

~100+ raw `font-size` declarations spread across 8 CSS files. No tokens exist in `_tokens.css` for font sizes. Values include half-pixel noise (9.5px, 10.5px, 11.5px, 12.5px, 13.5px) and ~22 distinct sizes, many of which share the same semantic role. Every typography tweak requires a manual grep-and-patch across multiple files.

---

## Goal

Replace all raw pixel `font-size` values with CSS custom property tokens. Rationalize ~22 distinct values down to 9 clean steps. Half-pixel values eliminated entirely. One declaration in `_tokens.css` controls each step going forward.

---

## Token Scale

Defined in `_tokens.css` `:root`:

```css
--fs-2xs:   9px   /* nano: decorative chrome labels, [ NR ] style badges */
--fs-xs:   11px   /* micro: statusbar, topbar, secondary chrome */
--fs-sm:   12px   /* small: footer, contact fields, tertiary chrome */
--fs-base: 14px   /* body: section body, shell, readme, man page */
--fs-md:   16px   /* base: skip-to-content, emphasized body */
--fs-lg:   22px   /* sub: display numbers, module subheadings */
--fs-xl:   32px   /* display: large section display numbers */
--fs-2xl:  48px   /* title: h1 desktop */
--fs-3xl:  78px   /* display: hero name desktop */
```

Mobile responsive overrides added inside the existing `@media (max-width: 768px)` block in `_base.css`:

```css
--fs-3xl:  56px;
--fs-2xl:  32px;
```

---

## Snapping Map

| Current value(s) | Snaps to | Token |
|---|---|---|
| 9px, 9.5px | 9px | `--fs-2xs` |
| 10px, 10.5px | 11px | `--fs-xs` |
| 11px, 11.5px | 11px | `--fs-xs` |
| 12px, 12.5px | 12px | `--fs-sm` |
| 13px, 13.5px, 14px, 15px | 14px | `--fs-base` |
| 16px | 16px | `--fs-md` |
| 18px, 20px, 22px | 22px | `--fs-lg` |
| 26px, 28px, 32px | 32px | `--fs-xl` |
| 36px, 38px | 32px | `--fs-xl` |
| 48px | 48px | `--fs-2xl` |
| 56px | 56px | `--fs-3xl` (mobile override) |
| 78px | 78px | `--fs-3xl` |

**Notable snaps with visible effect:**
- 13px → 14px: shell body/prompt/input and several section bodies. ~7.7% bump. Accepted trade-off for scale simplicity.
- 26px, 28px → 32px: display elements. ~14–17% size reduction. Acceptable — these are not hero-adjacent.

---

## File Scope

All changes are CSS-only. No `.tsx` component files contain inline font-size styles.

| File | Change |
|---|---|
| `app/css/_tokens.css` | Add 9 `--fs-*` tokens to `:root` |
| `app/css/_base.css` | Replace `h1` 48px/32px with `var(--fs-2xl)`; `skip-to-content` 16px with `var(--fs-md)`; add mobile `--fs-3xl`/`--fs-2xl` overrides |
| `app/css/_chrome.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_shell.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_sections.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_layout.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_footer.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_contact.css` | Replace all raw font-size px with `var(--fs-*)` |
| `app/css/_responsive.css` | Replace all raw font-size px with `var(--fs-*)` |

**Exceptions (intentionally left as raw px):**
- `html, body { font-size: 16px }` in `_base.css` — this is the rem anchor, not a consumer.
- `font-size: inherit` in `_shell.css` — correct, no change needed.

---

## Out of Scope

- No line-height changes.
- No font-family changes.
- No responsive breakpoint logic changes beyond the two token overrides above.
- No component `.tsx` files.
- No Tailwind utility class additions.

---

## Verification

1. `pnpm typecheck` passes.
2. `pnpm test` (Vitest) passes — no font-size assertions in current test suite.
3. Visual check: shell section at desktop viewport confirms 14px body is acceptable density.
4. Lighthouse CI gates unchanged — font-size normalization has no performance impact.
