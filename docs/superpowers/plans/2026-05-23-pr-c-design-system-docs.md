> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# PR C — /design-system Route + MDX Docs Implementation Plan

> **HISTORICAL DOCUMENT — do not follow as implementation guidance.** Token examples in this doc reference `--ds-layer-*` which were never shipped; `layer.json` does not exist. See `STANDARDS.md` Ch.12 for the authoritative token surface.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisites:** PR A and PR B must be merged to `main` before starting this plan.

**Goal:** Ship public design-system documentation at `/design-system` with 5 pages (landing, tokens, components, enforcement, changelog), linked from the topbar and dock, with live component previews, syntax-highlighted code, and LHCI coverage on all new routes.

**Architecture:** `@next/mdx` with Turbopack (confirmed compatible via spike). MDX pages are RSC by default — zero client JS for page content. Two tiny client islands: `Sidebar.client.tsx` (~1KB, active-link highlight) and `CopyButton.client.tsx` (~600B, clipboard). `Preview` source injection via a custom recma plugin at ESTree level. `rehype-pretty-code` + shiki for build-time syntax highlighting. All plugins are referenced as string-tuple `['name', { opts }]` in `next.config.ts` — not as imported function refs (Turbopack serialization requirement).

**Tech Stack:** Next.js 16 App Router, @next/mdx (exact-pinned), rehype-pretty-code (exact-pinned), shiki (exact-pinned), @types/mdx, estree-util-to-js, estree-util-visit, Playwright, Vitest

---

## File Map

**Created:**
- `mdx-components.tsx` (project root — required for @next/mdx RSC compat)
- `lib/mdx/recma-preview-source.ts`
- `app/design-system/layout.tsx`
- `app/design-system/page.mdx`
- `app/design-system/tokens/page.mdx`
- `app/design-system/components/page.mdx`
- `app/design-system/enforcement/page.mdx`
- `app/design-system/changelog/page.mdx`
- `app/design-system/_components/Preview.tsx`
- `app/design-system/_components/Sidebar.client.tsx`
- `app/design-system/_components/CopyButton.client.tsx`
- `scripts/check-component-docs-coverage.mjs`
- `tests/e2e/design-system-pages.spec.ts`

**Modified:**
- `package.json` — add @next/mdx and related deps; add `check:component-docs` script
- `next.config.ts` — wrap with `createMDX`, add `pageExtensions`
- `components/responsive/DesktopTopbar.client.tsx` — add DESIGN_SYSTEM nav link
- `components/responsive/Dock.client.tsx` — add 6th icon slot
- `app/sitemap.ts` — add 5 new URLs
- `public/llms.txt` — add `/design-system` section
- `lighthouserc.json` — add 5 new routes
- `lighthouserc.mobile.json` — add 5 new routes
- `.github/workflows/ci.yml` — add component-docs coverage gate
- `tests/a11y/axe.spec.ts` — extend to all 5 new routes
- `DECISIONS.md`, `ARCHITECTURE.md` — ADR entries

---

## Task 1: Install MDX dependencies and configure next.config.ts

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`
- Create: `mdx-components.tsx`

- [ ] **Step 1: Install exact-pinned MDX packages**

```bash
pnpm add -E @next/mdx @mdx-js/loader @mdx-js/react rehype-pretty-code shiki
pnpm add -DE @types/mdx
```

Expected: All packages added without version ranges (no `^` or `~`).

- [ ] **Step 2: Verify exact pins**

```bash
grep -E "@next/mdx|@mdx-js|rehype-pretty-code|shiki" package.json
```

Expected: All four without caret/tilde prefixes.

- [ ] **Step 3: Create `mdx-components.tsx` at project root**

This file is required to prevent `@mdx-js/react` from calling `React.createContext` in RSC production bundles, which throws because context is a client-only API.

```typescript
// mdx-components.tsx
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
```

- [ ] **Step 4: Update `next.config.ts` to add MDX support**

```typescript
import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const withMDX = createMDX({
  options: {
    // All plugins MUST be string-tuple refs — Turbopack serialization requirement.
    // Do NOT use imported function references here.
    rehypePlugins: [
      ['rehype-pretty-code', { theme: 'github-dark-dimmed' }],
    ],
    recmaPlugins: [
      ['./lib/mdx/recma-preview-source', {}],
    ],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  cacheComponents: true,
  typedRoutes: true,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};

export default analyze(withMDX(nextConfig));
```

- [ ] **Step 5: Verify the build still works before writing any MDX files**

```bash
pnpm build
```

Expected: Build succeeds. No MDX-related errors (no MDX pages exist yet, so pageExtensions change is a no-op).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts mdx-components.tsx
git commit -m "feat(design-system): install @next/mdx + configure Turbopack MDX pipeline"
```

---

## Task 2: Write the recma-preview-source plugin

**Files:**
- Create: `lib/mdx/recma-preview-source.ts`

This plugin runs at the ESTree (compiled JS AST) level. It finds `<Preview>` JSX elements, serializes their children to a source string, and injects it as a `source` prop. This makes the live render and the code display share a single authored source — drift is impossible.

- [ ] **Step 1: Check that estree-util-to-js is available (transitive dep)**

```bash
node -e "import('estree-util-to-js').then(() => console.log('ok'))"
```

Expected: `ok`. If not, run `pnpm add -E estree-util-to-js estree-util-visit`.

- [ ] **Step 2: Write `lib/mdx/recma-preview-source.ts`**

```typescript
// lib/mdx/recma-preview-source.ts
// Recma plugin (ESTree level) — injects `source` prop into <Preview> elements.
// Must be referenced by path string in next.config.ts (Turbopack requirement).
import { toJs } from 'estree-util-to-js';
import { visit } from 'estree-util-visit';
import type { Program } from 'estree';

export default function recmaPreviewSource() {
  return (tree: Program) => {
    visit(tree, (node) => {
      if (node.type !== 'JSXElement') return;
      const el = node as unknown as {
        openingElement: {
          name: { name?: string };
          attributes: unknown[];
        };
        children: unknown[];
      };
      if (el.openingElement.name.name !== 'Preview') return;

      // Serialize children back to JSX source string
      const childSource = el.children
        .map((child) => {
          try {
            return toJs(child as Parameters<typeof toJs>[0]).value.trim();
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\n');

      // Inject as a string `source` prop
      el.openingElement.attributes.push({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name: 'source' },
        value: { type: 'Literal', value: childSource },
      });
    });
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/mdx/recma-preview-source.ts
git commit -m "feat(design-system): add recma-preview-source plugin for Preview component"
```

---

## Task 3: Design-system layout and shared components

**Files:**
- Create: `app/design-system/layout.tsx`
- Create: `app/design-system/_components/Sidebar.client.tsx`
- Create: `app/design-system/_components/CopyButton.client.tsx`
- Create: `app/design-system/_components/Preview.tsx`

- [ ] **Step 1: Write `app/design-system/_components/Sidebar.client.tsx`**

```typescript
'use client';
// ~1KB gzipped. Active-link highlight using pathname.
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

const LINKS = [
  { href: '/design-system', label: 'OVERVIEW' },
  { href: '/design-system/tokens', label: 'TOKENS' },
  { href: '/design-system/components', label: 'COMPONENTS' },
  { href: '/design-system/enforcement', label: 'ENFORCEMENT' },
  { href: '/design-system/changelog', label: 'CHANGELOG' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Design system" className={styles.root}>
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className={pathname === href ? styles.active : styles.link}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
```

Create `app/design-system/_components/Sidebar.module.css`:

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--ds-space-pad);
  border-right: 1px solid var(--ds-color-signal-subtle);
  min-width: 180px;
}

.link,
.active {
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-xs);
  letter-spacing: 0.1em;
  padding: 6px 10px;
  color: var(--ds-color-text-muted);
  text-decoration: none;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.active {
  color: var(--ds-color-signal);
  border-color: var(--ds-color-signal-subtle);
}

.link:hover {
  color: var(--ds-color-text-body);
}

@media (max-width: 768px) {
  .root {
    flex-direction: row;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid var(--ds-color-signal-subtle);
    min-width: 0;
    padding: var(--ds-space-pad-tight);
  }
}
```

- [ ] **Step 2: Write `app/design-system/_components/CopyButton.client.tsx`**

```typescript
'use client';
// ~600B gzipped. Hidden by default; revealed on hydration.
import { useState } from 'react';
import styles from './CopyButton.module.css';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className={styles.root}
      onClick={copy}
      aria-label="Copy code"
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}
```

Create `app/design-system/_components/CopyButton.module.css`:

```css
.root {
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-xs);
  letter-spacing: 0.1em;
  color: var(--ds-color-text-muted);
  background: transparent;
  border: 1px solid var(--ds-color-signal-subtle);
  padding: 2px 8px;
  cursor: pointer;
}

.root:hover {
  color: var(--ds-color-signal);
}
```

- [ ] **Step 3: Write `app/design-system/_components/Preview.tsx`**

This is an RSC component. It receives `source` (injected by the recma plugin) and `children` (the live render).

```typescript
// app/design-system/_components/Preview.tsx
import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';
import styles from './Preview.module.css';

type PreviewProps = {
  source?: string; // injected by recma-preview-source plugin
  children: ReactNode;
};

export function Preview({ source, children }: PreviewProps) {
  return (
    <TerminalPanel className={styles.root}>
      <div className={styles.live}>{children}</div>
      {source && (
        <details className={styles.sourceToggle}>
          <summary className={styles.summary}>VIEW SOURCE</summary>
          <pre className={styles.source} tabIndex={0} role="region" aria-label="Code sample">
            <code>{source}</code>
          </pre>
        </details>
      )}
    </TerminalPanel>
  );
}
```

Create `app/design-system/_components/Preview.module.css`:

```css
.root {
  margin: var(--ds-space-4) 0;
}

.live {
  padding: var(--ds-space-pad);
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-3);
  align-items: flex-start;
}

.sourceToggle {
  border-top: 1px solid var(--ds-color-signal-subtle);
}

.summary {
  padding: 6px var(--ds-space-pad);
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-xs);
  letter-spacing: 0.1em;
  color: var(--ds-color-text-muted);
  cursor: pointer;
  list-style: none;
  text-transform: uppercase;
}

.summary:hover {
  color: var(--ds-color-signal);
}

.source {
  margin: 0;
  padding: var(--ds-space-4) var(--ds-space-pad);
  overflow-x: auto;
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-body);
  border-top: 1px dashed var(--ds-color-signal-subtle);
}
```

- [ ] **Step 4: Write `app/design-system/layout.tsx`**

```typescript
// app/design-system/layout.tsx
import type { ReactNode } from 'react';
import { Sidebar } from './_components/Sidebar.client';
import styles from './layout.module.css';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <Sidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
```

Create `app/design-system/layout.module.css`:

```css
.root {
  display: flex;
  min-height: 100vh;
  max-width: var(--ds-layout-maxw);
  margin: 0 auto;
  padding-top: 44px; /* desktop topbar height */
}

.content {
  flex: 1;
  padding: var(--ds-space-pad);
  max-width: 720px;
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .root {
    flex-direction: column;
    padding-top: 0;
  }
}
```

- [ ] **Step 5: Commit all layout/component files**

```bash
git add app/design-system/layout.tsx app/design-system/layout.module.css
git add app/design-system/_components/
git commit -m "feat(design-system): add layout, Sidebar, CopyButton, Preview components"
```

---

## Task 4: Register Preview in mdx-components.tsx

The `<Preview>` component must be available in all MDX files without explicit imports.

- [ ] **Step 1: Update `mdx-components.tsx`**

```typescript
// mdx-components.tsx
import type { MDXComponents } from 'mdx/types';
import { Preview } from './app/design-system/_components/Preview';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Preview,
    ...components,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add mdx-components.tsx
git commit -m "feat(design-system): register Preview in MDX component map"
```

---

## Task 5: Write the five MDX pages

**Files:**
- Create: `app/design-system/page.mdx`
- Create: `app/design-system/tokens/page.mdx`
- Create: `app/design-system/components/page.mdx`
- Create: `app/design-system/enforcement/page.mdx`
- Create: `app/design-system/changelog/page.mdx`

- [ ] **Step 1: Write `app/design-system/page.mdx` (landing)**

```mdx
export const metadata = {
  title: 'Design System — erikunha.dev',
  description: 'Two-tier token pipeline, 7 primitives, and enforcement docs for erikunha.dev',
  robots: 'index, follow',
};

# DESIGN SYSTEM

A published design system for erikunha.dev — positioned at `/design-system` as part of the Staff/Principal frontend hiring artifact.

## What's here

| Section | Purpose |
|---|---|
| [Tokens](/design-system/tokens) | Color palette, type scale, spacing, motion, layers |
| [Components](/design-system/components) | 7 primitive components with live previews |
| [Enforcement](/design-system/enforcement) | Lint rules, CI gates, contributing guide |
| [Changelog](/design-system/changelog) | Token and component change log |

## Principles

**Semantic over primitive.** CSS always references semantic tokens (`--ds-color-signal`), never primitives (`--ds-green-500`). The semantic layer enables theme variants without component churn.

**RSC by default.** All 7 primitives are React Server Components — zero client JavaScript unless a component explicitly needs it (none do in v1).

**Enforced, not documented.** Boundary lint, no-magic-values lint, and contrast check run in CI. The rules don't rely on developer discipline.
```

- [ ] **Step 2: Write `app/design-system/tokens/page.mdx`**

```mdx
export const metadata = {
  title: 'Tokens — Design System — erikunha.dev',
  description: 'Color palette, type scale, spacing, motion, and layer tokens',
};

# TOKENS

## Color

### Signal (brand green)

| Token | Value | Usage |
|---|---|---|
| `--ds-color-signal` | #00FF41 | Headings, accents, interactive elements |
| `--ds-color-signal-subtle` | rgba(0,255,65,0.4) | Borders, dividers |
| `--ds-color-signal-quiet` | rgba(0,255,65,0.1) | Hover backgrounds |
| `--ds-color-signal-faint` | rgba(0,255,65,0.12) | Very subtle backgrounds |

### Text

| Token | Value | Usage |
|---|---|---|
| `--ds-color-text-body` | #E6FFE6 | Body text (13:1+ contrast on black) |
| `--ds-color-text-muted` | rgba(0,255,65,0.4) | Secondary text, labels |
| `--ds-color-text-faint` | #5AE07B | Annotations, gutters |

### Surface

| Token | Value | Usage |
|---|---|---|
| `--ds-color-surface-base` | #000000 | Page background |
| `--ds-color-surface-shell` | #050505 | Shell/terminal backgrounds |

### Feedback

| Token | Value | Usage |
|---|---|---|
| `--ds-color-feedback-error` | #ff8a8a | Error states, validation messages |
| `--ds-color-accent-warm` | #ffd86b | Warm syntax highlight accents |
| `--ds-color-accent-cool` | #7fe4ff | Cool syntax highlight accents |

## Type Scale

| Token | Value |
|---|---|
| `--ds-font-size-2xs` | 9px |
| `--ds-font-size-xs` | 11px |
| `--ds-font-size-sm` | 12px |
| `--ds-font-size-body` | 14px |
| `--ds-font-size-md` | 16px |
| `--ds-font-size-heading-sm` | 22px |
| `--ds-font-size-heading-md` | 32px |
| `--ds-font-size-heading-lg` | 48px |
| `--ds-font-size-heading-xl` | 78px |

## Spacing

| Token | Value | Usage |
|---|---|---|
| `--ds-space-pad` | 24px | Standard section padding |
| `--ds-space-pad-tight` | 12px | Mobile padding |
| `--ds-space-rhythm` | 64px | Vertical section rhythm |
| `--ds-space-rhythm-tight` | 16px | Mobile rhythm |

## Motion

| Token | Value |
|---|---|
| `--ds-duration-fast` | 80ms |
| `--ds-duration-base` | 200ms |
| `--ds-duration-slow` | 300ms |

All motion tokens are suppressed under `prefers-reduced-motion: reduce`.

## Layers

| Token | Value |
|---|---|
| `--ds-layer-base` | 0 |
| `--ds-layer-sticky` | 50 |
| `--ds-layer-overlay` | 100 |
| `--ds-layer-headline` | 150 |
```

- [ ] **Step 3: Write `app/design-system/components/page.mdx`**

The `## ComponentName` headings are required — `check:component-docs` script validates that every directory in `design-system/components/` has a matching `##` heading here.

```mdx
export const metadata = {
  title: 'Components — Design System — erikunha.dev',
  description: '7 primitive RSC components for erikunha.dev',
};

# COMPONENTS

All 7 primitives are React Server Components. Zero client JavaScript.

## Button

**Props:** `variant: 'primary' | 'secondary'`, `size: 'sm' | 'md' | 'lg'`, `as: 'button' | 'a'`

<Preview>
  <Button variant="primary" as="a" href="#">EXEC_HIRE</Button>
  <Button variant="secondary" as="a" href="#">DOWNLOAD_CV</Button>
  <Button variant="primary" size="sm" as="a" href="#">SM</Button>
  <Button variant="secondary" size="lg" as="a" href="#">LG</Button>
</Preview>

**Accessibility:** 44px touch target on md size. `focus-visible` outline using `--ds-color-signal`. Disabled anchors use `aria-disabled="true"` (anchors can't be natively disabled).

## Field

**Props:** `name`, `label`, `multiline?: boolean`, `rows?: number`, `error?: string`

<Preview>
  <Field name="email" label="$ email:" type="email" />
  <Field name="msg" label="$ message:" multiline rows={3} />
  <Field name="broken" label="$ broken:" error="Required field" />
</Preview>

**Accessibility:** Label always rendered and programmatically associated. `aria-describedby` points to error text. `aria-invalid="true"` set on error state.

## Badge

**Props:** `variant: 'default' | 'dot'`, `size: 'sm' | 'md'`

<Preview>
  <Badge variant="dot">OPEN_TO_WORK</Badge>
  <Badge variant="default">AVAILABLE</Badge>
  <Badge size="sm">SMALL</Badge>
</Preview>

**Accessibility:** Dot is `aria-hidden`. Pulse animation suppressed under `prefers-reduced-motion`.

## TerminalPanel

**Props:** `borderStyle: 'solid' | 'dashed'`, `as: 'div' | 'section' | 'article'`, `header?: ReactNode`

<Preview>
  <TerminalPanel header="[ STATUS ]" style={{ width: '200px' }}>
    Content here.
  </TerminalPanel>
  <TerminalPanel borderStyle="dashed" style={{ width: '200px' }}>
    Dashed panel.
  </TerminalPanel>
</Preview>

## StatTile

**Props:** `value: string`, `label: string`, `variant: 'default' | 'compact'`

<Preview>
  <StatTile value="99" label="LH_SCORE" />
  <StatTile value="5+" label="YRS_EXP" />
  <StatTile value="1.2s" label="LCP" variant="compact" />
</Preview>

**Accessibility:** Rendered as `<dl><dt>{label}</dt><dd>{value}</dd></dl>` — screen readers announce "label: value".

## CmdLine

**Props:** `user?: string`, `command: string`, `output?: ReactNode`, `prompt?: string`

<Preview>
  <CmdLine command="cat README.md" />
  <CmdLine user="root@prod" prompt="#" command="whoami" output={<span>root</span>} />
</Preview>

## KbdKey

**Props:** `size: 'sm' | 'md'`

<Preview>
  <KbdKey>Ctrl</KbdKey>
  <KbdKey>+</KbdKey>
  <KbdKey>K</KbdKey>
  <KbdKey size="sm">Enter</KbdKey>
</Preview>

**Accessibility:** Uses semantic `<kbd>` element.

---

## Composition Patterns

### Stat grid using StatTile

Four `StatTile` components arranged in a CSS grid. The grid layout stays in the consumer (not a primitive).

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid var(--ds-color-signal-subtle)' }}>
  <StatTile value="99" label="LH_SCORE" />
  <StatTile value="5+" label="YRS_EXP" />
  <StatTile value="1.2s" label="LCP" />
  <StatTile value="0" label="CLS" />
</div>
```
```

- [ ] **Step 4: Write `app/design-system/enforcement/page.mdx`**

```mdx
export const metadata = {
  title: 'Enforcement — Design System — erikunha.dev',
  description: 'Lint rules and CI gates enforcing the design token system',
};

# ENFORCEMENT

The design system is enforced in CI — rules are not documentation, they are gates.

## CI Gates (PR A)

Four new steps run in `build-and-gate` before the build:

| Gate | Script | What it checks |
|---|---|---|
| Token build | `pnpm tokens:build` | Style Dictionary builds without error |
| Token drift | `pnpm tokens:check` | `design-system/dist/` matches source JSON |
| Boundary lint | `pnpm lint:token-boundary` | No primitive refs in component CSS |
| No-magic-values | `pnpm lint:no-magic-values` | No raw hex/px/ms/z-index in module CSS |
| Contrast | `pnpm lint:contrast` | All WCAG AA pairs pass |

## Token Boundary Lint

**File:** `scripts/lint-token-boundary.mjs`

Rejects any `.module.css` file that uses a CSS primitive var when a semantic alias exists.

**Forbidden (primitives with semantic aliases):**
- `var(--ds-green-NNN)` → use `var(--ds-color-signal)` (or other signal alias)
- `var(--ds-text-NNN)` (digit suffix) → use `var(--ds-color-text-*)`
- `var(--ds-space-NNN)` (digit suffix) → use `var(--ds-space-pad)` or `--ds-space-rhythm`
- `var(--ds-text-size-*)` → use `var(--ds-font-size-*)`

**Allowed (no semantic layer exists):**
- `var(--ds-duration-*)`, `var(--ds-ease-*)`, `var(--ds-layer-*)`, `var(--ds-radius-*)`, `var(--ds-border-*)`, `var(--ds-chrome-*)`

## No-Magic-Values Lint

**File:** `scripts/lint-no-magic-values.mjs`

Rejects raw values that should be token references:
- Hex colors (`#rrggbb`) — use `var(--ds-color-*)`
- Raw `px` values outside the allowlist — use spacing tokens
- Raw `ms`/`s` durations — use `var(--ds-duration-*)`
- Raw `z-index` integers — use `var(--ds-layer-*)`

Exceptions are documented in `scripts/lint-no-magic-values.allowlist.json`.

## Naming Convention

**Primitives MUST NOT use the `--ds-color-` prefix.** That prefix is reserved for semantic tokens. The boundary lint allowlist `var(--ds-color-*)` works correctly only if this convention holds.

## Adding a New Component

1. Create `design-system/components/NewComponent/` with 4 files (`.tsx`, `.module.css`, `.test.tsx`, `index.ts`)
2. Export from `design-system/index.ts`
3. Use only semantic tokens in `.module.css` — boundary lint will fail otherwise
4. Add `## NewComponent` heading in `app/design-system/components/page.mdx` — the `check:component-docs` gate will fail if missing
5. Write Playwright visual baseline in `tests/e2e/design-system-components.spec.ts`
```

- [ ] **Step 5: Write `app/design-system/changelog/page.mdx`**

```mdx
export const metadata = {
  title: 'Changelog — Design System — erikunha.dev',
  description: 'Design system token and component changelog',
};

# CHANGELOG

## 2026-05-23 — Initial release (v1)

### Token Pipeline (PR A)
- Two-tier token architecture: 6 JSON source files, Style Dictionary build
- 15 color primitives, 14 semantic color tokens, 14 space/typography/motion tokens
- Added: `--ds-chrome-close/minimize/maximize` (macOS traffic-light dots, no semantic layer)
- Migrated 31 `.module.css` files from legacy `--signal/--fg/--pad` names
- 5 new CI gates: token build, drift, boundary lint, no-magic-values, contrast

### Components (PR B)
- Added: Button (primary/secondary, sm/md/lg, polymorphic as button|a)
- Added: Field (text/multiline, label association, error state)
- Added: Badge (default/dot variants, pulse animation)
- Added: TerminalPanel (solid/dashed borders, polymorphic as div|section|article)
- Added: StatTile (default/compact, semantic dl/dt/dd markup)
- Added: CmdLine (user/prompt/command/output)
- Added: KbdKey (sm/md, semantic kbd element)

### Docs (PR C)
- Added: `/design-system` documentation route (5 pages)
- Added: Live component previews with auto-injected source display
- Added: Sidebar navigation (desktop) / collapsible nav (mobile)
- Added: LHCI coverage for all 5 new routes
```

- [ ] **Step 6: Run build to verify all MDX pages compile**

```bash
pnpm build
```

Expected: Build succeeds. Next.js reports `/design-system`, `/design-system/tokens`, `/design-system/components`, `/design-system/enforcement`, `/design-system/changelog` as static routes.

- [ ] **Step 7: Commit all MDX pages**

```bash
git add app/design-system/
git commit -m "feat(design-system): add 5 MDX documentation pages"
```

---

## Task 6: Add component imports to mdx-components.tsx

MDX pages reference design-system components (`<Button>`, `<Field>`, etc.) without imports. Register them all in the global component map.

- [ ] **Step 1: Update `mdx-components.tsx`**

```typescript
// mdx-components.tsx
import type { MDXComponents } from 'mdx/types';
import { Badge, Button, CmdLine, Field, KbdKey, StatTile, TerminalPanel } from './design-system';
import { Preview } from './app/design-system/_components/Preview';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Preview,
    Button,
    Field,
    Badge,
    TerminalPanel,
    StatTile,
    CmdLine,
    KbdKey,
    ...components,
  };
}
```

- [ ] **Step 2: Run build and verify no "component not found" errors**

```bash
pnpm build 2>&1 | grep -i "error\|undefined\|not found" | head -20
```

Expected: No such errors.

- [ ] **Step 3: Commit**

```bash
git add mdx-components.tsx
git commit -m "feat(design-system): register all primitives in MDX component map"
```

---

## Task 7: Add nav links (DesktopTopbar + Dock)

**Files:**
- Modify: `components/responsive/DesktopTopbar.client.tsx`
- Modify: `components/responsive/Dock.client.tsx`

- [ ] **Step 1: Add DESIGN_SYSTEM link to DesktopTopbar**

In `DesktopTopbar.client.tsx`, find the `<nav className={styles.nav}>` block. Add after the last `<a className={styles.navlink}>`:

```tsx
<a className={styles.navlink} href="/design-system">
  DESIGN_SYSTEM
</a>
```

- [ ] **Step 2: Add 6th slot to Dock**

In `Dock.client.tsx`, add to the `ITEMS` array:

```typescript
{
  label: 'DS',
  href: '/design-system',
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="8" />
      <rect x="3" y="13" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </svg>
  ),
},
```

Note: The Dock currently uses `scrollIntoView` for same-page nav. The design-system link is a page navigation (`href="/design-system"`). Update the `onJump` handler to only intercept `#`-prefixed hrefs:

```typescript
const onJump = (target: string, href: string) => (e: React.MouseEvent) => {
  if (!href.startsWith('#')) return; // allow normal navigation
  e.preventDefault();
  // ... existing scroll logic
};
```

Also update `Dock.module.css` to change `grid-template-columns` from `repeat(5, 1fr)` to `repeat(6, 1fr)`.

- [ ] **Step 3: Run build and verify no TypeScript errors**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add components/responsive/DesktopTopbar.client.tsx components/responsive/Dock.client.tsx components/responsive/Dock.module.css
git commit -m "feat(design-system): add nav links to topbar and dock"
```

---

## Task 8: Update sitemap.ts and llms.txt

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `public/llms.txt`

- [ ] **Step 1: Update `app/sitemap.ts`**

```typescript
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://erikunha.dev';
  const dsDate = new Date('2026-05-23');

  return [
    {
      url: base,
      lastModified: process.env.CONTENT_UPDATED_AT
        ? new Date(process.env.CONTENT_UPDATED_AT)
        : new Date('2026-05-22'),
      changeFrequency: 'monthly',
      priority: 1,
    },
    { url: `${base}/design-system`, lastModified: dsDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/design-system/tokens`, lastModified: dsDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/design-system/components`, lastModified: dsDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/design-system/enforcement`, lastModified: dsDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/design-system/changelog`, lastModified: dsDate, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
```

- [ ] **Step 2: Add design-system section to `public/llms.txt`**

Append to the end of `public/llms.txt`:

```
## Design System

Published design system at /design-system. Covers:
- Two-tier token pipeline (JSON → CSS custom properties via Style Dictionary)
- 7 RSC primitive components (Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey)
- Enforcement: boundary lint, no-magic-values lint, contrast check, all in CI
- Docs: /design-system/tokens, /design-system/components, /design-system/enforcement, /design-system/changelog
```

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts public/llms.txt
git commit -m "feat(design-system): update sitemap and llms.txt for 5 new routes"
```

---

## Task 9: Add LHCI coverage for all 5 new routes

**Files:**
- Modify: `lighthouserc.json`
- Modify: `lighthouserc.mobile.json`

- [ ] **Step 1: Update `lighthouserc.json`**

In the `"url"` array under `"collect"`, add the 5 new routes alongside `http://localhost:3000`:

```json
"url": [
  "http://localhost:3000",
  "http://localhost:3000/design-system",
  "http://localhost:3000/design-system/tokens",
  "http://localhost:3000/design-system/components",
  "http://localhost:3000/design-system/enforcement",
  "http://localhost:3000/design-system/changelog"
]
```

- [ ] **Step 2: Make the same change to `lighthouserc.mobile.json`**

- [ ] **Step 3: Commit**

```bash
git add lighthouserc.json lighthouserc.mobile.json
git commit -m "ci: extend LHCI coverage to 5 design-system routes"
```

---

## Task 10: Extend a11y scan to new routes

**Files:**
- Modify: `tests/a11y/axe.spec.ts`

- [ ] **Step 1: Add design-system routes to the axe scan**

Read the current `tests/a11y/axe.spec.ts` to find the URL list, then add:

```typescript
'/design-system',
'/design-system/tokens',
'/design-system/components',
'/design-system/enforcement',
'/design-system/changelog',
```

- [ ] **Step 2: Run the axe scan locally to verify no new a11y violations**

```bash
pnpm build && pnpm start &
sleep 5
pnpm playwright test tests/a11y --project=chromium
kill %1
```

Expected: All routes pass. Fix any violations before committing.

- [ ] **Step 3: Commit**

```bash
git add tests/a11y/axe.spec.ts
git commit -m "test(a11y): extend axe scan to design-system routes"
```

---

## Task 11: Add component-docs coverage gate

**Files:**
- Create: `scripts/check-component-docs-coverage.mjs`

Fails if any directory in `design-system/components/` lacks a corresponding `## ComponentName` heading in `app/design-system/components/page.mdx`.

- [ ] **Step 1: Write `scripts/check-component-docs-coverage.mjs`**

```javascript
#!/usr/bin/env node
// Verifies every component in design-system/components/ has a ## heading
// in app/design-system/components/page.mdx.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(ROOT, 'design-system/components');
const docsPage = path.join(ROOT, 'app/design-system/components/page.mdx');

const componentNames = readdirSync(componentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const docsContent = readFileSync(docsPage, 'utf8');
let missing = 0;

for (const name of componentNames) {
  if (!docsContent.includes(`## ${name}`)) {
    console.error(`MISSING DOCS: ${name} has no "## ${name}" heading in components/page.mdx`);
    missing++;
  }
}

if (missing > 0) {
  console.error(`\n${missing} component(s) missing documentation.`);
  process.exit(1);
}
console.log(`Component docs coverage OK (${componentNames.length} components).`);
```

- [ ] **Step 2: Run and verify it passes**

```bash
node scripts/check-component-docs-coverage.mjs
```

Expected: `Component docs coverage OK (7 components).`

- [ ] **Step 3: Add to package.json and CI**

In `package.json`: `"check:component-docs": "node scripts/check-component-docs-coverage.mjs"`

In `.github/workflows/ci.yml`, add after `Dependency-pinning gate`:

```yaml
      - name: Component docs coverage
        run: pnpm check:component-docs
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-component-docs-coverage.mjs package.json .github/workflows/ci.yml
git commit -m "ci: add component-docs coverage gate"
```

---

## Task 12: Write E2E smoke tests for design-system pages

**Files:**
- Create: `tests/e2e/design-system-pages.spec.ts`
- Activate: `tests/e2e/design-system-components.spec.ts` (remove `.skip` added in PR B)

- [ ] **Step 1: Write `tests/e2e/design-system-pages.spec.ts`**

```typescript
import { expect, test } from '@playwright/test';

const DS_ROUTES = [
  { path: '/design-system', heading: 'DESIGN SYSTEM' },
  { path: '/design-system/tokens', heading: 'TOKENS' },
  { path: '/design-system/components', heading: 'COMPONENTS' },
  { path: '/design-system/enforcement', heading: 'ENFORCEMENT' },
  { path: '/design-system/changelog', heading: 'CHANGELOG' },
];

for (const { path, heading } of DS_ROUTES) {
  test(`${path} — renders heading and sidebar nav`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Design system' })).toBeVisible();
  });
}

test('Preview component renders live and source', async ({ page }) => {
  await page.goto('/design-system/components');
  // Button preview is the first Preview on the components page
  const preview = page.locator('[class*="preview"]').first();
  await expect(preview).toBeVisible();
  // View source disclosure
  const summary = page.getByText('VIEW SOURCE').first();
  await expect(summary).toBeVisible();
});

test('CopyButton appears after hydration (Chromium only)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.goto('/design-system/enforcement');
  // CopyButton is lazy-hydrated — wait for it
  await page.waitForSelector('[aria-label="Copy code"]', { timeout: 5000 });
  await page.click('[aria-label="Copy code"]');
  await expect(page.getByText('COPIED')).toBeVisible();
});
```

- [ ] **Step 2: Remove `.skip` from design-system-components.spec.ts**

In `tests/e2e/design-system-components.spec.ts`, delete the `test.skip(...)` line and uncomment the visual tests.

- [ ] **Step 3: Run functional E2E tests**

```bash
pnpm build && pnpm start &
sleep 5
pnpm playwright test tests/e2e/design-system-pages.spec.ts --project=chromium
kill %1
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/design-system-pages.spec.ts tests/e2e/design-system-components.spec.ts
git commit -m "test(e2e): add design-system page smoke tests + activate component visuals"
```

---

## Task 13: Update docs and run final verification

**Files:**
- Modify: `DECISIONS.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Add ADR entry to DECISIONS.md**

```
- 2026-05-23: Shipped /design-system MDX docs route (PR C). @next/mdx + Turbopack (WORKS — mdx-components.tsx required; plugins as string tuples). Preview source injection via recma plugin (ESTree level). Sidebar: native details on mobile, client island (~1KB) on desktop. Lighthouse and axe coverage extended to 5 new routes.
```

- [ ] **Step 2: Run full CI gate locally**

```bash
pnpm ci:local
```

Expected: All gates pass.

- [ ] **Step 3: Run full build**

```bash
pnpm build
```

Expected: `/design-system/*` routes appear in build output as static SSG pages.

- [ ] **Step 4: Regenerate Playwright visual baselines**

```bash
pnpm build && pnpm start &
sleep 5
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium-mobile
pnpm playwright test tests/e2e/design-system-components.spec.ts --update-snapshots --project=chromium
kill %1
```

- [ ] **Step 5: Commit docs and baselines**

```bash
git add DECISIONS.md ARCHITECTURE.md
git add tests/e2e/visual.spec.ts-snapshots/ tests/e2e/design-system-components.spec.ts-snapshots/
git commit -m "docs: update ADR for PR C; regenerate visual baselines"
```

---

## Self-Review Checklist (run before opening PR)

- [ ] `pnpm ci:local` passes
- [ ] `pnpm build` succeeds with all 5 design-system routes as SSG
- [ ] `pnpm check:component-docs` passes (7 components, 7 headings)
- [ ] All Playwright a11y scans pass on new routes
- [ ] Lighthouse a11y = 100 on all 5 new routes
- [ ] Client JS on `/` route unchanged (bundle-check confirms)
- [ ] `/design-system` linked from desktop topbar and mobile dock
- [ ] `sitemap.ts` includes all 5 new URLs
- [ ] `llms.txt` has design-system section
- [ ] Visual baselines regenerated and committed
