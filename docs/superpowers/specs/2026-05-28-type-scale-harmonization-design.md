# Type Scale Harmonization Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the typography token scale to industry-standard proportions, fix the Lighthouse `target-size` accessibility gate failure, and document the two-zone rationale so future token changes are principled.

**Architecture:** Token values change in `design-system/tokens/typography.json`; the generated `design-system/dist/tokens.css` is rebuilt automatically. All 120+ CSS consumers reference tokens, not px values, so no CSS files need editing except the R/M/S button touch-target fix. A visual smoke check (Playwright MCP) is required after the build because `lg` and `3xl` changes affect visible section headers and the hero.

**Tech Stack:** Style Dictionary token pipeline (`pnpm tokens:build`), CSS Modules, Lighthouse CI, Playwright MCP

---

## Why these values

The scale uses two intentionally different step sizes — the same pattern used by Vercel/Geist, IBM Carbon, and Linear:

**Text zone (10–16px) — small steps, precision matters:**
| Token | Old | New | Reason |
|-------|-----|-----|--------|
| `2xs` | 9px | 10px | 9px is below any legible threshold; 10px is the industry floor for decorative-only text |
| `xs` | 11px | 11px | Non-interactive labels (status bar, knob names, git metadata) — Vercel and Linear both use 11px here |
| `sm` | 12px | 12px | Interactive minimum; anything the user reads or acts on |
| `base` | 14px | 14px | Primary mono body — proven across Carbon and Geist |
| `md` | 16px | 16px | Sub-heading body; browser default; universal anchor |

**Display zone (24–64px) — larger jumps, hierarchy needs breathing room:**
| Token | Old | New | Reason |
|-------|-----|-----|--------|
| `lg` | 22px | 24px | 24px creates cleaner hierarchy step from 16px; 22px is idiosyncratic |
| `xl` | 32px | 32px | Unchanged |
| `2xl` | 48px | 48px | Unchanged |
| `3xl` | 78px | 64px | 64px is the industry-standard display anchor (Vercel, Carbon, Apple all use 64 or 72); 78px is idiosyncratic and slightly oversized |

## Accessibility gate fix (separate from token scale)

The Lighthouse `target-size` audit failure is caused by the DAW Mixer R/M/S buttons being physically smaller than 24×24px — the WCAG 2.5.5 touch target minimum. This is a CSS padding/size issue, not a font size issue.

**Fix:** Add `min-height: 24px; min-width: 24px; padding: 0 6px;` to `.rmsActive` and `.rmsInactive` in `DawMixer.module.css`. Both classes share the same size, so one change covers all six buttons across three channels.

## Scope

- `design-system/tokens/typography.json` — 3 value changes (2xs, lg, 3xl)
- `components/client/DawMixer/DawMixer.module.css` — touch target padding for rms buttons
- `pnpm tokens:build` — regenerates `design-system/dist/tokens.css`
- Playwright MCP visual check — desktop 1280×720 + mobile 375×812 on hero section and any section using `lg` token for headers
- Lighthouse CI re-run — confirm `target-size` and `categories:accessibility` pass

## Out of scope

- Changes to `xs` (11px) — intentionally non-interactive metadata, consistent with industry practice
- Changes to `xl`, `2xl` — working correctly, no reason to touch
- Line-height / leading tokens — separate concern
- Component-level font size overrides — no CSS files edited beyond DawMixer buttons

## Success criteria

1. `pnpm gates:runtime` passes: `categories:accessibility >= 1.0`, `target-size >= 0.9`
2. Hero section "THE MATRIX HAS YOU." renders correctly at 64px
3. All section headers using `lg` render correctly at 24px
4. `pnpm ci:local` passes (650 tests, lint, typecheck)
5. Playwright MCP visual check: no CLS, no overflow, no layout regressions
