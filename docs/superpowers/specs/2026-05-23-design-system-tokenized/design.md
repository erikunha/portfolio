> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# Design System Tokenized — Design

> **HISTORICAL DOCUMENT — do not follow as implementation guidance.** This spec describes a design that partially diverged during execution. `layer.json` and `--ds-layer-*` tokens were never created. The Style Dictionary config does not generate `tokens.ts` or `tokens.figma.json`. The authoritative token surface is in `STANDARDS.md` Ch.12.

**Status:** spec → architect-reviewer → writing-plans
**Date:** 2026-05-23
**Author:** Erik Cunha (with brainstorming via Claude Code)
**Spans:** 3 PRs (A: tokens, B: components, C: docs route)

---

## 1. Goal

Build a published design system for erikunha.dev positioned at `/design-system`. The system itself is part of the Staff/Principal hiring artifact — the architecture, the rigor, the docs, and the enforcement together demonstrate frontend system thinking at the level the role demands.

The system has three deliverables:

1. **Two-tier token pipeline** (primitives + semantic) authored in JSON, generated to CSS + TypeScript + JSON, consumed by every CSS Module in the codebase.
2. **Seven primitive components** extracted from existing portfolio patterns: Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey.
3. **Public documentation** at `/design-system` with palette, type scale, components (live previews), enforcement rules, and changelog — discoverable from the main portfolio nav.

---

## 2. Non-Goals (v1)

Explicitly out of scope:

- Versioning, semver tags, published changelogs as separate releases
- Storybook (deferred; MDX-driven docs are the chosen surface)
- Extracted npm package (deferred; single-app consumption only)
- Theme variants beyond the current "CRT green" aesthetic (deferred; the two-tier architecture enables this later without component churn)
- Figma sync (deferred; tokens.json export is built so this is one tooling task away)
- Composed (non-primitive) components like TerminalSection, StatGrid, DataTable, Dock — these stay as section code in the portfolio
- Visual-changelog automation from Playwright diffs (deferred)
- Auto-generated component API tables from TypeScript types (deferred; manual MDX tables in v1)

---

## 3. Token Architecture

### 3.1 Source of truth

`design-system/tokens/*.json` — one file per category. Authored as JSON. Never edited as CSS by hand. Files:

- `color.json` — primitives (green ramp, neutrals, accents, feedback) + semantic aliases (signal, text, surface, border, feedback)
- `space.json` — primitives (numeric scale) + semantic (`pad`, `pad-tight`, `rhythm`, `rhythm-tight`)
- `typography.json` — primitives (size scale, line-height scale, font stacks) + semantic (`body`, `heading-sm/md/lg/xl`, `mono`, `display`)
- `motion.json` — primitives (duration scale, easing curves); no semantic layer needed at v1 — components reference duration primitives directly
- `layer.json` — primitives (z-index scale: base/sticky/overlay/headline)
- `border.json` — primitives (width, style: solid/dashed)

### 3.2 Tier 1: primitives (raw palette)

Naming: `--ds-{category}-{scale}` or `--ds-{category}-{role}` for non-scale primitives.

| Category | Tokens (sample) |
|---|---|
| Color | `--ds-green-50` (#0a1f0d, solid), `--ds-green-100` (rgba(0,255,65,0.1)), `--ds-green-150` (rgba(0,255,65,0.12)), `--ds-green-300` (rgba(0,255,65,0.2)), `--ds-green-400` (rgba(0,255,65,0.4)), `--ds-green-500` (#00FF41, solid), `--ds-green-700` (#0a8a2a, solid) |
| Color (text) | `--ds-text-100` (#E6FFE6), `--ds-text-300` (#5AE07B) |
| Color (neutral) | `--ds-neutral-0` (#000000), `--ds-neutral-50` (#050505) |
| Color (accent) | `--ds-accent-amber` (#ffd86b), `--ds-accent-cyan` (#7fe4ff), `--ds-feedback-error` (#ff8a8a) |
| Color (chrome dots) | `--ds-chrome-close` (#ff5f57), `--ds-chrome-minimize` (#febc2e), `--ds-chrome-maximize` (#28c840) — macOS traffic-light canonical hexes; no semantic layer (like motion/layer); components reference these primitives directly |
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

The full size scale (`--ds-font-size-2xs` through `--ds-font-size-3xl`) is also published as semantic tokens for cases where the heading hierarchy doesn't fit — but `--ds-font-size-heading-*` is preferred for headings, `--ds-font-size-body` for body.

**Primitives renamed but with no semantic alias** (referenced directly, like `--ds-duration-*`):

| Old name | New primitive name |
|---|---|
| `--red` | `--ds-chrome-close` |
| `--yellow` | `--ds-chrome-minimize` |
| `--green-light` | `--ds-chrome-maximize` |

### 3.4 Enforcement: token boundary lint

`scripts/lint-token-boundary.mjs` runs in CI. Scans every `.module.css` file under `components/`, `app/`, and `design-system/components/`.

**Rejects** any `var()` reference to primitives that DO have a semantic layer:
- `--ds-green-*`, `--ds-text-\d+` (digit-suffix only — matches `--ds-text-100`, `--ds-text-300`; does NOT match `--ds-text-size-*` or `--ds-text-leading-*`), `--ds-neutral-*`, `--ds-accent-*`, `--ds-feedback-*` (color primitives — semantic layer is `--ds-color-*`)
- `--ds-space-\d+` (digit-suffix — matches `--ds-space-4`, `--ds-space-16`; space primitives — semantic layer is `--ds-space-pad{,-tight}`, `--ds-space-rhythm{,-tight}`)
- `--ds-text-size-*` (typography size primitives — semantic layer is `--ds-font-size-*`)

**Allows** semantic tokens AND primitives that have no semantic layer in v1 (motion, layer, radius, border, chrome dots, and leading — components reference these primitives directly):
- `var(--ds-color-*)`, `var(--ds-space-pad)`, `var(--ds-space-pad-tight)`, `var(--ds-space-rhythm)`, `var(--ds-space-rhythm-tight)`, `var(--ds-font-*)`, `var(--ds-layout-*)`
- `var(--ds-duration-*)`, `var(--ds-ease-*)`, `var(--ds-layer-*)`, `var(--ds-radius-*)`, `var(--ds-border-*)`, `var(--ds-chrome-*)`, `var(--ds-text-leading-*)` (terminal tokens; no semantic alias wraps them — direct use is correct)

**Naming convention:** primitives MUST NOT use the `--ds-color-` prefix (reserved for semantic tokens only). This keeps the `var(--ds-color-*)` allowlist correct as the system grows.

**Exception path:** the semantic-layer CSS file itself (`design-system/dist/tokens.css`) — primitives are the input there.

### 3.5 Enforcement: no magic values lint

`scripts/lint-no-magic-values.mjs` runs in CI. Scans every `.module.css` file. Rejects:

- Raw hex colors (`#[0-9a-fA-F]{3,8}` outside `var()` arguments) — must use a color token
- Raw `px` values not in the token set, outside specific allowlisted properties (`outline-offset`, sub-pixel calc tweaks)
- Raw `ms`/`s` durations (must use `--ds-duration-*`)
- Hardcoded z-index values (must use `--ds-layer-*`)

Allowlist file: `scripts/lint-no-magic-values.allowlist.json` — documented exceptions (e.g., 9999px honeypot offset, sub-pixel borders).

### 3.6 Enforcement: contrast audit

`scripts/contrast-check.mjs` runs in CI. Walks every semantic text/surface token pair, computes WCAG AA contrast ratio (4.5:1 normal, 3:1 large text), fails on any pair below threshold. Hardcoded pairs defined in the script:
- `--ds-color-text-body` on `--ds-color-surface-base` (must be ≥ 4.5:1)
- `--ds-color-text-muted` on `--ds-color-surface-base` (≥ 4.5:1)
- `--ds-color-text-faint` on `--ds-color-surface-base` (≥ 4.5:1)
- `--ds-color-signal` on `--ds-color-surface-base` (≥ 3:1 — used for large headings)
- `--ds-color-text-body` on `--ds-color-surface-shell` (≥ 4.5:1)
- `--ds-color-signal` on `--ds-color-surface-shell` (≥ 3:1 — terminal headers and prompts render on the shell background)

### 3.7 Build pipeline

- **Tool:** Style Dictionary (exact-pinned, no caret)
- **Config:** `design-system/sd.config.ts`
- **Outputs** (committed to the repository — never gitignore these):
  - `design-system/dist/tokens.css` — both tiers in CSS custom properties
  - `design-system/dist/tokens.ts` — flat named `export const` values (Style Dictionary `javascript/es6` format, e.g. `export const DsColorSignal = "#00ff41";`); one export per token, PascalCase name
  - `design-system/dist/tokens.json` — flat key/value (Figma sync, AI tooling, generated docs)
  - `design-system/dist/` is committed to the repository. The `tokens:check` script (`pnpm tokens:check`) builds the pipeline and runs `git diff --exit-code design-system/dist/` to detect drift between source tokens and committed artifacts. Never add `design-system/dist/` to `.gitignore`.
- **Scripts:**
  - `pnpm tokens:build` — runs Style Dictionary, regenerates dist
  - `pnpm tokens:check` — regenerates AND diffs against committed; fails on drift (catches hand-edited dist files)
- **Wiring:** `pnpm tokens:build` runs in the `prebuild` lifecycle hook (so `pnpm build` always picks up latest tokens). CI runs `pnpm tokens:check` as its own gate. Build cache key includes `design-system/tokens/` content hash to skip rebuild on no-op.

### 3.8 Migration

- Codemod (`scripts/migrate-tokens.mjs`) with explicit before→after map applies the rename across all 31 `.module.css` files **and** `.tsx` files with inline `style` prop `var()` references. Two known `.tsx` cases: `components/sections/HottestTakesSection.tsx:17` and `components/sections/ResponsibilitiesSection.tsx:18` (both `var(--muted-dim)` → `var(--ds-color-text-faint)`). Either extend the codemod regex to match `style={{ ... var(--legacy-name) ... }}` patterns, or refactor these two call sites to className-based approaches as part of PR A. Pick one approach; both are valid.
- `app/css/_tokens.css` deleted
- `app/globals.css` imports `design-system/dist/tokens.css` instead
- Ripgrep CI gate fails on any orphan reference to a legacy token name (`--signal`, `--fg`, `--pad`, etc.) outside the legacy-map file in `scripts/migrate-tokens.mjs`
- DECISIONS.md gets an ADR entry for the migration

---

## 4. Components

Seven primitive components. Each is a single-responsibility, RSC-by-default, semantic-token-only React component. Each ships with a unit test, a Playwright visual baseline, and an MDX docs page.

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
export * from './dist/tokens';  // flat named export consts (javascript/es6 format)
```

Consumers import as `import { Button } from '@/design-system'`.

---

## 5. Documentation Route (`/design-system`)

### 5.1 Route structure

| Route | Content |
|---|---|
| `/design-system` | Landing — overview, principles, links to other pages |
| `/design-system/tokens` | Palette, type scale, spacing, motion, layers, borders — visual tables |
| `/design-system/components` | All 7 components on one scrollable page with anchor links (`#button`, etc.) |
| `/design-system/enforcement` | Lint rules, CI gates, contributing guide, codemod info |
| `/design-system/changelog` | Token + component change log (manually maintained MDX, auto-suggestion script optional) |

### 5.2 MDX setup

- `@next/mdx` package (exact-pinned), `@mdx-js/loader`, `@mdx-js/react`, `@types/mdx` (dev), `rehype-pretty-code`, `shiki` — all exact-pinned
- Configured via `next.config.ts` — `createMDX({ options })` wrapper, `pageExtensions: ['ts', 'tsx', 'mdx']`
- **`mdx-components.tsx` required at project root.** `@next/mdx` checks for this file first; without it the fallback to `@mdx-js/react` triggers a `React.createContext` crash in RSC production bundles (createContext is client-only). The root file exports `useMDXComponents` and is the MDX component map: auto-id'd headings for anchor nav, `<Preview>` component, `<SyntaxBlock>` wrapper.
- **Turbopack plugin constraint:** all remark/rehype/recma plugins in `next.config.ts` MUST be referenced as `['package-name', { plainOptions }]` string tuples, NOT as imported function references. Turbopack requires serializable loader options; function references fail validation. `@next/mdx`'s internal `importPluginForPath` resolves them by package name at MDX compile time.
- Code blocks via `rehype-pretty-code` + `shiki` — build-time syntax highlighting, zero runtime cost. Referenced as `['rehype-pretty-code', { theme: 'github-dark-dimmed' }]`.
- File-based routing: `app/design-system/page.mdx`, `app/design-system/tokens/page.mdx`, etc.
- Inline React component imports in MDX work normally (`import { Button } from '../../design-system/components/Button'`); imported components are treated as RSC by default (no client JS if they have no `'use client'` directive).

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

Renders the live component inside a bordered panel (`TerminalPanel`) plus a "View source" disclosure via native `<details>` (zero JS) showing the raw TSX. Source display and live render share one authored source — drift is impossible because source is injected at build time (see below).

**Source injection:** `lib/mdx/recma-preview-source.ts` — a recma plugin operating at the ESTree (JavaScript AST) level, after MDX compiles JSX to JS. It walks the ESTree for `JSXElement` nodes whose opening tag is `<Preview>`, serializes the children JSX back to a source string via `estree-util-to-js`, and injects it as a `source` string prop on the `<Preview>` element before React sees it. The `Preview` component receives both `children` (live render) and `source` (display string) from a single authored node.

Referenced in `next.config.ts` as `['./lib/mdx/recma-preview-source', {}]` (string path — Turbopack serialization requirement).

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

- Extend `tests/a11y/axe.spec.ts` to cover all 5 new routes
- Sidebar nav: `<nav aria-label="Design system">` landmark
- Heading hierarchy: strict h1 → h2 → h3 per page
- Live previews: source `<details>` is keyboard-navigable
- Color tokens documented with hex + computed contrast ratio against `--ds-color-surface-base`
- Code blocks: `<pre tabIndex={0} role="region" aria-label="Code sample">` so screen readers navigate as a single landmark
- Lighthouse a11y score = 100 enforced on all new routes

### 5.9 Performance budget

- LCP target: < 1.8s on 4G stays
- Bundle: < 2KB client JS added to `/design-system/*`; zero added to `/`
- Build time: +1-2s for Style Dictionary; cached on no-op token changes
- LHCI runs against the 5 new routes; budgets per route enforced

---

## 6. PR Decomposition

Three PRs in strict order. Each is independently mergeable.

### 6.1 PR A — Token pipeline + mechanical migration

**Goal:** retire `app/css/_tokens.css`; project consumes `design-system/dist/tokens.css` only; portfolio renders within visual baseline tolerance (some semantic token value remaps are deliberate; Playwright baselines regenerated as part of PR; contrast gate confirms WCAG AA maintained throughout).

**Files added:**
- `design-system/tokens/{color,space,typography,motion,layer,border}.json`
- `design-system/sd.config.ts`
- `design-system/dist/{tokens.css,tokens.ts,tokens.json}` (committed — not gitignored; drift checked by `pnpm tokens:check`)
- `scripts/migrate-tokens.mjs`, `scripts/lint-token-boundary.mjs`, `scripts/lint-no-magic-values.mjs`, `scripts/contrast-check.mjs`
- `scripts/lint-no-magic-values.allowlist.json`
- New `pnpm tokens:build` and `pnpm tokens:check` scripts
- CI workflow updates: 4 new gates (token build, boundary lint, magic-values lint, contrast)

**Files changed:**
- All 31 `.module.css` files (codemod-rewritten)
- `app/globals.css` (token import path)
- `app/css/_tokens.css` (deleted)
- Playwright visual baselines (regenerated as part of PR)
- DECISIONS.md, ARCHITECTURE.md, CLAUDE.md updates

**Failure modes specific to PR A:**
1. Codemod typos cause silent value changes — mitigated by visual baselines AND contrast gate
2. Mass-rename PR creates massive review diff — mitigated by structuring codemod commit separately from token-pipeline commits; reviewer reads codemod once, then mechanical diffs
3. Style Dictionary transitive dep surface — mitigated by exact-pinning + `pnpm bundle-check` confirms zero runtime bundle change (Style Dictionary is build-time only)
4. CI time regression — mitigated by token build cache keyed on `design-system/tokens/` hash

**Reversibility:** medium. Single `git revert` + regenerated visual baselines.

### 6.2 PR B — Primitive components

**Goal:** 7 primitives shipped under `design-system/components/`; existing portfolio refactored to consume them; renders byte-identical.

**Files added:**
- 7 component directories under `design-system/components/{Button,Field,Badge,TerminalPanel,StatTile,CmdLine,KbdKey}/` (4 files each: `.tsx`, `.module.css`, `.test.tsx`, `index.ts`)
- `design-system/lib/cx.ts`
- `design-system/index.ts` (barrel)
- `tests/e2e/design-system-components.spec.ts` (per-component Playwright visual baselines)

**Files changed:**
- `components/sections/Hero.tsx` — `<Button>`, `<Badge>`, `<CmdLine>` adoption
- `components/sections/ContactSection.tsx` + ContactForm island — `<Field>` adoption
- `components/HeroStats.tsx` — `<StatTile>` adoption
- Every section using a bordered panel — `<TerminalPanel>` adoption
- ManPage, Shell, Visa, Guitar — `<KbdKey>` + `<CmdLine>` adoption
- Multiple `.module.css` files shrink as styles move into primitives

**Failure modes specific to PR B:**
1. Component API doesn't match call sites — mitigated by `thinking-inversion` task in the plan: read every existing call site BEFORE designing each component's API
2. Visual drift between extracted and inline — mitigated by per-component baselines AND existing section-level baselines (double-catch)
3. A11y regression — mitigated by per-component axe test AND existing integration axe suite
4. Bundle regression — mitigated by `pnpm bundle-check` AND lint rule rejecting `"use client"` in `design-system/components/*` without exception comment
5. Forgotten consumers — ripgrep CI gate fails if any inline `.cta`, `.status`, `.field` class survives outside `design-system/components/`

**Reversibility:** medium. Pure-additive primitives; revert is `git revert` + re-inlining.

### 6.3 PR C — `/design-system` route + MDX docs

**Goal:** public design-system pages live, linked from nav, discoverable.

**Files added:**
- `app/design-system/{layout.tsx, page.mdx}` (landing)
- `app/design-system/tokens/page.mdx`
- `app/design-system/components/page.mdx`
- `app/design-system/enforcement/page.mdx`
- `app/design-system/changelog/page.mdx`
- `app/design-system/_components/{Sidebar.client.tsx, CopyButton.client.tsx, Preview.tsx}`
- `tests/e2e/design-system-pages.spec.ts` (per-route e2e + a11y)

**Files changed:**
- `next.config.ts` — MDX plugin config
- `components/DesktopTopbar.tsx` — DESIGN_SYSTEM nav link
- `components/Dock.tsx` — 6th slot
- `app/sitemap.ts` — 5 new URLs
- `public/llms.txt` — new section
- `lighthouse.config.cjs` — 5 new routes in LHCI runs
- DECISIONS.md, ARCHITECTURE.md updates

**Failure modes specific to PR C:**
1. MDX + Turbopack compatibility — **spiked, confirmed WORKS (no webpack fallback needed).** Two mandatory setup steps: (a) `mdx-components.tsx` at project root (prevents `@mdx-js/react` createContext crash in RSC production); (b) all plugins in `next.config.ts` as `['package-name', { plainOptions }]` string tuples (Turbopack serialization requirement — imported function references fail). `rehype-pretty-code` + shiki and custom recma plugin both confirmed compatible via string reference.
2. Bundle leak into main routes — mitigated by per-route `pnpm bundle-check` with explicit assertion that `/` route client JS does not increase
3. Live preview hydration mismatch — mitigated by RSC-default + `<noscript>` fallback for copy button only
4. SEO ranking shift — accepted as goal of the work
5. A11y regression — mitigated by extending axe spec to all 5 routes; LHCI a11y = 100 enforced
6. Maintenance load: every new token/component requires a docs update — mitigated by build-time check that every component in `design-system/components/*` has a corresponding `## ComponentName` heading in `app/design-system/components/page.mdx`

**Reversibility:** high. Pure-additive route; revert is `git revert` + nav link removal.

---

## 7. Cross-cutting failure-mode checklist

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
| MDX + Turbopack break | Next 16 + MDX page fails to compile | Spiked — confirmed WORKS; `mdx-components.tsx` + string-tuple plugin refs required |
| Bundle leak to main routes | sidebar lib imported into `/` | PR C per-route bundle check |
| Live preview hydration | preview drifts from displayed source | PR C: single-source-of-truth or diff check |
| Docs a11y regression | new sidebar nav lacks landmark | PR C extended axe spec |
| Docs maintenance drift | new component lacks docs entry | PR C build-time component↔heading check |
| Style Dictionary version drift | minor bump changes output format | Exact-pin Style Dictionary in PR A |

---

## 8. Testing strategy

**Unit (vitest):** every component gets a `Component.test.tsx` covering: default render, each variant, each size, disabled state, error state (Field), polymorphic `as` (Button, TerminalPanel), prefers-reduced-motion (Badge dot).

**Visual (Playwright):** every component gets a per-variant baseline in `tests/e2e/design-system-components.spec.ts`. Existing section-level baselines in `tests/e2e/visual.spec.ts` continue to catch integration drift.

**A11y (axe):** every component gets an axe scan in its test; every new docs route extends `tests/a11y/axe.spec.ts`.

**E2E (Playwright):** every docs route gets a smoke test in `tests/e2e/design-system-pages.spec.ts` — navigates, asserts content, asserts copy button works (chromium only), asserts live preview renders.

**Lint:** boundary lint, no-magic-values lint, contrast check — all CI gates added in PR A.

**Build:** `pnpm tokens:check` is a CI gate; `pnpm bundle-check` per route is a CI gate.

---

## 9. Performance budget impact

| Metric | Current | After all PRs | Δ |
|---|---|---|---|
| LCP on `/` | <1.8s | <1.8s | 0 |
| Client JS on `/` | ~30KB | ~30KB | 0 (RSC primitives ship nothing) |
| Client JS on `/design-system/*` | n/a | <2KB | new |
| Lighthouse Perf on `/` | ≥95 | ≥95 | 0 |
| Lighthouse Perf on `/design-system/*` | n/a | ≥95 (enforced) | new |
| Lighthouse A11y everywhere | =100 | =100 | 0 |
| Build time | ~current | +1-2s (Style Dictionary, cached on no-op) | minimal |

---

## 10. Open questions for architect-reviewer

Each carries a recommendation; architect-reviewer evaluates the recommendation, not invents an answer.

1. **Motion semantic layer.** Recommendation: NO in v1. Components reference `--ds-duration-*` and `--ds-ease-*` primitives directly. The cost of adding `--ds-motion-fade-default`, `--ds-motion-press-bounce`, etc. without a known second consumer is YAGNI. Adding the layer later is a non-breaking change (primitives remain). Risk: future "snappy vs calm" theme variants require a small follow-up; acceptable.
2. **`KbdKey` inclusion in v1.** Recommendation: INCLUDE. The component is ~20 LoC, has one clear use site, and tightens the artifact narrative ("we have a coherent set of terminal primitives"). Excluding it just to hit 6 is arbitrary.
3. **`StatGrid` composition on `/design-system/components`.** Recommendation: YES, in a separate "Composition Patterns" subsection at the bottom of the components page. Documents the canonical 4-up grid using `StatTile`, with the source visible. Sets up future composition documentation without bloating the primitives list.
4. **`<Preview>` source-of-truth model.** Resolved. A recma plugin (`lib/mdx/recma-preview-source.ts`, ~40 LoC) operates at the ESTree level after MDX compiles JSX to JS. It serializes `<Preview>` children back to a source string via `estree-util-to-js` and injects a `source` prop — live render and display share one authored node, drift is impossible. Must be referenced by path string in `next.config.ts` (Turbopack serialization constraint). `estree-util-to-js` and `estree-util-visit` are transitive MDX deps, zero new runtime cost.
5. **Mobile sidebar mechanism.** Recommendation: native `<details>` is acceptable for the polish bar. The CRT/brutalist aesthetic favors native, not animated. Zero JS, zero accessibility risk, ships immediately. Revisit only if user testing flags a problem.

---

## 11. Acceptance criteria

The work is complete when:

- [ ] All 3 PRs (A, B, C) merged
- [ ] `app/css/_tokens.css` deleted; project consumes `design-system/dist/tokens.css`
- [ ] Every `.module.css` uses semantic tokens only (boundary lint passing)
- [ ] Zero hardcoded magic values in `.module.css` (no-magic-values lint passing)
- [ ] All WCAG AA contrast pairs pass (contrast check passing)
- [ ] All 7 primitives extracted and consumed in the existing portfolio
- [ ] `/design-system/{,tokens,components,enforcement,changelog}` live, linked from topbar + dock
- [ ] Lighthouse Perf ≥95, A11y =100 on `/` AND all 5 new routes
- [ ] Client JS on `/` unchanged
- [ ] Visual baselines regenerated and committed
- [ ] DECISIONS.md, ARCHITECTURE.md, CLAUDE.md reflect the new system
- [ ] `architect-reviewer` returned `GATE_RESULT: PASS` on this spec before plan writing
