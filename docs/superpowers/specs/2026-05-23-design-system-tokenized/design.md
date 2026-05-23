# Design System Tokenized — Design

**Status:** spec → architect-reviewer → writing-plans
**Date:** 2026-05-23
**Author:** Erik Cunha (with brainstorming via Claude Code)
**Spans:** 5 PRs (A: token pipeline + Figma sync; B: 8 primitive components; C: /design-system MDX docs + auto-API + visual changelog; D: theme variants + switcher; E: Storybook subdomain)

---

## 1. Goal

Build a published design system that positions erikunha.dev as a **reference for web systems engineering** — not as a hiring artifact alone. The architecture, the enforcement, the docs, the tooling pipeline, and the design-engineering bridge together are something other teams could adopt verbatim. Future growth is the default assumption: a future second consumer (a side project, a new product surface, an internal tool) finds a system that already handles theming, design-tool sync, and primitive composition without architectural rework.

The scope is the right shape for that goal. There is no "we accept the over-engineering" hedge here — at this bar, the architecture *is* the artifact, and YAGNI is the wrong frame. A reference system is built for the case where things grow, because the cost of bolting capabilities onto a flat system later is far higher than the cost of designing the layered surface up front. See CLAUDE.md "Operating role" for the framing that makes this the project's default standard, and STANDARDS.md Chapter 12 for the enforcement bar.

The system has eight deliverables:

1. **Two-tier token pipeline** (primitives + semantic) authored in JSON, generated to CSS + TypeScript + JSON, consumed by every CSS Module in the codebase.
2. **Motion semantic layer** layered on top of duration/easing primitives so theme variants can re-tune motion identity without touching components.
3. **Eight primitive components** extracted from existing portfolio patterns: Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey, **Link**.
4. **Theme variant capability with a live demo** — second theme (CRT amber) shipped as a switcher on `/design-system` that proves the two-tier architecture without component churn.
5. **Bidirectional Figma Tokens sync** — `tokens.json` exported in Figma Tokens spec format, consumable by the Figma Tokens plugin; round-trip diff gate ensures Figma and code do not drift.
6. **Auto-generated component API tables** — build-time TypeScript-to-MDX generator produces the props/variants table for each component docs page. Single source of truth between TS types and docs.
7. **Public MDX documentation** at `/design-system` (palette, type scale, components with live previews, enforcement rules, changelog) — discoverable from main portfolio nav.
8. **Storybook subdomain** at `ds.erikunha.dev` — interactive component playground, exhaustive variant matrix, separate deploy. Complements `/design-system` (curated MDX narrative) rather than replacing it.

Plus: visual-changelog automation from Playwright diffs that posts to `/design-system/changelog` and PR threads.

---

## 2. Non-Goals (v1)

Explicitly out of scope:

- Versioning, semver tags, published changelogs as separate releases — the design system evolves in lockstep with the portfolio for now; semver becomes meaningful only when there is a second consumer
- Extracted npm package — deferred until there is a second consumer. The architecture supports extraction (deep-path imports, no Next-only dependencies in `design-system/`) — extraction itself is one PR away once justified
- Composed (non-primitive) components like TerminalSection, DataTable, Dock — stay as section code in the portfolio. Documented as "Composition Patterns" on `/design-system/components` so the boundary is explicit
- Theme variants beyond the two shipped in v1 (CRT green canonical + CRT amber demo) — the architecture supports more; v1 ships two as the demonstration
- Light theme (the project's brutalist aesthetic is dark-only by design) — see CLAUDE.md "Out of scope" — and the design system's theme architecture is for variants of the dark aesthetic, not light/dark switching

---

## 3. Token Architecture

### 3.1 Source of truth

`design-system/tokens/*.json` — one file per category. Authored as JSON. Never edited as CSS by hand. Files:

- `color.json` — primitives (green ramp, neutrals, accents, feedback) + semantic aliases (signal, text, surface, border, feedback)
- `space.json` — primitives (numeric scale) + semantic (`pad`, `pad-tight`, `rhythm`, `rhythm-tight`)
- `typography.json` — primitives (size scale, line-height scale, font stacks) + semantic (`body`, `heading-sm/md/lg/xl`, `mono`, `display`)
- `motion.json` — primitives (duration scale, easing curves) + semantic (`--ds-motion-*` shorthand aliases); components consume semantics, `@keyframes` blocks may reference primitives directly
- `layer.json` — primitives (z-index scale: base/sticky/overlay/headline)
- `border.json` — primitives (width, style: solid/dashed)

### 3.2 Tier 1: primitives (raw palette)

Naming: `--ds-{category}-{scale}` or `--ds-{category}-{role}` for non-scale primitives.

| Category | Tokens (sample) |
|---|---|
| Color | `--ds-green-50` (#0a1f0d, solid), `--ds-green-100` (rgba(0,255,65,0.1)), `--ds-green-150` (rgba(0,255,65,0.12)), `--ds-green-300` (rgba(0,255,65,0.2)), `--ds-green-400` (rgba(0,255,65,0.4)), `--ds-green-500` (#00FF41, solid), `--ds-green-700` (#0a8a2a, solid) |
| Color (text) | `--ds-text-100` (#E6FFE6), `--ds-text-300` (#5AE07B) |
| Color (neutral) | `--ds-neutral-0` (#000000), `--ds-neutral-50` (#050505) |
| Color (accent) | `--ds-accent-amber`, `--ds-accent-cyan`, `--ds-feedback-error` |
| Space | `--ds-space-1` (4px) through `--ds-space-16` (64px) |
| Typography size | `--ds-text-size-2xs` (9px) through `--ds-text-size-3xl` (78px) — 9 sizes |
| Typography leading | `--ds-text-leading-tight` (1.2), `--ds-text-leading-base` (1.55), `--ds-text-leading-relaxed` (1.85) |
| Motion duration | `--ds-duration-fast` (80ms), `--ds-duration-base` (200ms), `--ds-duration-slow` (300ms) |
| Motion easing | `--ds-ease-out`, `--ds-ease-in`, `--ds-ease-in-out` |
| Layer | `--ds-layer-base` (0), `--ds-layer-sticky` (50), `--ds-layer-overlay` (100), `--ds-layer-headline` (150) |
| Border | `--ds-radius-none` (0), `--ds-radius-sharp` (2px) — aesthetic ceiling |

**Components MUST NEVER reference primitives directly.** Enforced by lint (see §3.4).

### 3.3 Tier 2: semantic tokens (role-based aliases)

Naming: `--ds-{category}-{role}-{state?}`. Each references a primitive.

| Semantic token | Maps to primitive | Replaces (old name) |
|---|---|---|
| `--ds-color-signal` | `--ds-green-500` | `--signal` |
| `--ds-color-signal-subtle` | `--ds-green-400` | `--signal-dim` |
| `--ds-color-signal-quiet` | `--ds-green-100` | `--signal-dim-2` |
| `--ds-color-signal-faint` | `--ds-green-150` | `--signal-faint` |
| `--ds-color-text-body` | `--ds-text-100` | `--fg` |
| `--ds-color-text-muted` | `--ds-green-400` | `--muted` |
| `--ds-color-text-faint` | `--ds-text-300` | `--muted-dim` |
| `--ds-color-surface-base` | `--ds-neutral-0` | `--bg` |
| `--ds-color-surface-shell` | `--ds-neutral-50` | `--shell-bg` |
| `--ds-color-border-default` | `--ds-green-400` | `--border` |
| `--ds-color-feedback-error` | `--ds-feedback-error` | `--error-soft` |
| `--ds-color-accent-warm` | `--ds-accent-amber` | `--accent-warm` |
| `--ds-color-accent-cool` | `--ds-accent-cyan` | `--accent-cool` |
| `--ds-color-highlight-bg` | `--ds-green-500` | `--highlight-bg` |
| `--ds-color-highlight-fg` | `--ds-neutral-0` | `--highlight-fg` |
| `--ds-space-pad` | `--ds-space-6` (24px) | `--pad` |
| `--ds-space-pad-tight` | `--ds-space-3` (12px) | `--pad` (mobile override value) |
| `--ds-space-rhythm` | `--ds-space-16` (64px) | `--vrhythm` |
| `--ds-space-rhythm-tight` | `--ds-space-4` (16px) | `--vrhythm` (mobile override value) |
| `--ds-font-size-body` | `--ds-text-size-base` | `--fs-base` |
| `--ds-font-size-heading-sm` | `--ds-text-size-lg` | `--fs-lg` |
| `--ds-font-size-heading-md` | `--ds-text-size-xl` | `--fs-xl` |
| `--ds-font-size-heading-lg` | `--ds-text-size-2xl` | `--fs-2xl` |
| `--ds-font-size-heading-xl` | `--ds-text-size-3xl` | `--fs-3xl` |
| `--ds-font-family-mono` | (JetBrains Mono stack) | `--font-mono-stack` |
| `--ds-font-family-display` | (Geist stack) | `--font-display-stack` |
| `--ds-layout-maxw` | (1200px) | `--maxw` |
| `--ds-motion-fade-default` | `--ds-duration-base --ds-ease-in-out` | (new — currently inline opacity transitions) |
| `--ds-motion-press` | `--ds-duration-fast --ds-ease-out` | (new — button/CTA hover/active transitions) |
| `--ds-motion-reveal` | `--ds-duration-slow --ds-ease-out` | (new — overlay/headline reveals) |
| `--ds-motion-shimmer` | `--ds-duration-slow --ds-ease-in-out` | (new — text/glow shimmer effects) |

The full size scale (`--ds-font-size-2xs` through `--ds-font-size-3xl`) is also published as semantic tokens for cases where the heading hierarchy doesn't fit — but `--ds-font-size-heading-*` is preferred for headings, `--ds-font-size-body` for body. Motion semantic tokens use shorthand notation (`duration easing`) and are consumed as `transition: opacity var(--ds-motion-fade-default)`; components MUST consume motion semantics, not raw duration/easing primitives, except in `@keyframes` definitions where the primitives are still legal.

### 3.4 Enforcement: token boundary lint

`scripts/lint-token-boundary.mjs` runs in CI. Scans every `.module.css` file under `components/`, `app/`, and `design-system/components/`.

**Rejects** any `var()` reference to primitives that DO have a semantic layer:
- `--ds-green-*`, `--ds-text-N` (numeric N), `--ds-neutral-*`, `--ds-accent-*`, `--ds-feedback-*` (color primitives — semantic layer is `--ds-color-*`)
- `--ds-space-N` (numeric N) (space primitives — semantic layer is `--ds-space-pad{,-tight}`, `--ds-space-rhythm{,-tight}`)
- `--ds-text-size-*`, `--ds-text-leading-*` (typography primitives — semantic layer is `--ds-font-size-*`, `--ds-font-family-*`)
- `--ds-duration-*`, `--ds-ease-*` (motion primitives — semantic layer is `--ds-motion-*`). Exception: `@keyframes` blocks may consume motion primitives directly since named animations don't compose via the shorthand `duration easing` form

**Allows** semantic tokens AND primitives that have no semantic layer in v1 (layer, radius, border — components reference these primitives directly because there is nothing else to reference):
- `var(--ds-color-*)`, `var(--ds-space-pad)`, `var(--ds-space-pad-tight)`, `var(--ds-space-rhythm)`, `var(--ds-space-rhythm-tight)`, `var(--ds-font-*)`, `var(--ds-layout-*)`, `var(--ds-motion-*)`
- `var(--ds-layer-*)`, `var(--ds-radius-*)`, `var(--ds-border-*)`

**Exception path:** the semantic-layer CSS file itself (`design-system/dist/tokens.css`) — primitives are the input there.

### 3.5 Enforcement: no magic values lint

`scripts/lint-no-magic-values.mjs` runs in CI. Scans every `.module.css` file. Rejects:

- Raw hex colors (`#[0-9a-fA-F]{3,8}` outside `var()` arguments) — must use a color token
- Raw `px` values not in the token set, outside specific allowlisted properties (`outline-offset`, sub-pixel calc tweaks)
- Raw `ms`/`s` durations (must use `--ds-duration-*`)
- Hardcoded z-index values (must use `--ds-layer-*`)

Allowlist file: `scripts/lint-no-magic-values.allowlist.json` — documented exceptions (e.g., 9999px honeypot offset, sub-pixel borders).

**Allowlist population is part of PR A scope.** First lint run against existing `.module.css` files will surface dozens of legitimate-but-unmapped values: sub-pixel borders, animation timings that predate motion tokens, magic offsets like the 9999px sr-only positioning, exact color values used in shadow/gradient operations. Each gets a one-line allowlist entry with the file path, the value, and a one-sentence justification. Lint must pass clean (zero unallowlisted violations) before PR A is mergeable.

### 3.6 Enforcement: contrast audit

`scripts/contrast-check.mjs` runs in CI. Walks every semantic text/surface token pair, computes WCAG AA contrast ratio (4.5:1 normal, 3:1 large text), fails on any pair below threshold. Hardcoded pairs defined in the script:
- `--ds-color-text-body` on `--ds-color-surface-base` (must be ≥ 4.5:1)
- `--ds-color-text-muted` on `--ds-color-surface-base` (≥ 4.5:1)
- `--ds-color-text-faint` on `--ds-color-surface-base` (≥ 4.5:1)
- `--ds-color-signal` on `--ds-color-surface-base` (≥ 3:1 — used for large headings)
- `--ds-color-text-body` on `--ds-color-surface-shell` (≥ 4.5:1)

### 3.7 Build pipeline

- **Tool:** Style Dictionary (exact-pinned, no caret)
- **Config:** `design-system/sd.config.ts`
- **Outputs** (gitignored, regenerated in CI):
  - `design-system/dist/tokens.css` — both tiers in CSS custom properties
  - `design-system/dist/tokens.ts` — typed const tree with literal types for use in TS/TSX
  - `design-system/dist/tokens.json` — flat key/value (Figma sync, AI tooling, generated docs)
- **Scripts:**
  - `pnpm tokens:build` — runs Style Dictionary, regenerates dist
  - `pnpm tokens:check` — regenerates AND diffs against committed; fails on drift (catches hand-edited dist files)
- **Wiring:** `pnpm tokens:build` runs in the `prebuild` lifecycle hook (so `pnpm build` always picks up latest tokens). CI runs `pnpm tokens:check` as its own gate. Build cache key includes `design-system/tokens/` content hash to skip rebuild on no-op.

### 3.8 Migration

- Codemod (`scripts/migrate-tokens.mjs`) with explicit before→after map applies the rename across all 31 `.module.css` files
- `app/css/_tokens.css` deleted
- `app/globals.css` imports `design-system/dist/tokens.css` instead
- Ripgrep CI gate fails on any orphan reference to a legacy token name (`--signal`, `--fg`, `--pad`, etc.) outside the legacy-map file in `scripts/migrate-tokens.mjs`
- DECISIONS.md gets an ADR entry for the migration

### 3.9 Theme variants

The two-tier architecture makes a theme variant a single-file change: redefine the semantic→primitive mapping in a new theme file. v1 ships two themes:

- **`crt-green` (canonical)** — the existing aesthetic. `[data-theme="crt-green"]` on `<html>` (default).
- **`crt-amber` (demo)** — an alt-theme variant. `[data-theme="crt-amber"]` on `<html>`. Maps `--ds-color-signal` to `--ds-amber-500` (new primitive) and the signal family accordingly. Text, surface, layer tokens unchanged.

**Authoring:** `design-system/tokens/themes/{crt-green,crt-amber}.json` — each file owns the semantic→primitive mappings for that theme; primitives live in shared files (`color.json`, etc.) including the new amber ramp added for `crt-amber`.

**Output:** Style Dictionary generates per-theme CSS scoped to the data attribute selector. The two themes share one bundle (~600 bytes added for the second theme; both selectors live in `tokens.css`). No JS, no runtime theme bundle.

**Switcher (on `/design-system` only):** a small client island (`ThemeSwitcher.client.tsx`, ~500 bytes gzipped) sets `document.documentElement.dataset.theme`. Persistence via `localStorage`. SSR-safe (default attribute set in the root layout's `<html>` before hydration so there's no flash). The switcher is NOT shipped on the main portfolio routes — the portfolio itself stays on `crt-green` always.

**Theme contract gate:** `scripts/check-theme-contract.mjs` walks every theme file, asserts every semantic token name in `crt-green` is also defined in every other theme (no missing roles), and runs the contrast check (§3.6) per theme. Adding a new theme requires defining every semantic role; partial themes fail CI.

### 3.10 Figma Tokens sync pipeline

**Goal:** designers update tokens in Figma; designers and engineers see drift surfaced in PRs.

**Format:** `design-system/dist/tokens.figma.json` is the W3C Design Tokens Community Group format ([`tokens.json` spec v0.6+](https://design-tokens.github.io/community-group/format/)) consumed by the Figma Tokens plugin (Tokens Studio). Style Dictionary v4 has a built-in W3C format transformer; we use it directly with one custom transform for our specific reference syntax.

**Workflow direction A — code → Figma:** on every push to main, GitHub Action `tokens-figma-sync.yml` POSTs `tokens.figma.json` to a GitHub repo (`erikunha/design-tokens-figma-sync`) that the Tokens Studio Figma plugin pulls from. Designers see updated tokens within minutes of merge.

**Workflow direction B — Figma → code:** designers push token changes from Tokens Studio to the same GitHub repo on a feature branch; the GH Action `tokens-figma-pull.yml` opens a PR to this repo with the diff applied to `design-system/tokens/*.json`. Engineers review like any other PR — the codebase remains the source of truth; Figma's change becomes a proposal, not a fait accompli.

**Drift gate:** `scripts/check-figma-token-drift.mjs` runs in CI on every PR, regenerates `tokens.figma.json`, and compares against the last-synced version recorded in `design-system/.figma-sync-state.json`. Fails on drift; resolution is either to push the new state (if code changed) or to pull the Figma change (if Figma changed). Drift is information, not a permanent block.

**Out of scope for v1:** Figma file ownership of styles/effects beyond tokens; design-tool sync for component variants (just tokens).

---

## 4. Components

Eight primitive components. Each is a single-responsibility, RSC-by-default, semantic-token-only React component. Each ships with a unit test, a Playwright visual baseline, and an MDX docs page.

### 4.1 File layout per component

```
design-system/components/Button/
  Button.tsx              # RSC by default
  Button.module.css       # semantic tokens only
  Button.test.tsx         # vitest unit test
  index.ts                # re-exports
```

Variants composed via a tiny internal helper:

```
design-system/lib/cx.ts   # ~20 LoC, classnames-style composer with literal-type support
```

**No `class-variance-authority`.** Variants live as separate CSS Module classes; the component composes them via `cx(base, variants[variant], sizes[size])`. Zero new runtime deps. Type safety via TypeScript literal union types on props.

### 4.2 Component inventory

#### Button
- **Replaces:** `.cta`, `.ctaPrimary`, `.ctaSecondary` in Hero; ContactForm submit
- **Props:** `variant: 'primary' | 'secondary'`, `size: 'sm' | 'md' | 'lg'`, `as: 'button' | 'a'`, `...HTMLButtonElement | HTMLAnchorElement attrs`
- **Variants:** primary (filled signal background, neutral foreground); secondary (transparent background, signal border, signal text)
- **Sizes:** sm (min-height 36px), md (44px — touch target default), lg (52px)
- **States:** default, hover (box-shadow glow), focus-visible (outline using signal), disabled (opacity 0.4, pointer-events none)
- **A11y:** keyboard-operable; 44px touch target on md; focus-visible ring uses `--ds-color-signal`; disabled state includes `aria-disabled` for anchors (anchors can't be natively disabled)

#### Field
- **Replaces:** form inputs and textarea in ContactForm
- **Props:** `name`, `label`, `multiline?: boolean`, `rows?: number` (only when multiline), `error?: string`, `type?: HTMLInputType`, `...HTMLInputElement | HTMLTextAreaElement attrs`
- **Variants:** single-line (default), multiline (renders `<textarea>`)
- **States:** default, focused (border brightens to signal), error (border red, aria-invalid), disabled
- **A11y:** label always rendered, programmatically associated via `for`/`id`; aria-describedby points to error text when error prop is set; aria-invalid="true" on error

#### Badge
- **Replaces:** `.status` in Hero, status indicators in any section
- **Props:** `variant: 'default' | 'dot'`, `size: 'sm' | 'md'`, `children`
- **Variants:** default (text only), dot (pulsing signal dot prefix that respects `prefers-reduced-motion`)
- **Sizes:** sm, md
- **A11y:** dot is `aria-hidden`; status text carries the semantic meaning; pulse animation suppressed under reduced-motion

#### TerminalPanel
- **Replaces:** the bordered green panel pattern (Hero root, Shell, ContactForm container, every section's wrapper)
- **Props:** `borderStyle: 'solid' | 'dashed'`, `as?: 'section' | 'article' | 'div'`, `header?: ReactNode`, `children`
- **Variants:** solid border (default), dashed border (used in some sub-panels per the prototype)
- **A11y:** if `header` is provided, panel renders with the standard `[ HEADER ]` bar and labels itself; otherwise relies on parent labeling

#### StatTile
- **Replaces:** items in HeroStats
- **Props:** `value: string`, `label: string`, `variant?: 'default' | 'compact'`
- **Variants:** default (current HeroStats sizing), compact (smaller for dense grids)
- **A11y:** rendered as `<dl><dt>{label}</dt><dd>{value}</dd></dl>` semantic pair so screen readers read "label: value"
- **Note:** the parent grid layout (`StatGrid`) is NOT a primitive component — it stays as section code in the consumer

#### CmdLine
- **Replaces:** the `user@terminal:~$ command` pattern in Hero boot animation, Shell, Visa, Guitar, every command-line render in the portfolio
- **Props:** `user?: string` (default 'erik@portfolio'), `command: string`, `output?: ReactNode`, `prompt?: string` (default ':~$')
- **Variants:** default, with-output (renders prompt line + multi-line output slot below)
- **A11y:** the prompt + user + command read as one continuous line; output (if any) reads as a separate block

#### KbdKey
- **Replaces:** inline `<kbd>` styles in ManPage, Shell, anywhere keyboard chords are documented
- **Props:** `size: 'sm' | 'md'`, `children`
- **Variants:** default
- **A11y:** uses semantic `<kbd>` element; styled with bordered terminal aesthetic

#### Link
- **Replaces:** every navigation anchor in the portfolio (in-page anchors, external links, dock/topbar nav items). Distinct from `<Button as="a">` which is reserved for ACTION-shaped anchors (CTAs that happen to be links).
- **Props:** `href: string`, `variant: 'inline' | 'nav' | 'external'`, `as?: 'a'` (always anchor; included for API symmetry with Button), `...HTMLAnchorElement attrs`
- **Variants:**
  - `inline` (default) — underlined inline anchor inside text; the canonical "this word is a link" treatment
  - `nav` — undecorated nav-bar anchor (topbar links, dock links); border-on-focus, no underline
  - `external` — inline + small `↗` glyph appended via `::after`; auto-detects `target="_blank"` and `rel="noopener noreferrer"`
- **States:** default, hover (underline thickens or glow appears, per variant), focus-visible (signal-color outline), visited (no special treatment — the terminal aesthetic does not surface visited state)
- **A11y:** native `<a>` element; external variant announces "(external)" via visually-hidden text after the link content; `rel="noopener noreferrer"` mandatory on external for security; never override the user agent's keyboard activation

### 4.3 Variant strategy

Each variant maps to its own CSS Module class (`.primary`, `.secondary`, `.sm`, `.md`, `.lg`). Composition via `cx()`. Default values handled in TS props, not in CSS fallbacks. Example:

```tsx
export function Button({ variant = 'primary', size = 'md', as = 'button', ...rest }: ButtonProps) {
  const Element = as;
  return <Element className={cx(styles.root, styles[variant], styles[size])} {...rest} />;
}
```

### 4.4 Public API surface

Re-exported from `design-system/index.ts`:

```ts
export { Button } from './components/Button';
export { Field } from './components/Field';
export { Badge } from './components/Badge';
export { TerminalPanel } from './components/TerminalPanel';
export { StatTile } from './components/StatTile';
export { CmdLine } from './components/CmdLine';
export { KbdKey } from './components/KbdKey';
export { Link } from './components/Link';
export { tokens } from './dist/tokens';  // typed const tree
export type { Tokens } from './dist/tokens';
```

Consumers import as `import { Button } from '@/design-system'` for RSC contexts; in client islands, import via deep paths (`import { Field } from '@/design-system/components/Field'`) to avoid the barrel-leak bundle vector documented in §9.

---

## 5. Documentation Route (`/design-system`)

### 5.1 Route structure

| Route | Content |
|---|---|
| `/design-system` | Landing — overview, principles, links to other pages |
| `/design-system/tokens` | Palette, type scale, spacing, motion, layers, borders — visual tables |
| `/design-system/components` | All 8 components on one scrollable page with anchor links (`#button`, etc.). Auto-API tables generated from TS types at build time |
| `/design-system/themes` | Theme variant gallery: `crt-green` (canonical) and `crt-amber` (demo). Live switcher; tokens diffed side-by-side |
| `/design-system/enforcement` | Lint rules, CI gates, contributing guide, codemod info |
| `/design-system/changelog` | Token + component change log (manually maintained MDX, auto-suggestion script optional) |

### 5.2 MDX setup

- `@next/mdx` package (exact-pinned)
- Configured via `next.config.ts` — `pageExtensions: ['ts', 'tsx', 'mdx']`
- File-based routing: `app/design-system/page.mdx`, `app/design-system/tokens/page.mdx`, etc.
- Custom MDX component map: auto-id'd headings for anchor nav, code blocks via `shiki` (build-time syntax highlighting, zero runtime cost), inline React components imported normally

### 5.3 Layout

`app/design-system/layout.tsx` — RSC layout providing:

- **Sidebar nav** (sticky, desktop only): Overview | Tokens | Components | Enforcement | Changelog. Active section highlighted via `usePathname` (client island, ~1KB)
- **Mobile:** sidebar collapses into a native `<details>` element at the top (zero JS)
- **Content area:** max-width 720px for prose; full-width breakouts for component previews and token tables
- **CRT overlay disabled** on design-system routes — clean rendering for documentation; CRT effects belong on the main portfolio

### 5.4 Live previews

`<Preview>` MDX component:

```mdx
<Preview>
  <Button variant="primary">EXEC_HIRE</Button>
</Preview>
```

Renders the live component inside a bordered panel (`TerminalPanel`) plus a "View source" disclosure via native `<details>` (zero JS) showing the raw TSX.

Components themselves are RSC — render server-side, ship zero client JS.

### 5.5 Client islands on docs routes

Two small client components, both lazy-loaded only on `/design-system/*` routes:

- `Sidebar.client.tsx` — active-link highlight (~1KB gzipped)
- `CopyButton.client.tsx` — copy-code-to-clipboard buttons on every code block (~600 bytes gzipped). Hidden by default; revealed on JS hydration. `<noscript>` confirms no button is intentional (code is selectable + copyable without it)

Total client JS added to `/design-system/*` routes: **< 2 KB gzipped.** Under the 43KB site-wide island budget. Main `/` route gains zero JS.

### 5.6 Discoverability

- New link in desktop topbar: `DESIGN_SYSTEM` after `PROJECTS`
- New dock icon on mobile: 6th nav slot
- Internal cross-references from CLAUDE.md, ARCHITECTURE.md, DECISIONS.md
- `sitemap.ts` adds 5 new URLs
- `llms.txt` adds a section pointing to `/design-system/*` as the canonical reference

### 5.7 SEO

- Each page has its own `metadata` export (title, description, OG image)
- Acceptable risk: design-system pages may outrank `/` for queries like "Erik Cunha design system" — intentional and aligned with the artifact goal
- Canonical URLs set per page to prevent cross-portfolio duplication

### 5.8 Accessibility of the docs

- Extend `tests/a11y/axe.spec.ts` to cover all 6 new routes (5 from PR C + `/design-system/themes` from PR D)
- Sidebar nav: `<nav aria-label="Design system">` landmark
- Heading hierarchy: strict h1 → h2 → h3 per page
- Live previews: source `<details>` is keyboard-navigable
- Color tokens documented with hex + computed contrast ratio against `--ds-color-surface-base`
- Code blocks: `<pre tabIndex={0} role="region" aria-label="Code sample">` so screen readers navigate as a single landmark
- Lighthouse a11y score = 100 enforced on all new routes

### 5.9 Auto-generated component API tables

Build-time TypeScript→MDX generator (`scripts/gen-component-api.mjs`) walks every `design-system/components/<Name>/index.ts`, extracts the exported component's props type via `ts-morph`, and emits an MDX fragment table to `design-system/components/<Name>/_generated-api.mdx`. Each component's docs page imports that fragment.

**Output shape per component:** props table (name | type | default | required | description), variants table (variant | classes applied | a11y notes), composition examples (taken from `<Preview>` blocks in the docs page itself).

**Source of truth:** TypeScript prop type definitions. JSDoc comments on each prop become the description column. If the JSDoc is missing, the generator fails CI with `MISSING_PROP_DOC: <Component>.<propName>`.

**Drift gate:** `pnpm gen-api:check` regenerates all fragments and asserts the generator runs to completion without error; fails on `MISSING_PROP_DOC` or generator exception. Fragments are gitignored — the gate is generator determinism + JSDoc completeness, not committed-file drift.

### 5.10 Visual changelog automation

Every Playwright visual baseline that updates produces an entry on `/design-system/changelog`. The workflow `.github/workflows/visual-changelog.yml` runs on PRs that update any baseline under `tests/e2e/visual.spec.ts-snapshots/` or `tests/e2e/design-system-components.spec.ts-snapshots/`:

1. Compares old vs new baseline images
2. Generates a side-by-side diff PNG for each
3. Uploads diffs as PR artifact
4. Posts a PR comment with the diff thumbnails
5. On merge to main, appends an entry to `app/design-system/changelog/page.mdx` with the PR number, date, component name, and diff thumbnails

**Manual override:** baseline updates labeled `[no-changelog]` in the commit message skip the changelog entry (for trivial environmental drift).

**Source of truth:** the `.png` baselines themselves; the changelog is generated artifact, not hand-edited.

### 5.11 Performance budget

- LCP target: < 1.8s on 4G stays
- Bundle: < 2.5KB client JS added to `/design-system/*` (Sidebar + CopyButton + ThemeSwitcher); zero added to `/`
- Build time: +5-8s total (~1-2s Style Dictionary cached on no-op + ~2-3s Shiki MDX + ~1-2s component API generation + ~1s theme contract check)
- LHCI runs against the 6 new routes (including `/design-system/themes`); budgets per route enforced

---

## 6. Storybook Subdomain (`ds.erikunha.dev`)

Storybook 8 deployed independently to a Vercel project bound to `ds.erikunha.dev`. Complements `/design-system` (the curated narrative) by providing the exhaustive interactive playground.

### 6.1 What Storybook adds beyond /design-system

| Surface | Strength | Use case |
|---|---|---|
| `/design-system` (MDX) | Curated narrative; principles + opinion + the story of the system | Hiring-facing artifact; recruiter scrolls through, gets the system's posture |
| `ds.erikunha.dev` (Storybook) | Exhaustive variant matrix; every prop combination; controls panel; a11y addon; interaction tests | Engineering-facing tool; designer/contributor opens a specific component and explores |

Both are first-class. Neither is an afterthought of the other.

### 6.2 Storybook architecture

- **Stories colocated:** every primitive ships `design-system/components/<Name>/<Name>.stories.tsx` alongside its other files
- **CSF 3 + Storybook 8:** uses the modern CSF 3 format (`const meta: Meta<typeof Button>`, `Default: Story = { args: ... }`)
- **Addons in v1:** `@storybook/addon-essentials` (controls, actions, viewport, backgrounds), `@storybook/addon-a11y` (axe inside the Storybook iframe), `@storybook/addon-interactions` (testing-library scenarios)
- **Theming:** Storybook surface itself uses a custom theme matching the CRT aesthetic (terminal background, signal-green accents); component preview area uses the design system theme directly (loads `tokens.css`)
- **No Vite override:** Storybook's Vite builder used as-is; we don't fork its config except for path aliases to mirror `@/design-system/*`
- **Build:** `pnpm storybook:build` outputs to `storybook-static/` (gitignored)
- **Deploy:** dedicated Vercel project (`erikunha-ds`), root = `storybook-static/`, framework = "Other," CORS headers permissive for embedded viewing on `/design-system` previews
- **DNS:** `ds.erikunha.dev` CNAME → Vercel; SSL auto-provisioned

### 6.3 What does NOT live in Storybook

- Composition examples (those live in `/design-system/components` MDX)
- Token documentation (that's `/design-system/tokens`)
- Principles / overview (that's `/design-system` landing)
- The hiring narrative (that's the entire main portfolio)

Storybook is the engineering tool; the MDX docs are the system's story.

### 6.4 CI integration

- `pnpm storybook:test` runs the test-runner against every story (uses `@storybook/test-runner`, headless Chrome under Playwright); covers a11y per story and any interaction-test assertions
- `pnpm storybook:build` runs in CI on every PR; fails if any story fails to build (catches API drift between component and story)
- Visual regression: Storybook stories AND `/design-system/components` previews both get visual baselines; the two surfaces are double-catched

### 6.5 Why both surfaces (justification)

A skeptical reviewer asks "isn't /design-system enough?" The honest answer: at scale, yes — a real published design system needs both. MDX is the right format for a narrative, Storybook is the right format for an exhaustive interactive matrix. Conflating them forces compromises in either direction. For a reference web system, the two-surface model is the canonical pattern (Material, Carbon, Polaris, Spectrum, every major DS does both). We adopt the canonical pattern, not a compressed version.

---

## 7. PR Decomposition

Five PRs in dependency order. Each is independently mergeable; the portfolio works after each PR is merged even if the next never ships.

Dependency graph: A → B → C, with D depending on A+C, and E depending on B (independent of C and D). D and E may interleave or ship in either order once their dependencies merge.

### 7.1 PR A — Token pipeline + Figma sync + mechanical migration

**Goal:** retire `app/css/_tokens.css`; project consumes `design-system/dist/tokens.css` only; portfolio renders byte-identical; Figma sync infrastructure live.

**Files added:**
- `design-system/tokens/{color,space,typography,motion,layer,border}.json` (primitives + semantic)
- `design-system/tokens/themes/crt-green.json` (canonical theme mappings — empty in PR A; populated when PR D ships amber alongside)
- `design-system/sd.config.ts`
- `design-system/dist/{tokens.css,tokens.ts,tokens.json,tokens.figma.json}` (gitignored)
- `scripts/migrate-tokens.mjs`, `scripts/lint-token-boundary.mjs`, `scripts/lint-no-magic-values.mjs`, `scripts/contrast-check.mjs`, `scripts/check-theme-contract.mjs`, `scripts/check-figma-token-drift.mjs`, `scripts/diff-baselines.mjs`
- `scripts/lint-no-magic-values.allowlist.json` — pre-populated with every legitimate exception found by first lint run
- `.github/workflows/tokens-figma-sync.yml`, `.github/workflows/tokens-figma-pull.yml`
- New `pnpm tokens:build`, `pnpm tokens:check`, `pnpm tokens:figma:export`, `pnpm tokens:figma:check` scripts
- CI workflow updates: 6 new gates (token build, boundary lint, magic-values lint, contrast, theme contract, Figma drift)

**Files changed:**
- All 31 `.module.css` files (codemod-rewritten)
- `app/globals.css` (token import path)
- `app/css/_tokens.css` (deleted)
- Playwright visual baselines (regenerated as part of PR; manual-review gate via `diff-baselines.mjs` before commit)
- `package.json` (predev + prebuild lifecycle hooks; new scripts)
- `.gitignore` (`design-system/dist/` added)
- DECISIONS.md, ARCHITECTURE.md, CLAUDE.md updates

**Failure modes specific to PR A:**
1. Codemod typos cause silent value changes — visual baselines + contrast gate catch them
2. Mass-rename PR creates massive review diff — codemod commit structured separately from token-pipeline commits
3. Style Dictionary transitive dep surface — exact-pinning + `pnpm bundle-check` confirms zero runtime bundle change
4. Codemod misses tokens inside `calc()` / `color-mix()` / `linear-gradient()` wrappers — uses `postcss-value-parser` AST traversal, NOT regex; codemod ships a self-test against a fixture
5. Visual baseline regeneration masks real drift — manual-review gate via `diff-baselines.mjs` before commit
6. `dist/*` missing on fresh clone — `predev` lifecycle hook + banner in generated files
7. Allowlist not pre-populated — first lint run produces the allowlist as part of PR A; lint clean before mergeable
8. Figma sync workflows leak tokens before code review — both directions require PR review on the receiving repo before propagating

**Reversibility:** medium. Single `git revert` + regenerated visual baselines.

### 7.2 PR B — Eight primitive components

**Goal:** 8 primitives shipped under `design-system/components/`; existing portfolio refactored to consume them; renders byte-identical.

**Files added:**
- 8 component directories under `design-system/components/{Button,Field,Badge,TerminalPanel,StatTile,CmdLine,KbdKey,Link}/` (4 files each: `.tsx`, `.module.css`, `.test.tsx`, `index.ts`)
- `design-system/lib/cx.ts`
- `design-system/index.ts` (barrel re-export; consumers in client islands MUST use deep paths per §4.4)
- `tests/e2e/design-system-components.spec.ts` (per-component Playwright visual baselines)

**Files changed:**
- `components/sections/Hero.tsx` — `<Button>`, `<Badge>`, `<CmdLine>` adoption
- `components/sections/ContactSection.tsx` + ContactForm island — `<Field>` adoption (via deep-path import)
- `components/HeroStats.tsx` — `<StatTile>` adoption
- Every section using a bordered panel — `<TerminalPanel>` adoption
- ManPage, Shell, Visa, Guitar — `<KbdKey>` + `<CmdLine>` adoption
- Every nav anchor (topbar, dock, in-section links) — `<Link>` adoption
- Multiple `.module.css` files shrink as styles move into primitives

**Failure modes specific to PR B:**
1. Component API doesn't match call sites — `thinking-inversion` task: read every existing call site BEFORE designing each component's API
2. Visual drift between extracted and inline — per-component + section-level baselines double-catch
3. A11y regression — per-component axe test + existing integration axe suite
4. Bundle regression — `pnpm bundle-check` + lint rule rejecting `"use client"` in `design-system/components/*` without exception comment
5. Forgotten consumers — ripgrep CI gate fails if any inline `.cta`, `.status`, `.field`, anchor with old styling survives outside `design-system/components/`
6. **Barrel-import bundle leak** — client islands importing primitives via the barrel pull the entire surface in. `pnpm bundle-check` per-route diffs `/` route pre/post PR B; required 0-byte delta. If a leak surfaces, deep-path-only import pattern is the remediation; documented in contributor docs

**Reversibility:** medium. Pure-additive primitives; revert is `git revert` + re-inlining.

### 7.3 PR C — `/design-system` MDX docs + auto-API + visual changelog

**Goal:** public design-system pages live, linked from nav, discoverable; auto-API generation + visual changelog automation infrastructure live.

**Files added:**
- `app/design-system/{layout.tsx, page.mdx}` (landing)
- `app/design-system/tokens/page.mdx`
- `app/design-system/components/page.mdx`
- `app/design-system/enforcement/page.mdx`
- `app/design-system/changelog/page.mdx`
- `app/design-system/_components/{Sidebar.client.tsx, CopyButton.client.tsx, Preview.tsx}`
- `scripts/gen-component-api.mjs` (TS→MDX prop-table generator using `ts-morph`)
- `design-system/components/<Name>/_generated-api.mdx` (one per component; gitignored)
- `.github/workflows/visual-changelog.yml`
- `scripts/build-visual-changelog.mjs` (consumes Playwright diffs; updates `app/design-system/changelog/page.mdx`)
- `tests/e2e/design-system-pages.spec.ts` (per-route e2e + a11y)

**Files changed:**
- `next.config.ts` — MDX plugin config
- `components/DesktopTopbar.tsx` — `DESIGN_SYSTEM` nav link
- `components/Dock.tsx` — 6th slot
- `app/sitemap.ts` — 5 new URLs (themes added in PR D)
- `public/llms.txt` — new section pointing to `/design-system/*`
- `lighthouse.config.cjs` — 5 new routes in LHCI runs (`/design-system/themes` added in PR D)
- DECISIONS.md, ARCHITECTURE.md updates

**Failure modes specific to PR C:**
1. MDX + Turbopack incompatibility — **HARD GATE on `writing-plans` for PR C.** Pre-plan spike on throwaway branch: smallest possible MDX page in `app/_spike/page.mdx`. Outcome (works / works-with-webpack-fallback / does-not-work) feeds the plan; if no fallback works, PR C scope is reconsidered (eject MDX, ship TSX-compiled docs)
2. Bundle leak into main routes — per-route `pnpm bundle-check`; required 0-byte delta on `/`
3. Live preview hydration mismatch — RSC-default + `<noscript>` fallback for copy button
4. Auto-API drift — `pnpm gen-api:check` regenerates fragments (gitignored) and asserts deterministic output + JSDoc completeness; fails CI on `MISSING_PROP_DOC` or generator exception
5. Missing JSDoc on a prop — generator fails CI with `MISSING_PROP_DOC: <Component>.<propName>`; documented in contributor docs
6. Visual-changelog workflow misses a baseline update — defensive: pre-merge check confirms the workflow ran successfully on the PR
7. SEO ranking shift — accepted; canonical URLs prevent cross-portfolio duplication
8. A11y regression on docs — axe spec extended to all 5 routes (themes route added in PR D); LHCI a11y = 100 enforced
9. Component↔heading drift — build-time check fails if a primitive lacks a `## ComponentName` heading in `app/design-system/components/page.mdx`

**Reversibility:** high. Pure-additive route; revert is `git revert` + nav link removal.

### 7.4 PR D — Theme variants (CRT amber) + theme switcher

**Goal:** second theme (`crt-amber`) shipped as a switcher on `/design-system/themes`; demonstrates the two-tier architecture handles theme variants without component churn.

**Depends on:** PR A (tokens), PR C (docs route)

**Files added:**
- `design-system/tokens/themes/crt-amber.json` (amber semantic→primitive mappings)
- `design-system/tokens/color.json` (extended with `--ds-amber-50` through `--ds-amber-700` ramp)
- `app/design-system/themes/page.mdx` (theme gallery + live switcher)
- `app/design-system/_components/ThemeSwitcher.client.tsx` (~500 bytes; sets `[data-theme]` on `<html>`, persists via localStorage)

**Files changed:**
- `app/layout.tsx` — read theme preference cookie SSR-side, set `data-theme` on `<html>` before hydration (zero-flash contract)
- `app/sitemap.ts` — `/design-system/themes` URL added
- `components/AppShell.tsx` — theme cookie write on theme change
- `design-system/dist/tokens.css` — regenerated with two-theme scoped selectors
- `scripts/contrast-check.mjs` — extended to check both themes
- DECISIONS.md entry

**Failure modes specific to PR D:**
1. Theme switch flashes wrong theme on first paint — SSR-side `data-theme` set in root `<html>` from cookie; client switch only updates after initial paint
2. Amber theme breaks contrast on a pair — `check-theme-contract.mjs` walks both themes; CI fails before merge
3. Missing semantic role in amber theme — `check-theme-contract.mjs` asserts every role in `crt-green` exists in `crt-amber`
4. localStorage unavailable (privacy mode) — fallback to cookie; if neither, default to `crt-green`; never throw
5. ThemeSwitcher leaks into main portfolio bundle — only mounted on `/design-system/themes`; `pnpm bundle-check` confirms zero delta on `/`

**Reversibility:** high. Pure-additive; revert is `git revert`.

### 7.5 PR E — Storybook subdomain

**Goal:** Storybook 8 deployed to `ds.erikunha.dev` as interactive component playground.

**Depends on:** PR B (primitives)

**Files added:**
- `.storybook/{main.ts,preview.ts,theme.ts}`
- `design-system/components/<Name>/<Name>.stories.tsx` — one per primitive (8 total)
- `tests/storybook/*.test.ts` — interaction tests for primitives with state (Field error state, Button disabled, ThemeSwitcher)
- `vercel.json` (or `vercel.ts`) for the `erikunha-ds` Vercel project — root = `storybook-static/`, headers config
- `.github/workflows/storybook-deploy.yml` — separate deploy pipeline triggered on main pushes that touch primitives

**Files changed:**
- `package.json` — `storybook`, `@storybook/*` deps (exact-pinned); `pnpm storybook`, `pnpm storybook:build`, `pnpm storybook:test` scripts
- `.gitignore` — `storybook-static/` added
- `tsconfig.json` — Storybook path aliases (`@/design-system/*`)
- `public/llms.txt` — Storybook subdomain referenced
- ARCHITECTURE.md, DECISIONS.md updates

**Failure modes specific to PR E:**
1. Storybook Vite builder conflicts with Next's Turbopack — Storybook runs in its own builder; no shared config; the conflict is structural-only, not runtime
2. Stories drift from component API — `pnpm storybook:build` runs in CI on every PR that touches `design-system/components/*`; fails on TS error
3. Subdomain SSL provisioning fails — Vercel auto-provisions; if it fails, fall back to `erikunha-ds.vercel.app` deploy URL until DNS resolves
4. CORS on embedded preview from `/design-system` — explicit `Access-Control-Allow-Origin: https://erikunha.dev` header in `vercel.json`
5. Storybook a11y test failure on first push — `@storybook/addon-a11y` runs axe per story; primitives already passed integration axe in PR B, so this should be a tightening, not a new floor

**Reversibility:** high. Independent deploy; revert is `git revert` + Vercel project deletion + DNS cleanup.

---

## 8. Cross-cutting failure-mode checklist

Per the CLAUDE.md `thinking-inversion before writing-plans` rule, the explicit class-of-bugs this work introduces:

| Bug class | Example | Mitigation owned by |
|---|---|---|
| Mass-rename typos | `--ds-color-signel` (misspelled) | PR A codemod + boundary lint |
| Orphan references | `app/old-file.css` references `--signal` after rename | PR A ripgrep CI gate |
| Primitive leakage into components | `Button.module.css` uses `var(--ds-green-500)` | PR A boundary lint |
| Hardcoded magic values | `padding: 16px` instead of `var(--ds-space-pad)` | PR A no-magic-values lint |
| Contrast regression | semantic remap shifts pair below WCAG AA | PR A contrast gate + Lighthouse |
| Visual drift on token rename | a token maps to a slightly different resolved value | PR A Playwright baselines |
| Component API mismatch | `<Button>` API doesn't fit Hero CTA pattern | PR B: read all call sites first |
| Visual drift on component extraction | extracted Button renders 1px different | PR B per-component baselines + section baselines |
| A11y regression on extraction | extracted Badge loses `aria-hidden` on dot | PR B per-component axe + integration axe |
| Bundle regression from components | accidental `"use client"` in a primitive | PR B `pnpm bundle-check` + lint |
| Forgotten consumers | a section keeps inline `.cta` styles | PR B ripgrep CI gate |
| MDX + Turbopack break | Next 16 + MDX page fails to compile | PR C prototype spike before plan |
| Bundle leak to main routes | sidebar lib imported into `/` | PR C per-route bundle check |
| Live preview hydration | preview drifts from displayed source | PR C: single-source-of-truth or diff check |
| Docs a11y regression | new sidebar nav lacks landmark | PR C extended axe spec |
| Docs maintenance drift | new component lacks docs entry | PR C build-time component↔heading check |
| Style Dictionary version drift | minor bump changes output format | Exact-pin Style Dictionary in PR A |
| Codemod misses tokens inside `calc()` / `color-mix()` wrappers | `calc(var(--signal) + 10px)` not rewritten because regex doesn't enter the wrapper | PR A codemod uses AST-aware CSS parser (`postcss-value-parser`), NOT regex — explicitly required, not optional |
| Visual baseline regeneration masks real drift | Tokens get a 1px-off resolved value; baselines regenerate and pass; the drift never surfaces | PR A introduces a manual-review gate: regenerate baselines, then visually diff the prior baseline against the new one BEFORE committing; reviewer (human, not automated) confirms intent |
| `design-system/dist/*` is gitignored but imported — `pnpm dev` fails on a fresh clone without `tokens:build` | Developer clones, runs `pnpm dev`, gets import error from `app/globals.css` | PR A adds a `predev` lifecycle hook (in addition to `prebuild`) that runs `pnpm tokens:build` if `dist/tokens.css` is missing |
| MDX + Turbopack incompatibility discovered mid-plan, plan blocks | Plan assumes MDX works, implementation discovers it doesn't | **PR C spike runs BEFORE plan writing.** Spike outcome (works / works-with-webpack-fallback / does-not-work) is a hard gate on `writing-plans` for PR C |
| Barrel import leaks primitives into client islands | `ContactForm.client.tsx` imports `<Field>` from `@/design-system`; tree-shaker pulls the entire barrel surface | PR B `pnpm bundle-check` diffs `/` route pre/post, required 0-byte delta; fallback is deep-path import pattern (`@/design-system/components/Field`) documented in contributor docs |
| Motion primitive leakage into components | `Hero.module.css` uses `transition: opacity var(--ds-duration-base) var(--ds-ease-in-out)` instead of `var(--ds-motion-fade-default)` | PR A boundary lint extended to motion primitives; `@keyframes` blocks are the documented exception |
| Theme contract drift | `crt-amber.json` missing a semantic role that `crt-green.json` defines | PR A ships `scripts/check-theme-contract.mjs`; PR D extends it to enforce per-theme contrast |
| Theme switcher flash-of-wrong-theme | Client hydration sets a different theme than SSR initial render | PR D root layout reads theme cookie SSR-side and sets `data-theme` on `<html>` before any client code runs |
| Figma sync direction conflict | Designer pushes from Figma while engineer pushes from code; both land overlapping changes | Both directions land as PRs that require review on the receiving repo; code is the source of truth; Figma's change is a proposal |
| Figma token format drift | W3C Design Tokens spec changes break sync | Spec version exact-pinned in `tokens.figma.json` schema reference; CI fails on schema mismatch |
| Auto-API generator drops a prop | `ts-morph` extraction misses a complex generic prop | `pnpm gen-api:check` regenerates fragments (gitignored) and asserts no `MISSING_PROP_DOC` error; missing props surface as generator failures, not as diff against committed files |
| JSDoc missing on a primitive's prop | Component prop has no JSDoc; generator emits empty description | Generator fails CI with `MISSING_PROP_DOC: <Component>.<propName>`; build doesn't pass until docs added |
| Visual changelog spam from environmental drift | Font rendering change in Chromium causes hundreds of trivial diff entries | `[no-changelog]` commit-message label skips the changelog entry; for systemic drift, baseline-regen PR labeled `[no-changelog]` |
| Storybook stories drift from primitive API | Renaming a Button prop breaks all stories | `pnpm storybook:build` runs in CI on every PR touching `design-system/components/*`; TS error fails the build |
| Storybook subdomain SSL fails to provision | Vercel DNS bind takes longer than expected | Fall back to `erikunha-ds.vercel.app` deploy URL; documented in PR E spec; DS subdomain follows when DNS resolves |
| Storybook CORS blocks embedded preview from `/design-system` | Browser refuses to load `ds.erikunha.dev` content inside `erikunha.dev` page | `vercel.json` for `erikunha-ds` sets `Access-Control-Allow-Origin: https://erikunha.dev`; tested in PR E |
| New component lacks Storybook story | Primitive added in a future PR has no `Component.stories.tsx` | Build-time check fails if `design-system/components/<Name>/` lacks `<Name>.stories.tsx` |

---

## 9. Testing strategy

**Unit (vitest):** every primitive gets a `Component.test.tsx` covering: default render, each variant, each size, disabled state, error state (Field), polymorphic `as` (Button, TerminalPanel, Link), prefers-reduced-motion (Badge dot), theme-aware rendering (Link variants × both themes).

**Visual (Playwright):** every primitive gets a per-variant baseline in `tests/e2e/design-system-components.spec.ts`. Existing section-level baselines in `tests/e2e/visual.spec.ts` continue to catch integration drift. Theme variants (PR D) add a second baseline matrix (every component × every theme).

**A11y (axe):** every primitive gets an axe scan in its test; every new docs route extends `tests/a11y/axe.spec.ts`; Storybook stories run axe via `@storybook/addon-a11y` (PR E).

**E2E (Playwright):** every docs route gets a smoke test in `tests/e2e/design-system-pages.spec.ts` — navigates, asserts content, asserts copy button works (chromium only), asserts live preview renders, asserts theme switcher persists across reload (PR D).

**Storybook (PR E):** `pnpm storybook:test` runs `@storybook/test-runner` against every story (headless Chrome under Playwright); interaction tests in `tests/storybook/*.test.ts` cover state-bearing primitives (Field error state, Button disabled, ThemeSwitcher persistence).

**Lint:** boundary lint, no-magic-values lint, contrast check, theme contract check, Figma drift check, auto-API drift check — all CI gates added by PR A (first 5) and PR C (auto-API).

**Build:** `pnpm tokens:check`, `pnpm tokens:figma:check`, `pnpm gen-api:check`, `pnpm bundle-check` per route — all CI gates. `pnpm storybook:build` runs on every PR touching `design-system/components/*`.

**Pre-plan spike (PR C):** MDX+Turbopack compatibility verified on throwaway branch before `writing-plans` for PR C is invoked. Spike outcome recorded in the spec's appendix (added during PR C planning).

---

## 10. Performance budget impact

| Metric | Current | After all PRs | Δ |
|---|---|---|---|
| LCP on `/` | <1.8s | <1.8s | 0 |
| Client JS on `/` | ~30KB | ~30KB | 0 (RSC primitives ship nothing; barrel-leak gated by `pnpm bundle-check`) |
| Client JS on `/design-system/*` | n/a | <2.5KB total (Sidebar ~1KB + CopyButton ~0.6KB + ThemeSwitcher ~0.5KB + Preview ~0.4KB) | new |
| Client JS on `ds.erikunha.dev` (Storybook) | n/a | independent deploy; Storybook's own bundle (~250KB) is acceptable for the engineering tool — NOT counted against portfolio budgets | new (separate domain) |
| Lighthouse Perf on `/` | ≥95 | ≥95 | 0 |
| Lighthouse Perf on `/design-system/*` | n/a | ≥95 (enforced on 6 routes including `/design-system/themes`) | new |
| Lighthouse Perf on Storybook | n/a | not gated (engineering tool) | new |
| Lighthouse A11y everywhere | =100 | =100 (DS routes included; Storybook stories gated via `@storybook/addon-a11y`) | 0 |
| Build time | ~current | +8-12s total (~1-2s Style Dictionary cached + ~2-3s Shiki MDX + ~1-2s component API gen + ~1s theme contract + ~3-4s Storybook build only when triggered) | accepted at this scale |

**Note on the "Client JS on `/` unchanged" assumption:** PR B introduces a `design-system/index.ts` barrel re-export (§4.4). Barrel imports are a known bundle-leak vector — if a client island like `ContactForm.client.tsx` imports `<Field>` from `@/design-system`, naive tree-shaking can pull the entire barrel surface into the client bundle, even though `<Field>` itself is RSC-safe. PR B includes an explicit verification: `pnpm bundle-check` diffs the `/` route bundle pre-PR-B vs post-PR-B; required result is 0-byte delta. If a leak appears, the remediation is to import primitives via deep paths (`@/design-system/components/Field`) and document the deep-path-only pattern in the design system contributor docs.

---

## 11. Open questions for architect-reviewer

Most prior open questions resolved during scope expansion 2026-05-23. The remaining open items + the decisions taken:

1. **Motion semantic layer.** **Decision 2026-05-23: INCLUDED in v1.** Per CLAUDE.md "Operating role" — YAGNI is the wrong frame at this bar. Motion semantics (`--ds-motion-fade-default`, `--ds-motion-press`, `--ds-motion-reveal`, `--ds-motion-shimmer`) layered on duration/easing primitives. Components consume the semantics; `@keyframes` blocks remain a documented primitive-consumption exception.
2. **`KbdKey` inclusion in v1.** **Decision: INCLUDE.** Coherent terminal-primitive set; ~20 LoC; multiple use sites in ManPage and Shell.
3. **`StatTile` with one consumer.** **Decision: KEEP in v1.** Documenting the primitive sets up the next StatGrid consumer cleanly. The composition pattern (`StatGrid`) lives in the docs page, not the primitive set — the boundary is explicit.
4. **`Link` as a primitive.** **Decision 2026-05-23: INCLUDE in v1.** Resolves the Button/anchor semantic conflation flagged by architect-reviewer. Three variants (`inline`, `nav`, `external`) cover every anchor pattern in the portfolio. v1 component count is 8.
5. **`StatGrid` composition on `/design-system/components`.** **Decision: YES**, under a "Composition Patterns" subsection. Documents the canonical 4-up grid using `StatTile` with the source visible.
6. **`<Preview>` source-of-truth model.** **Decision: AUTOMATED from JSX children** via `@mdx-js/loader` AST walking at build time. Removes the source-vs-preview drift bug class.
7. **Mobile sidebar mechanism.** **Decision: native `<details>`** — zero JS, accessibility-safe, aesthetic-consistent.

**New open question (raised by scope expansion):**

8. **Figma sync repository topology.** Recommendation: a single shared repo `erikunha/design-tokens-figma-sync` that both this codebase pushes to AND Tokens Studio plugin pulls from. Alternative: direct webhook to Figma. Recommendation favors the shared repo because GitHub's PR review surface is the desired control point (the spec says "Figma's change becomes a proposal" — that proposal needs a PR to exist).
9. **Storybook subdomain authentication.** Recommendation: PUBLIC (no auth). Reasoning: the design system is public-by-design; the hiring-artifact value depends on discoverability. Alternative is Vercel password protection, which would obscure the artifact. Open to override if specific stories carry confidential examples (none anticipated in v1).
10. **Visual changelog cadence on `/design-system/changelog`.** Recommendation: one entry per merged PR that updates a baseline. Alternative is daily/weekly batched entries (less spam, less granularity). Per-PR matches the spec's "single source of truth = the baseline files themselves" principle.

---

## 12. Acceptance criteria

The work is complete when:

**Token system (PR A):**
- [ ] `app/css/_tokens.css` deleted; project consumes `design-system/dist/tokens.css`
- [ ] Two-tier architecture: primitives + semantic in separate JSON files; Style Dictionary generates outputs
- [ ] Every `.module.css` uses semantic tokens only (boundary lint passing; motion primitives allowed in `@keyframes` only)
- [ ] Zero hardcoded magic values in `.module.css` (no-magic-values lint passing; allowlist populated)
- [ ] All WCAG AA contrast pairs pass for `crt-green` (contrast check passing)
- [ ] Motion semantic layer (`--ds-motion-*`) defined and consumed by components
- [ ] Figma sync workflows live (both directions); drift gate passing
- [ ] `predev` lifecycle hook present; fresh clone runs `pnpm dev` without manual `tokens:build`

**Components (PR B):**
- [ ] All 8 primitives extracted (Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey, Link) and consumed in the existing portfolio
- [ ] Per-component unit tests, visual baselines, axe scans all green
- [ ] Barrel import bundle-leak gate: 0-byte delta on `/` route client JS
- [ ] Every nav anchor uses `<Link>`; every action anchor uses `<Button as="a">`; no inline `.cta`/`.status`/`.field` survives outside `design-system/components/`

**Docs route (PR C):**
- [ ] `/design-system/{,tokens,components,enforcement,changelog}` live, linked from topbar + dock + sitemap + llms.txt
- [ ] Auto-API tables generated at build time; every component prop has JSDoc; `gen-api:check` passing
- [ ] Visual changelog workflow live; PRs that update baselines post diff comments + changelog entries
- [ ] Lighthouse Perf ≥95, A11y =100 on `/design-system/*`

**Theme variants (PR D):**
- [ ] `crt-amber` theme shipped; theme contract check passing for both themes
- [ ] `/design-system/themes` page live with switcher; SSR-safe (no theme flash on first paint)
- [ ] All WCAG AA contrast pairs pass for `crt-amber` (extended contrast check passing)
- [ ] Main portfolio routes stay on `crt-green` always; ThemeSwitcher is `/design-system/themes`-only

**Storybook (PR E):**
- [ ] `ds.erikunha.dev` resolves to Storybook 8 deploy
- [ ] Every primitive has a `<Name>.stories.tsx` with default + variant stories
- [ ] `@storybook/addon-a11y` runs on every story; no violations
- [ ] `pnpm storybook:build` runs in CI; fails on TS error or story drift
- [ ] Build-time check: every `design-system/components/<Name>/` has `<Name>.stories.tsx`

**Cross-cutting:**
- [ ] Lighthouse Perf ≥95, A11y =100 on `/` (unchanged)
- [ ] Client JS on `/` unchanged (RSC primitives ship nothing)
- [ ] Visual baselines regenerated and reviewed via `diff-baselines.mjs` before commit
- [ ] DECISIONS.md, ARCHITECTURE.md, CLAUDE.md, STANDARDS.md reflect the new system
- [ ] `architect-reviewer` returned `GATE_RESULT: PASS` on this spec before plan writing (final pass; this spec)
- [ ] MDX+Turbopack spike completed before PR C planning (recorded outcome)
