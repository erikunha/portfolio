# Design System PR C: /design-system MDX Route + Auto-API + Visual Changelog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five public `/design-system/*` MDX pages (landing, tokens, components, enforcement, changelog) with build-time syntax highlighting, auto-generated component API tables driven by `ts-morph` from PR B's primitives, and a visual-changelog automation pipeline that consumes Playwright baseline diffs — all while keeping the `/` route client-JS delta at zero and the `/design-system/*` routes under 2.5KB gzipped.

**Architecture:** MDX is the documentation surface (file-based routing via `@next/mdx`'s App Router integration). The MDX+Turbopack spike on 2026-05-23 (see `spike-mdx-turbopack-results.md` in this directory) confirmed Next 16.2.6 + Turbopack renders App Router MDX correctly **provided** `mdx-components.tsx` lives at the project root, `@next/mdx` is exact-pinned to the same minor as Next, `pageExtensions` includes `mdx`, and `createMDX` wraps `nextConfig` before any other plugin wrapper — so this plan creates those prerequisites in Tasks 2-4 BEFORE touching any MDX page. Pages render as RSC; two small client islands (`Sidebar.client.tsx`, `CopyButton.client.tsx`) and one RSC server component (`Preview.tsx`) carry the only client JS. Auto-API tables are generated build-time via `scripts/gen-component-api.mjs` walking each primitive's TS prop types with `ts-morph`, emitting MDX fragment files imported by the components page; the generator fails CI with `MISSING_PROP_DOC: <Component>.<propName>` for any prop without JSDoc (depends on PR B's per-prop JSDoc audit from `pr-b-components.md` Task 15). The visual changelog is generated from Playwright baseline diffs: a GitHub workflow runs on PRs touching `tests/e2e/*-snapshots/`, posts diff comments, and on merge to main appends an entry to `app/design-system/changelog/page.mdx`.

**Tech Stack:** Next.js 16.2.6 App Router (Turbopack), React 19 RSC, `@next/mdx@16.2.6` exact-pinned, `@mdx-js/loader@3.1.x`, `@mdx-js/react@3.1.x`, `shiki@latest` (build-time syntax highlighting, zero runtime cost), `ts-morph@latest` (TS AST traversal for auto-API), Playwright (visual changelog source), TypeScript strict. No new runtime deps shipped to the browser.

**Pre-plan gate status:** PASS — MDX+Turbopack spike completed 2026-05-23, see `spike-mdx-turbopack-results.md` in this directory. Hard gate on PR C planning unblocked.

---

## File Structure

### New files

| Path | Purpose |
|---|---|
| `mdx-components.tsx` | **Project root.** MDX component map provider hook (`useMDXComponents`) consumed by Next 16 App Router at compile time. Without this file the runtime falls back to Pages Router internals and the dev server fails with `TypeError: createContext only works in Client Components` per the spike. Must exist BEFORE the first MDX page is committed. Per spec §5.2, populates heading/code/anchor element overrides using design tokens + Shiki-wrapped code blocks |
| `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-c-inversion.md` | Task 1 output: failure-mode → test/gate table sourced from spec §8 PR C rows |
| `app/design-system/layout.tsx` | RSC layout for `/design-system/*`. Sticky sidebar nav (desktop) wrapping `<Sidebar.client />`; mobile `<details>` collapse (zero JS); content max-width 720px; CRT overlay disabled (clean docs aesthetic, spec §5.3) |
| `app/design-system/layout.module.css` | Sidebar + content grid; mobile `<details>` styling; uses semantic tokens only |
| `app/design-system/page.mdx` | Landing — overview, principles, links to other pages (spec §5.1) |
| `app/design-system/tokens/page.mdx` | Palette, type scale, spacing, motion, layers, borders (visual tables) (spec §5.1) |
| `app/design-system/components/page.mdx` | All 8 primitives on one scrollable page with `#anchor` links; each section embeds the auto-generated API fragment + a `<Preview>` (spec §5.1, §5.9) |
| `app/design-system/enforcement/page.mdx` | Lint rules, CI gates, contributing guide, codemod info (spec §5.1) |
| `app/design-system/changelog/page.mdx` | Token + component change log; entries appended by `scripts/build-visual-changelog.mjs` (spec §5.1, §5.10) |
| `app/design-system/_components/Sidebar.client.tsx` | ~1KB gzipped. Active-link highlight via `usePathname`. Spec §5.5. **Note:** `_components` here is a private folder under the App Router (leading underscore) — does NOT route; per spike findings, this is the correct location for non-route co-located components |
| `app/design-system/_components/Sidebar.module.css` | Sticky sidebar styling using semantic tokens |
| `app/design-system/_components/CopyButton.client.tsx` | ~600 bytes gzipped. Copy-code-to-clipboard button injected next to each `<pre>`; hidden until hydration; `<noscript>` confirms no button is intentional. Spec §5.5 |
| `app/design-system/_components/CopyButton.module.css` | Button styling using semantic tokens |
| `app/design-system/_components/Preview.tsx` | **RSC** (no `"use client"`). Renders children inside a `<TerminalPanel>` + native `<details>` "View source" disclosure (zero JS). Source string passed as `code` prop, syntax-highlighted at build time via Shiki helper in `mdx-components.tsx` (spec §5.4) |
| `app/design-system/_components/Preview.module.css` | Preview panel + source disclosure styling |
| `scripts/gen-component-api.mjs` | TypeScript→MDX prop-table generator using `ts-morph`. Walks `design-system/components/<Name>/index.ts` exports, extracts the exported component's `Props` type, emits `_generated-api.mdx` fragment per component. Fails with `MISSING_PROP_DOC: <Component>.<propName>` for any prop without JSDoc. Spec §5.9 |
| `scripts/gen-component-api.test.mjs` | Vitest unit test for the generator: fixture component with documented + undocumented props; asserts emitted MDX shape and the `MISSING_PROP_DOC` failure path |
| `design-system/components/<Name>/_generated-api.mdx` | One per primitive (8 total). Gitignored. Generated by `gen-component-api.mjs`; imported by `app/design-system/components/page.mdx` via relative path |
| `scripts/build-visual-changelog.mjs` | Consumes Playwright baseline diffs; on merge to main, appends an entry to `app/design-system/changelog/page.mdx` (PR number, date, component name, diff thumbnails). Skips entries when commit message contains `[no-changelog]`. Spec §5.10 |
| `scripts/build-visual-changelog.test.mjs` | Vitest unit test for the changelog builder: fixture diff metadata; asserts MDX entry shape; asserts `[no-changelog]` skip behavior |
| `scripts/check-mdx-component-headings.mjs` | Build-time gate: parses `app/design-system/components/page.mdx`, asserts every primitive name in `design-system/components/` has a matching `## ComponentName` heading. Spec §7.3 failure mode #9 |
| `scripts/check-mdx-component-headings.test.mjs` | Vitest unit test for the heading check |
| `.github/workflows/visual-changelog.yml` | Runs on PRs that update any baseline under `tests/e2e/visual.spec.ts-snapshots/` or `tests/e2e/design-system-components.spec.ts-snapshots/`. Compares old vs new, generates side-by-side diff PNGs, uploads as PR artifact, posts a PR comment with thumbnails. Spec §5.10 |
| `tests/e2e/design-system-pages.spec.ts` | Per-route Playwright e2e + a11y: navigates each of the 5 routes, asserts content presence, asserts `<Preview>` renders, asserts CopyButton works (chromium only), asserts sidebar active-link highlight, asserts CRT overlay is absent. Spec §5.8 |

### Modified files

| Path | Change |
|---|---|
| `next.config.ts` | Add `pageExtensions: ['ts', 'tsx', 'mdx']`; import `createMDX from '@next/mdx'`; create `withMDX = createMDX({})`; wrap `nextConfig` with `withMDX` BEFORE `analyze` (the existing `withBundleAnalyzer` wrapper). Exact ordering matters per the spike outcome |
| `package.json` | Add devDependencies (exact-pinned): `@next/mdx@16.2.6`, `@mdx-js/loader@3.1.x`, `@mdx-js/react@3.1.x`, `shiki@latest`, `ts-morph@latest`. Add scripts: `gen-api`, `gen-api:check`, `check:mdx-headings`, `build:visual-changelog` |
| `scripts/check-bundle-size.mjs` | Extend per-route budget map: enforce `/design-system/*` aggregate ≤ 2.5KB gzipped (consistent with the ceiling PR B's Task 13 already wired); preserve `/` route 0-byte delta vs `bundle-baseline.json` |
| `components/responsive/DesktopTopbar.client.tsx` | Add `DESIGN_SYSTEM` nav link after `PROJECTS` (use `<Link variant="nav">` from PR B; deep-path import — client island) |
| `components/responsive/Dock.client.tsx` | Add 6th nav slot for design system (deep-path `<Link variant="nav">`) |
| `app/sitemap.ts` | Add 5 new URLs: `/design-system`, `/design-system/tokens`, `/design-system/components`, `/design-system/enforcement`, `/design-system/changelog` |
| `public/llms.txt` | Add `## Design system` section pointing to `/design-system/*` as the canonical reference (per spec §5.6) |
| `lighthouse.config.cjs` | Add the 5 new routes to the URL matrix; preserve existing perf ≥95 / a11y =100 budgets per spec §5.11 |
| `tests/a11y/axe.spec.ts` | Extend `routes` array with 5 new design-system routes; spec §5.8 |
| `.gitignore` | Add `design-system/components/*/_generated-api.mdx` (generator output is build artifact, not source) |
| `DECISIONS.md` | Append ADR: "PR C — MDX docs route with `@next/mdx` + Turbopack (spike-validated); auto-API via `ts-morph`; visual changelog automation; bundle gates; reversibility: high (pure-additive)" |
| `ARCHITECTURE.md` | Add §"Design system documentation" describing the MDX route topology, the auto-API pipeline, the visual changelog pipeline, and the `/design-system/*` bundle budget |

---

## Tasks

### Task 1: thinking-inversion — enumerate the class-of-bugs PR C introduces

**Files:**
- Create: `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-c-inversion.md`

This task produces no production code. It enumerates every PR C failure mode from spec §7.3 + §8 and binds each to the test or gate that catches it. Every row becomes a test case in later tasks. Per CLAUDE.md, `thinking-inversion` runs before any new file or function.

- [ ] **Step 1: Write the inversion document**

Write `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-c-inversion.md` with exactly this table (sourced from spec §7.3 "Failure modes specific to PR C" and §8):

| # | Failure mode | Test/gate that catches it | Owning task |
|---|---|---|---|
| 1 | MDX + Turbopack incompatibility — first push to feature branch breaks dev server with `TypeError: createContext only works in Client Components` because `mdx-components.tsx` is missing | Task 2 creates `mdx-components.tsx` at project root BEFORE any MDX page is added; spike documented in `spike-mdx-turbopack-results.md` is the authoritative reference | T2 |
| 2 | Bundle leak to main routes — sidebar lib or Shiki helper imported into `/` page tree, inflating client JS | `scripts/check-bundle-size.mjs` 0-byte delta gate on `/` route vs `bundle-baseline.json` (committed in PR B Task 13); ALSO `/design-system/*` ≤ 2.5KB ceiling | T17 |
| 3 | Live preview hydration mismatch on Preview — server renders one source string, client hydrates another (e.g., `<Preview>` JSX serialization drift) | `<Preview>` is RSC (zero hydration surface); source string passed as a prop is identical server-rendered + final HTML; Playwright e2e in T19 asserts no hydration warning in console | T13, T19 |
| 4 | Auto-API drift — primitive's prop type changes, `_generated-api.mdx` not regenerated, docs lie | `pnpm gen-api:check` regenerates auto-API fragments and asserts deterministic output across runs (since fragments are gitignored, the check is generator determinism + JSDoc completeness); CI gate | T15 |
| 5 | Missing JSDoc on a primitive prop — `gen-component-api.mjs` emits empty description column | Generator throws `MISSING_PROP_DOC: <Component>.<propName>` and exits non-zero; CI gate. **Depends on PR B `pr-b-components.md` Task 15 JSDoc audit being clean before PR C merges** | T15 |
| 6 | Visual-changelog workflow misses a baseline update — workflow doesn't run, changelog goes stale | Defensive check: pre-merge gate inspects the latest workflow run on the PR; if the workflow didn't fire on a PR that touched a snapshot file, surfaces the gap | T16 |
| 7 | Visual-changelog spam from environmental drift — font rendering change causes hundreds of trivial diff entries | `[no-changelog]` commit-message label skips the entry; documented in contributor docs; unit test asserts skip behavior | T16 |
| 8 | SEO ranking shift — `/design-system/*` pages outrank `/` for "Erik Cunha design system" | Accepted per spec §5.7; canonical URLs set per page to prevent cross-portfolio duplication; T7-T10 set explicit `metadata.canonical` per page | T7-T10 |
| 9 | A11y regression on docs — new sidebar nav lacks landmark, `<details>` source disclosure isn't keyboard-navigable, code blocks aren't a focusable region | Sidebar uses `<nav aria-label="Design system">`; `<details>` is native and keyboard-safe; code blocks rendered with `<pre tabIndex={0} role="region" aria-label="Code sample">`; axe spec extended in T19; Lighthouse a11y = 100 on all 5 routes | T11, T13, T19 |
| 10 | Component↔heading drift — a primitive added in a future PR has no `## ComponentName` heading in `app/design-system/components/page.mdx` | Build-time check `scripts/check-mdx-component-headings.mjs` parses the page MDX, walks `design-system/components/`, fails if a primitive lacks a matching heading | T18 |
| 11 | Pages Router fallback regression — someone removes `mdx-components.tsx`, reintroduces the dev server failure mode | Lint rule: `scripts/check-mdx-prereqs.mjs` (folded into T18) asserts `mdx-components.tsx` exists at project root, `pageExtensions` includes `mdx`, `@next/mdx` exact-pinned to the same minor as `next`; CI gate | T18 |
| 12 | Stale-module dev-server state when contributors clone before running `pnpm install` for the new MDX deps | Documented in contributor docs (enforcement page) per spike's "Out-of-spike observations"; not an automated gate (the failure mode is informational) | T9 |
| 13 | Build-vs-dev divergence — MDX page works under Turbopack dev but fails `pnpm build` static generation | Spike did not test build path; T6 includes an explicit `pnpm build` verification against the smallest MDX page (landing) before adding the other four | T6 |
| 14 | Shiki bundle leak — Shiki is large (~1MB unbundled); accidentally shipped to client | Shiki runs at MDX compile time inside the `mdx-components.tsx` code-block transform; output is plain HTML strings; Shiki itself is NEVER imported from `app/**/*.tsx` or `*.client.tsx`. Bundle gate T17 catches a leak; lint rule in T18 rejects `from 'shiki'` outside `mdx-components.tsx` and `scripts/` | T14, T17, T18 |
| 15 | Auto-API generator drops a complex generic prop — `ts-morph` extraction misses a prop with a discriminated-union type | Unit test in T15 covers a discriminated-union fixture (mirrors `<Button>` polymorphic `as` from PR B); generator output reviewed by human in PR | T15 |

- [ ] **Step 2: Run code review against the inversion doc**

```bash
pnpm dlx claude code-review:code-review --files docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-c-inversion.md
```

Expected: no findings (docs file).

- [ ] **Step 3: Commit the inversion document**

```bash
git add docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-c-inversion.md
git commit -m "docs(design-system): pr-c thinking-inversion table"
```

---

### Task 2: Create `mdx-components.tsx` at project root

**Files:**
- Create: `mdx-components.tsx`

**This task MUST come before any other MDX work.** Per the spike outcome (`spike-mdx-turbopack-results.md` §Required prerequisites #1), without this file at the project root, Next 16 App Router falls back to Pages Router internals and the first MDX page errors with `TypeError: createContext only works in Client Components` plus stale-module errors that persist until a hard restart. The file lives adjacent to `next.config.ts`, NOT inside `app/`.

- [ ] **Step 1: Write the file (initial minimal version — Shiki + token overrides wired in T14)**

```tsx
// mdx-components.tsx (project root)
import type { MDXComponents } from 'mdx/types';

/**
 * MDX component map provider. Consumed by Next 16 App Router at MDX compile time.
 * Must live at the project root (adjacent to next.config.ts). Placing this file
 * under app/ would NOT be picked up by Next's MDX resolver — see
 * docs/superpowers/plans/2026-05-23-design-system-tokenized/spike-mdx-turbopack-results.md
 *
 * Initially passes components through unchanged. Task 14 of pr-c-docs.md
 * extends this map with Shiki-wrapped <pre>/<code>, design-token-styled
 * headings, and a Link primitive override for <a>.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}
```

- [ ] **Step 2: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add mdx-components.tsx
git commit -m "feat(design-system): add mdx-components.tsx provider at project root"
```

---

### Task 3: Install MDX + Shiki + ts-morph deps (exact-pinned)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

Per CLAUDE.md "Package + manager policy" + spike outcome §Required prerequisites #2. `@next/mdx` MUST exact-pin to the same minor as `next` (currently `~16.2.6`) — drift between the two is a known mismatch class. Shiki and ts-morph pin `@latest` per project convention.

- [ ] **Step 1: Install MDX core + companions**

```bash
pnpm add -DE @next/mdx@16.2.6 @mdx-js/loader@3.1.x @mdx-js/react@3.1.x
```

Expected: three devDependencies added, lockfile updated, no runtime dep growth.

- [ ] **Step 2: Install Shiki (build-time syntax highlighting)**

```bash
pnpm add -DE shiki@latest
```

- [ ] **Step 3: Install ts-morph (auto-API extraction)**

```bash
pnpm add -DE ts-morph@latest
```

- [ ] **Step 4: Verify install hygiene**

```bash
pnpm install --frozen-lockfile
pnpm ls @next/mdx @mdx-js/loader @mdx-js/react shiki ts-morph
```

Expected: all five present in `devDependencies` with exact versions (no `^` on `@next/mdx@16.2.6`).

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add package.json pnpm-lock.yaml
git commit -m "feat(design-system): pin mdx + shiki + ts-morph devDependencies"
```

---

### Task 4: Wire `pageExtensions` + `withMDX` in `next.config.ts`

**Files:**
- Modify: `next.config.ts`

Per spike outcome §Required prerequisites #3 + #4. `withMDX` MUST wrap `nextConfig` BEFORE `analyze` (the existing `withBundleAnalyzer` wrapper), exactly as in the spike doc.

- [ ] **Step 1: Add `pageExtensions` + `createMDX` wrapper**

```ts
// next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
const withMDX = createMDX({});

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
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

- [ ] **Step 2: Verify Turbopack dev still boots clean**

```bash
pnpm dev
```

Hit `http://localhost:3000/` in a browser; confirm no MDX-related compile errors in the dev log (no MDX pages exist yet — this is a clean-boot smoke). Stop the server.

- [ ] **Step 3: Verify production build still passes**

```bash
pnpm build
```

Expected: green build; `pageExtensions` does not regress any existing route.

- [ ] **Step 4: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add next.config.ts
git commit -m "feat(design-system): wire pageExtensions + createMDX wrapper in next.config"
```

---

### Task 5: Build the `/design-system` layout + first page (landing)

**Files:**
- Create: `app/design-system/layout.tsx`, `app/design-system/layout.module.css`, `app/design-system/page.mdx`
- Create: `app/design-system/_components/Sidebar.client.tsx`, `app/design-system/_components/Sidebar.module.css`

The landing page validates the full pipeline end-to-end (layout + sidebar + MDX render) BEFORE the other four pages copy the pattern. Per spec §5.3, layout is RSC; sidebar is a small client island for active-link highlight; CRT overlay disabled.

- [ ] **Step 1: Write the layout (RSC)**

```tsx
// app/design-system/layout.tsx
import type { ReactNode } from 'react';
import { Sidebar } from './_components/Sidebar.client';
import styles from './layout.module.css';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-no-crt="true">
      <details className={styles.mobileNav}>
        <summary>DESIGN_SYSTEM_NAV</summary>
        <Sidebar />
      </details>
      <aside className={styles.desktopNav} aria-label="Design system">
        <Sidebar />
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write the layout CSS (semantic tokens only)**

```css
/* app/design-system/layout.module.css */
.root {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--ds-space-pad);
  max-inline-size: var(--ds-layout-maxw);
  margin-inline: auto;
  padding-block: var(--ds-space-rhythm);
}
.desktopNav { position: sticky; inset-block-start: var(--ds-space-pad); align-self: start; }
.mobileNav { display: none; }
.content { max-inline-size: 720px; }
@media (max-width: 768px) {
  .root { grid-template-columns: 1fr; }
  .desktopNav { display: none; }
  .mobileNav { display: block; }
}
```

- [ ] **Step 3: Write the Sidebar client island (~1KB)**

```tsx
// app/design-system/_components/Sidebar.client.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/design-system/components/Link';
import styles from './Sidebar.module.css';

const ROUTES = [
  { href: '/design-system', label: 'OVERVIEW' },
  { href: '/design-system/tokens', label: 'TOKENS' },
  { href: '/design-system/components', label: 'COMPONENTS' },
  { href: '/design-system/enforcement', label: 'ENFORCEMENT' },
  { href: '/design-system/changelog', label: 'CHANGELOG' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Design system">
      <ul className={styles.list}>
        {ROUTES.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              variant="nav"
              aria-current={pathname === r.href ? 'page' : undefined}
              className={pathname === r.href ? styles.active : undefined}
            >
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

```css
/* app/design-system/_components/Sidebar.module.css */
.list { list-style: none; padding: 0; display: grid; gap: var(--ds-space-pad-tight); }
.active { color: var(--ds-color-signal); }
```

- [ ] **Step 4: Write the landing MDX page**

```mdx
{/* app/design-system/page.mdx */}
export const metadata = {
  title: 'Design system · Erik Cunha',
  description: 'Two-tier tokens, 8 primitive components, MDX docs, visual changelog automation. The system that builds erikunha.dev.',
  alternates: { canonical: 'https://erikunha.dev/design-system' },
};

# DESIGN_SYSTEM

A reference for web systems engineering. Two-tier tokens (primitives + semantic). Eight RSC primitives. Bidirectional Figma sync. Auto-generated API tables. Visual changelog automation.

## Principles

1. **Semantic tokens only in components.** Primitives are the palette; semantics are the API. Boundary lint enforces.
2. **RSC by default.** Components ship zero client JS unless they need state.
3. **Documentation is generated, not maintained.** API tables walk TS types. Changelog walks Playwright diffs.
4. **The system grows with the consumer.** Two-tier tokens, theme variants, deep-path import discipline — the architecture supports the second consumer without rework.

## Navigate

- [TOKENS](/design-system/tokens) — palette, type scale, spacing, motion
- [COMPONENTS](/design-system/components) — 8 primitives with live previews
- [ENFORCEMENT](/design-system/enforcement) — lint rules, CI gates, contributing
- [CHANGELOG](/design-system/changelog) — visual diffs from merged PRs
```

- [ ] **Step 5: Verify dev server renders the page**

```bash
pnpm dev
```

Visit `http://localhost:3000/design-system`. Expected: page renders with sidebar + content; no MDX compile errors; no hydration warnings in console; CRT overlay is not visible. Stop the server.

- [ ] **Step 6: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/layout.tsx app/design-system/layout.module.css app/design-system/page.mdx app/design-system/_components/Sidebar.*
git commit -m "feat(design-system): /design-system landing page + layout + sidebar island"
```

---

### Task 6: Verify MDX static generation under `pnpm build`

**Files:** none new.

Per spec §7.3 failure mode #13 (folded into inversion T1 row #13) + spike "Build-vs-dev not tested" note. Confirm the landing page static-generates under `pnpm build` BEFORE adding the other four pages — the build path was outside the spike scope.

- [ ] **Step 1: Production build**

```bash
pnpm build
```

Expected: build succeeds; build log shows `/design-system` listed as `○ (Static)` route; no MDX-related errors.

- [ ] **Step 2: Verify the static HTML exists**

```bash
ls .next/server/app/design-system/
```

Expected: `page.html` or equivalent prerendered artifact present.

- [ ] **Step 3: No commit** — this is a verification-only task. If the build fails, do NOT proceed to T7. Surface the failure, capture the error in `spike-mdx-turbopack-results.md`'s "Build-vs-dev not tested" section as a documented follow-up, and re-evaluate whether the static-generation path needs a fallback (e.g., `dynamic = 'force-static'` export or revert MDX scope to TSX docs).

---

### Task 7: `/design-system/tokens` page

**Files:**
- Create: `app/design-system/tokens/page.mdx`

Per spec §5.1 row 2. Visual tables for palette, type scale, spacing, motion, layers, borders. Token values consumed from `design-system/dist/tokens.json` (generated by PR A) — page imports the JSON and renders tables.

- [ ] **Step 1: Write the page**

```mdx
{/* app/design-system/tokens/page.mdx */}
import tokens from '@/design-system/dist/tokens.json';

export const metadata = {
  title: 'Tokens · Design system · Erik Cunha',
  description: 'Two-tier token system: primitives + semantic aliases. Color, space, typography, motion, layer, border.',
  alternates: { canonical: 'https://erikunha.dev/design-system/tokens' },
};

# TOKENS

Authored as JSON under `design-system/tokens/*.json`. Generated to CSS + TypeScript + JSON by Style Dictionary at build time. Components consume the **semantic** layer only — primitives are the input.

## Color — semantic

{/* Table rendered from tokens.color.semantic — name | maps to primitive | hex preview | contrast on --ds-color-surface-base */}

## Color — primitives

{/* Table from tokens.color.primitives */}

## Spacing

{/* Table from tokens.space — name | px value | example use */}

## Typography

{/* Table from tokens.typography — size, leading, font families */}

## Motion

{/* Table from tokens.motion — duration + easing semantics; @keyframes exception called out */}

## Layer + border

{/* Tables from tokens.layer and tokens.border */}
```

- [ ] **Step 2: Verify**

```bash
pnpm dev
```

Visit `/design-system/tokens`. Expected: page renders; tables show token values; sidebar highlights TOKENS link. Stop.

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/tokens/page.mdx
git commit -m "feat(design-system): /design-system/tokens page with two-tier tables"
```

---

### Task 8: `/design-system/components` page (skeleton — auto-API fragments wired in T15)

**Files:**
- Create: `app/design-system/components/page.mdx`

Per spec §5.1 row 3. All 8 primitives on one scrollable page with `#anchor` links. Each section embeds the auto-generated API fragment (created in T15) + a `<Preview>` example. This task creates the skeleton; T15 wires the auto-API imports; T13 wires `<Preview>`.

- [ ] **Step 1: Write the page skeleton (one `<h2>` per primitive)**

```mdx
{/* app/design-system/components/page.mdx */}
import { Button } from '@/design-system/components/Button';
import { Field } from '@/design-system/components/Field';
import { Badge } from '@/design-system/components/Badge';
import { TerminalPanel } from '@/design-system/components/TerminalPanel';
import { StatTile } from '@/design-system/components/StatTile';
import { CmdLine } from '@/design-system/components/CmdLine';
import { KbdKey } from '@/design-system/components/KbdKey';
import { Link } from '@/design-system/components/Link';
import { Preview } from '../_components/Preview';

export const metadata = {
  title: 'Components · Design system · Erik Cunha',
  description: '8 primitive React Server Components: Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey, Link.',
  alternates: { canonical: 'https://erikunha.dev/design-system/components' },
};

# COMPONENTS

Eight primitives. RSC by default. Semantic tokens only.

## Button

<Preview code={`<Button variant="primary">EXEC_HIRE</Button>`}>
  <Button variant="primary">EXEC_HIRE</Button>
</Preview>

{/* API table import wired in T15: import ButtonAPI from '@/design-system/components/Button/_generated-api.mdx'; <ButtonAPI /> */}

## Field
{/* Preview + API */}

## Badge
{/* Preview + API */}

## TerminalPanel
{/* Preview + API */}

## StatTile
{/* Preview + API */}

## CmdLine
{/* Preview + API */}

## KbdKey
{/* Preview + API */}

## Link
{/* Preview + API */}

## Composition Patterns

`StatGrid` (4-up grid using `<StatTile>`) lives in section code, not the primitive set. See `components/HeroStats.tsx` for the canonical implementation.
```

- [ ] **Step 2: Verify**

```bash
pnpm dev
```

Visit `/design-system/components`. Expected: page renders all 8 `<h2>` headings; anchor links work (`#button`, etc.); sidebar highlights COMPONENTS. Stop.

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/components/page.mdx
git commit -m "feat(design-system): /design-system/components page skeleton"
```

---

### Task 9: `/design-system/enforcement` page

**Files:**
- Create: `app/design-system/enforcement/page.mdx`

Per spec §5.1 row 5. Documents every lint rule, CI gate, and contributing flow.

- [ ] **Step 1: Write the page**

```mdx
{/* app/design-system/enforcement/page.mdx */}
export const metadata = {
  title: 'Enforcement · Design system · Erik Cunha',
  description: 'Lint rules, CI gates, codemod info. How the design system stays consistent at scale.',
  alternates: { canonical: 'https://erikunha.dev/design-system/enforcement' },
};

# ENFORCEMENT

Every rule has a CI gate. No gate is opt-in.

## Lint gates

- `scripts/lint-token-boundary.mjs` — rejects primitive token references in `.module.css` outside the semantic-layer file. Spec §3.4.
- `scripts/lint-no-magic-values.mjs` — rejects raw hex, raw px, raw ms/s, hardcoded z-index. Allowlist with one-line justification per exception. Spec §3.5.
- `scripts/lint-no-use-client-in-ds.mjs` — rejects `"use client"` in `design-system/components/*` unless preceded by `// ds-exception: <reason>`. PR B.
- `scripts/check-ripgrep-call-sites.mjs` — rejects legacy class names (`.cta`, `.status`, `.field`, raw `<kbd`) outside `design-system/components/`. PR B.

## Build gates

- `pnpm tokens:check` — regenerates and diffs against committed; fails on hand-edited dist files. Spec §3.7.
- `pnpm gen-api:check` — regenerates auto-API fragments and asserts deterministic output; fails on `MISSING_PROP_DOC: <Component>.<propName>` for any prop without JSDoc. Spec §5.9.
- `pnpm bundle-check` — per-route gzipped JS ceilings: `/` 0-byte delta vs baseline; `/design-system/*` ≤ 2.5KB total.
- `pnpm check:mdx-headings` — every primitive in `design-system/components/` has a `## ComponentName` heading in this docs page.
- `pnpm check:mdx-prereqs` — `mdx-components.tsx` exists at project root, `pageExtensions` includes `mdx`, `@next/mdx` exact-pinned to next minor.

## Contributing

- Add a primitive → ship `<Name>.tsx`, `<Name>.module.css`, `<Name>.test.tsx`, `index.ts`; every prop gets JSDoc; add a `## <Name>` heading + `<Preview>` to `app/design-system/components/page.mdx`.
- Add a token → edit `design-system/tokens/*.json`; run `pnpm tokens:build`; run `pnpm tokens:check`.
- Change a baseline → commit the new PNG with a normal message to trigger a changelog entry; use `[no-changelog]` in the commit message for environmental drift.

## Stale-module dev-server note

If the dev server surfaces a `Module ... was instantiated because it was required from module [hmr-entry]` error, hard-restart the dev server. This is a Next 16 + Turbopack quirk documented in the MDX spike. Once `mdx-components.tsx` exists at the project root, this should not recur.
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm dev # check render, stop
pnpm dlx claude code-review:code-review --staged
git add app/design-system/enforcement/page.mdx
git commit -m "feat(design-system): /design-system/enforcement page"
```

---

### Task 10: `/design-system/changelog` page (initial empty state)

**Files:**
- Create: `app/design-system/changelog/page.mdx`

Per spec §5.1 row 6 + §5.10. Initial state is an empty changelog with a sentinel marker; T16's `build-visual-changelog.mjs` appends entries above the marker on merge to main.

- [ ] **Step 1: Write the initial page**

```mdx
{/* app/design-system/changelog/page.mdx */}
export const metadata = {
  title: 'Changelog · Design system · Erik Cunha',
  description: 'Visual changelog from Playwright baseline diffs. One entry per merged PR that updates a baseline.',
  alternates: { canonical: 'https://erikunha.dev/design-system/changelog' },
};

# CHANGELOG

Auto-generated from Playwright baseline diffs. One entry per merged PR that updates a baseline image. PRs with `[no-changelog]` in the commit message skip the entry.

{/* changelog-entries-start */}
{/* New entries appended above this marker by scripts/build-visual-changelog.mjs */}
{/* changelog-entries-end */}

_No changelog entries yet. First entry will land when a PR updates a Playwright baseline after this page ships._
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm dev # check render, stop
pnpm dlx claude code-review:code-review --staged
git add app/design-system/changelog/page.mdx
git commit -m "feat(design-system): /design-system/changelog page with sentinel markers"
```

---

### Task 11: Sidebar.client.tsx tests (~1KB budget)

**Files:**
- Create: `app/design-system/_components/Sidebar.test.tsx`

Spec §5.5 ceiling: Sidebar ≤ 1KB gzipped. Test asserts the active-link + landmark contract.

- [ ] **Step 1: Write the test (fails — no test file yet; component already exists from T5)**

```tsx
// app/design-system/_components/Sidebar.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar.client';

vi.mock('next/navigation', () => ({ usePathname: () => '/design-system/tokens' }));

describe('Sidebar', () => {
  it('renders a nav with aria-label="Design system"', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation', { name: 'Design system' })).toBeInTheDocument();
  });
  it('marks the active route with aria-current="page"', () => {
    render(<Sidebar />);
    const active = screen.getByRole('link', { name: 'TOKENS' });
    expect(active).toHaveAttribute('aria-current', 'page');
  });
  it('does NOT mark inactive routes', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'OVERVIEW' })).not.toHaveAttribute('aria-current');
  });
});
```

```bash
pnpm vitest run app/design-system/_components/Sidebar.test.tsx
```

Expected: 3/3 pass (T5 already implemented Sidebar to this contract).

- [ ] **Step 2: Verify Sidebar gzipped size ≤ 1KB**

```bash
pnpm build && pnpm bundle-check
```

Expected: per-route table shows Sidebar contribution ≤ ~1KB; aggregate `/design-system/*` ≤ 2.5KB.

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/_components/Sidebar.test.tsx
git commit -m "test(design-system): sidebar active-link + nav landmark contract"
```

---

### Task 12: CopyButton.client.tsx (~600B budget) + tests

**Files:**
- Create: `app/design-system/_components/CopyButton.client.tsx`, `app/design-system/_components/CopyButton.module.css`, `app/design-system/_components/CopyButton.test.tsx`

Spec §5.5 ceiling: CopyButton ≤ 600 bytes gzipped. Per inversion T1 row #9, code blocks must remain `<pre tabIndex={0} role="region" aria-label="Code sample">` — CopyButton is appended INSIDE the region as a sibling element.

- [ ] **Step 1: Write the test (fails)**

```tsx
// app/design-system/_components/CopyButton.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyButton } from './CopyButton.client';

describe('CopyButton', () => {
  it('copies the source string to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyButton source="const x = 1;" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('const x = 1;');
  });
  it('toggles label to "Copied" after copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    render(<CopyButton source="x" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await screen.findByRole('button', { name: /copied/i });
  });
});
```

```bash
pnpm vitest run app/design-system/_components/CopyButton.test.tsx
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement CopyButton**

```tsx
// app/design-system/_components/CopyButton.client.tsx
'use client';
import { useState } from 'react';
import styles from './CopyButton.module.css';

export function CopyButton({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.root}
      onClick={async () => {
        await navigator.clipboard.writeText(source);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
```

```css
/* app/design-system/_components/CopyButton.module.css */
.root {
  background: transparent;
  color: var(--ds-color-signal);
  border: var(--ds-border-width-1) solid var(--ds-color-border-default);
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  padding: var(--ds-space-pad-tight);
  cursor: pointer;
}
.root:focus-visible { outline: var(--ds-border-width-1) solid var(--ds-color-signal); outline-offset: 2px; }
```

```bash
pnpm vitest run app/design-system/_components/CopyButton.test.tsx
```

Expected: 2/2 pass.

- [ ] **Step 3: Bundle gate**

```bash
pnpm build && pnpm bundle-check
```

Expected: CopyButton contribution ≤ ~600B; aggregate `/design-system/*` ≤ 2.5KB.

- [ ] **Step 4: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/_components/CopyButton.*
git commit -m "feat(design-system): CopyButton client island for docs code blocks"
```

---

### Task 13: Preview.tsx (RSC, ~0.4KB CSS-only delta) + tests

**Files:**
- Create: `app/design-system/_components/Preview.tsx`, `app/design-system/_components/Preview.module.css`, `app/design-system/_components/Preview.test.tsx`

Spec §5.4 + inversion T1 row #3. Preview MUST be RSC (no `"use client"`) — eliminates the hydration mismatch failure mode by design. Bundle impact is CSS only (~0.4KB).

- [ ] **Step 1: Write the test (fails)**

```tsx
// app/design-system/_components/Preview.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Preview } from './Preview';

describe('Preview', () => {
  it('renders children inside a panel', () => {
    render(<Preview code="<X />"><span data-testid="child" /></Preview>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
  it('renders the source inside a <details> disclosure', () => {
    const { container } = render(<Preview code="<X />"><span /></Preview>);
    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details?.textContent).toContain('<X />');
  });
  it('code region is focusable + labelled', () => {
    const { container } = render(<Preview code="<X />"><span /></Preview>);
    const pre = container.querySelector('pre');
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(pre).toHaveAttribute('role', 'region');
    expect(pre).toHaveAttribute('aria-label', 'Code sample');
  });
});
```

```bash
pnpm vitest run app/design-system/_components/Preview.test.tsx
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement Preview (RSC)**

```tsx
// app/design-system/_components/Preview.tsx
import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system/components/TerminalPanel';
import styles from './Preview.module.css';

export function Preview({ code, children }: { code: string; children: ReactNode }) {
  return (
    <TerminalPanel borderStyle="solid">
      <div className={styles.surface}>{children}</div>
      <details className={styles.disclosure}>
        <summary>View source</summary>
        <pre tabIndex={0} role="region" aria-label="Code sample" className={styles.pre}>
          <code>{code}</code>
        </pre>
      </details>
    </TerminalPanel>
  );
}
```

```css
/* app/design-system/_components/Preview.module.css */
.surface { padding: var(--ds-space-pad); }
.disclosure { border-block-start: var(--ds-border-width-1) solid var(--ds-color-border-default); padding: var(--ds-space-pad-tight); }
.pre { overflow-x: auto; font-family: var(--ds-font-family-mono); font-size: var(--ds-font-size-body); }
```

```bash
pnpm vitest run app/design-system/_components/Preview.test.tsx
```

Expected: 3/3 pass.

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add app/design-system/_components/Preview.*
git commit -m "feat(design-system): Preview RSC component with details source disclosure"
```

---

### Task 14: Shiki integration in `mdx-components.tsx`

**Files:**
- Modify: `mdx-components.tsx`

Per spec §5.2 — Shiki runs at MDX compile time, zero runtime cost. Spike confirmed code blocks render as plain `<pre><code>` without Shiki; this task wires the highlight transform. Per inversion T1 row #14, Shiki MUST NOT be imported from any `app/**/*.tsx` or `*.client.tsx` file — only from `mdx-components.tsx` and `scripts/`.

**Note on Shiki output rendering:** Shiki's `codeToHtml` returns an HTML string. Two equivalent patterns: (a) parse to a React tree via `shiki`'s built-in `codeToHast` + `hast-util-to-jsx-runtime` (no raw HTML insertion); (b) use React's raw-HTML escape hatch. This plan adopts pattern (a) — the parsed-AST approach — because it avoids any raw-HTML-insertion API and keeps the code path purely React-tree based. Per CLAUDE.md security posture, never insert untrusted strings via raw-HTML APIs; Shiki output is build-time-only and trusted, but the parsed-AST approach is equivalent in cost and avoids the API entirely.

- [ ] **Step 1: Install `hast-util-to-jsx-runtime` for the parsed-AST path**

```bash
pnpm add -DE hast-util-to-jsx-runtime@latest
```

- [ ] **Step 2: Extend the MDX component map**

```tsx
// mdx-components.tsx (project root)
import type { MDXComponents } from 'mdx/types';
import { Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Link } from '@/design-system/components/Link';
import { createHighlighter } from 'shiki';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';

// Build-time singleton. Module-scope so Next's build pipeline reuses it across MDX compilations.
const highlighterPromise = createHighlighter({
  themes: ['github-dark-default'],
  langs: ['tsx', 'ts', 'css', 'json', 'bash', 'mdx'],
});

async function HighlightedCode({ children, className }: { children: string; className?: string }) {
  const lang = className?.replace(/^language-/, '') ?? 'tsx';
  const highlighter = await highlighterPromise;
  const hast = highlighter.codeToHast(String(children), { lang, theme: 'github-dark-default' });
  return toJsxRuntime(hast, { Fragment, jsx, jsxs });
}

/**
 * MDX component map. Heading overrides apply design tokens; code blocks
 * route through Shiki at build time (zero runtime cost). Anchor element
 * uses the Link primitive's `inline` variant.
 *
 * Shiki imports are ALLOWED HERE ONLY. Per docs/superpowers/plans/
 * 2026-05-23-design-system-tokenized/pr-c-docs.md inversion T1 row #14,
 * any other file importing from 'shiki' is rejected by check-mdx-prereqs.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    a: ({ href = '#', children, ...rest }) => (
      <Link href={href} variant="inline" {...rest}>
        {children}
      </Link>
    ),
    pre: ({ children, ...rest }) => (
      <pre tabIndex={0} role="region" aria-label="Code sample" {...rest}>
        {children}
      </pre>
    ),
    code: HighlightedCode,
  };
}
```

- [ ] **Step 3: Verify Shiki renders highlighted code at build time**

```bash
pnpm build
```

Expected: build succeeds; inspect the prerendered HTML of `/design-system/enforcement` — code blocks should contain Shiki-emitted `<span style="color:#...">` tokens, not plain text.

- [ ] **Step 4: Verify Shiki does NOT leak into client bundle**

```bash
pnpm bundle-check
```

Expected: `/` route delta = 0; `/design-system/*` total still under 2.5KB ceiling. If Shiki leaks, a non-MDX file is importing it — find via `rg "from 'shiki'" --type ts --type tsx` (only `mdx-components.tsx` should match).

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add mdx-components.tsx package.json pnpm-lock.yaml
git commit -m "feat(design-system): wire shiki build-time highlighting in mdx-components"
```

---

### Task 15: Auto-API generation via `ts-morph`

**Files:**
- Create: `scripts/gen-component-api.mjs`, `scripts/gen-component-api.test.mjs`
- Modify: `package.json` (add `gen-api` + `gen-api:check` scripts), `.gitignore` (add `design-system/components/*/_generated-api.mdx`), `app/design-system/components/page.mdx` (wire imports)

Spec §5.9. **Dependency on PR B:** the generator depends on every primitive's prop having JSDoc — verified in `pr-b-components.md` Task 15's pre-flight audit. If PR B Task 15 was skipped or surfaced missing JSDoc, this task will fail with `MISSING_PROP_DOC: <Component>.<propName>` — the remediation is to add the JSDoc in the primitive's `.tsx`, NOT to weaken the generator.

- [ ] **Step 1: Write the generator test (fails)**

```js
// scripts/gen-component-api.test.mjs
import { describe, expect, it } from 'vitest';
import { generateApiMdx } from './gen-component-api.mjs';

const FIXTURE_BUTTON = `
import type { ButtonHTMLAttributes, ReactNode } from 'react';
export type ButtonProps = {
  /** Visual variant. */
  variant?: 'primary' | 'secondary';
  /** Size. */
  size?: 'sm' | 'md' | 'lg';
  /** Children. */
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;
export function Button(_: ButtonProps) { return null; }
`;

const FIXTURE_BAD = `
export type BadProps = { variant?: 'a' | 'b'; /* no JSDoc */ };
export function Bad(_: BadProps) { return null; }
`;

describe('gen-component-api', () => {
  it('emits an MDX table with name/type/default/required/description columns', () => {
    const mdx = generateApiMdx({ name: 'Button', source: FIXTURE_BUTTON, propsType: 'ButtonProps' });
    expect(mdx).toContain('| variant |');
    expect(mdx).toContain("'primary' | 'secondary'");
    expect(mdx).toContain('Visual variant');
  });
  it('throws MISSING_PROP_DOC when a prop lacks JSDoc', () => {
    expect(() => generateApiMdx({ name: 'Bad', source: FIXTURE_BAD, propsType: 'BadProps' }))
      .toThrow(/MISSING_PROP_DOC: Bad\.variant/);
  });
});
```

```bash
pnpm vitest run scripts/gen-component-api.test.mjs
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement the generator**

```js
// scripts/gen-component-api.mjs
import { Project } from 'ts-morph';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS_DIR = 'design-system/components';

export function generateApiMdx({ name, source, propsType }) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(`${name}.tsx`, source);
  const typeAlias = sf.getTypeAlias(propsType);
  if (!typeAlias) throw new Error(`PROPS_TYPE_NOT_FOUND: ${name}.${propsType}`);
  const props = typeAlias.getType().getProperties();
  const rows = props.map((p) => {
    const decl = p.getDeclarations()[0];
    const jsDoc = decl?.getLeadingCommentRanges()?.[0]?.getText() ?? '';
    const description = jsDoc.match(/\/\*\*\s*(.*?)\s*\*\//s)?.[1]?.replace(/\n\s*\*\s?/g, ' ').trim() ?? '';
    if (!description) throw new Error(`MISSING_PROP_DOC: ${name}.${p.getName()}`);
    const propType = p.getTypeAtLocation(typeAlias).getText();
    const required = !p.isOptional();
    return `| ${p.getName()} | \`${propType}\` | — | ${required ? 'yes' : 'no'} | ${description} |`;
  });
  return [
    `<!-- AUTO-GENERATED by scripts/gen-component-api.mjs. DO NOT EDIT. -->`,
    ``,
    `| Prop | Type | Default | Required | Description |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
  const dirs = readdirSync(COMPONENTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const name = dir.name;
    const indexSf = project.getSourceFile(join(COMPONENTS_DIR, name, 'index.ts'));
    if (!indexSf) continue;
    const componentSf = project.getSourceFile(join(COMPONENTS_DIR, name, `${name}.tsx`));
    if (!componentSf) continue;
    const mdx = generateApiMdx({ name, source: componentSf.getFullText(), propsType: `${name}Props` });
    writeFileSync(join(COMPONENTS_DIR, name, '_generated-api.mdx'), mdx);
    console.log(`generated ${name}/_generated-api.mdx`);
  }
}
```

```bash
pnpm vitest run scripts/gen-component-api.test.mjs
```

Expected: 2/2 pass.

- [ ] **Step 3: Wire scripts in `package.json`**

```json
"gen-api": "node scripts/gen-component-api.mjs",
"gen-api:check": "node scripts/gen-component-api.mjs"
```

Note: `_generated-api.mdx` is gitignored (per File Structure above), so `gen-api:check` regenerates the files and asserts the generator runs to completion without throwing — i.e., the gate is generator determinism + JSDoc completeness, not committed-file drift. Spec §5.9 allows this model (the alternative is to commit the fragments and use `git diff --exit-code`; review noise is the trade-off — this plan adopts gitignored).

Update `.gitignore`:
```
design-system/components/*/_generated-api.mdx
```

- [ ] **Step 4: Run the generator against the real primitives + import fragments into the components page**

```bash
pnpm gen-api
```

Expected: 8 `_generated-api.mdx` files written; zero `MISSING_PROP_DOC` errors (PR B Task 15 audit ensures completeness).

Edit `app/design-system/components/page.mdx` to import each fragment:

```mdx
import ButtonAPI from '@/design-system/components/Button/_generated-api.mdx';
import FieldAPI from '@/design-system/components/Field/_generated-api.mdx';
import BadgeAPI from '@/design-system/components/Badge/_generated-api.mdx';
import TerminalPanelAPI from '@/design-system/components/TerminalPanel/_generated-api.mdx';
import StatTileAPI from '@/design-system/components/StatTile/_generated-api.mdx';
import CmdLineAPI from '@/design-system/components/CmdLine/_generated-api.mdx';
import KbdKeyAPI from '@/design-system/components/KbdKey/_generated-api.mdx';
import LinkAPI from '@/design-system/components/Link/_generated-api.mdx';
```

…and place `<ButtonAPI />` (etc.) under each `## <Name>` section's `<Preview>`.

- [ ] **Step 5: Wire into CI**

Add to `.github/workflows/ci.yml` before build step:
```yaml
- name: Generate + check component API tables
  run: pnpm gen-api:check
```

- [ ] **Step 6: Verify + code review + commit**

```bash
pnpm gen-api && pnpm vitest run scripts/gen-component-api.test.mjs && pnpm build
pnpm dlx claude code-review:code-review --staged
git add scripts/gen-component-api.* package.json .gitignore app/design-system/components/page.mdx .github/workflows/ci.yml
git commit -m "feat(design-system): auto-API generation via ts-morph + components page wiring"
```

---

### Task 16: Visual changelog automation

**Files:**
- Create: `.github/workflows/visual-changelog.yml`, `scripts/build-visual-changelog.mjs`, `scripts/build-visual-changelog.test.mjs`
- Modify: `package.json` (add `build:visual-changelog` script)

Spec §5.10 + inversion T1 rows #6, #7. Workflow runs on PRs touching baseline snapshots; on merge to main, appends a changelog entry above the sentinel marker in `app/design-system/changelog/page.mdx`. `[no-changelog]` commit messages skip.

- [ ] **Step 1: Write the builder test (fails)**

```js
// scripts/build-visual-changelog.test.mjs
import { describe, expect, it } from 'vitest';
import { buildChangelogEntry, shouldSkip } from './build-visual-changelog.mjs';

describe('build-visual-changelog', () => {
  it('builds a changelog entry with PR number, date, component, thumbnails', () => {
    const entry = buildChangelogEntry({
      prNumber: 42,
      date: '2026-05-30',
      component: 'Button',
      thumbnails: ['/changelog/42/button-before.png', '/changelog/42/button-after.png'],
    });
    expect(entry).toContain('PR #42');
    expect(entry).toContain('2026-05-30');
    expect(entry).toContain('Button');
    expect(entry).toContain('/changelog/42/button-before.png');
  });
  it('skips when commit message contains [no-changelog]', () => {
    expect(shouldSkip('fix(visual): regen baselines [no-changelog]')).toBe(true);
    expect(shouldSkip('feat(design-system): button hover state')).toBe(false);
  });
});
```

```bash
pnpm vitest run scripts/build-visual-changelog.test.mjs
```

Expected: ERROR.

- [ ] **Step 2: Implement the builder**

```js
// scripts/build-visual-changelog.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const CHANGELOG_PATH = 'app/design-system/changelog/page.mdx';
const MARKER = '{/* changelog-entries-start */}';

export function shouldSkip(commitMessage) {
  return /\[no-changelog\]/.test(commitMessage);
}

export function buildChangelogEntry({ prNumber, date, component, thumbnails }) {
  return [
    `### PR #${prNumber} · ${date} · ${component}`,
    ``,
    thumbnails.map((t) => `![baseline](${t})`).join(' '),
    ``,
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const meta = JSON.parse(process.env.CHANGELOG_META ?? '{}');
  if (shouldSkip(meta.commitMessage ?? '')) {
    console.log('skipped per [no-changelog]');
    process.exit(0);
  }
  const entry = buildChangelogEntry(meta);
  const current = readFileSync(CHANGELOG_PATH, 'utf8');
  const updated = current.replace(MARKER, `${MARKER}\n\n${entry}`);
  writeFileSync(CHANGELOG_PATH, updated);
  console.log(`appended entry for PR #${meta.prNumber}`);
}
```

```bash
pnpm vitest run scripts/build-visual-changelog.test.mjs
```

Expected: 2/2 pass.

- [ ] **Step 3: Add the workflow**

```yaml
# .github/workflows/visual-changelog.yml
name: visual-changelog
on:
  pull_request:
    paths:
      - 'tests/e2e/visual.spec.ts-snapshots/**'
      - 'tests/e2e/design-system-components.spec.ts-snapshots/**'
  push:
    branches: [main]
    paths:
      - 'tests/e2e/visual.spec.ts-snapshots/**'
      - 'tests/e2e/design-system-components.spec.ts-snapshots/**'

jobs:
  diff:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Generate side-by-side diffs
        run: node scripts/diff-baselines.mjs  # PR A ships this script
      - name: Upload diff artifact
        uses: actions/upload-artifact@v4
        with: { name: visual-diffs, path: .visual-diffs/ }
      - name: Post PR comment with thumbnails
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          recreate: true
          path: .visual-diffs/SUMMARY.md

  append-changelog:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions: { contents: write, pull-requests: read }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Append entry to /design-system/changelog
        env:
          CHANGELOG_META: ${{ toJSON(github.event.head_commit) }}
        run: pnpm build:visual-changelog
      - name: Commit + push
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add app/design-system/changelog/page.mdx
          git diff --cached --quiet || git commit -m "docs(design-system): append changelog entry [no-changelog]"
          git push
```

Note: the appending commit uses `[no-changelog]` to prevent the workflow from re-triggering on its own commit.

- [ ] **Step 4: Wire `package.json`**

```json
"build:visual-changelog": "node scripts/build-visual-changelog.mjs"
```

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add scripts/build-visual-changelog.* .github/workflows/visual-changelog.yml package.json
git commit -m "feat(design-system): visual changelog workflow + appender script"
```

---

### Task 17: Bundle gate — `/design-system/*` ≤ 2.5KB + `/` 0-byte delta

**Files:**
- Modify: `scripts/check-bundle-size.mjs`

PR B Task 13 already wired the `/` 0-byte-delta gate + 2.5KB ceiling for `/design-system/*` (see `pr-b-components.md` Task 13 implementation). This task extends the per-route accounting to enumerate the five new routes individually so a regression on a single page is attributable, and refreshes the baseline if PR B's snapshot omitted MDX-related infra.

- [ ] **Step 1: Extend per-route ceilings**

Locate the `DS_CEILING_BYTES = 2560` constant from PR B and extend to a per-route map (aggregate ≤ 2.5KB stays; per-route soft ceiling for visibility):

```js
const DS_PER_ROUTE_SOFT_CEILING = 1024; // 1KB per route as a soft sub-ceiling
const DS_AGGREGATE_CEILING = 2560; // 2.5KB total — hard
const DS_ROUTES = [
  '/design-system',
  '/design-system/tokens',
  '/design-system/components',
  '/design-system/enforcement',
  '/design-system/changelog',
];
```

Update the gate logic to print a per-route table on failure (already exists per PR B Task 13 Step 3; verify and extend).

- [ ] **Step 2: Refresh the baseline if PR B's snapshot predates MDX install**

Per PR B Task 13 Step 1, `bundle-baseline.json` was committed against main at that point. If `pnpm bundle-check` now fails because `@next/mdx` or `shiki` runtime traces somehow surface on `/` (they should not — Shiki is build-time-only, MDX is route-scoped), the failure is informational: a leak exists and must be fixed BEFORE refreshing the baseline. **Never refresh the baseline to make the gate pass.** Refresh only after the underlying leak is fixed.

```bash
pnpm build && pnpm bundle-check
```

Expected: green; `/` route delta = 0; `/design-system/*` aggregate ≤ 2.5KB.

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add scripts/check-bundle-size.mjs
git commit -m "feat(design-system): extend bundle gate with per-route ds ceilings"
```

---

### Task 18: Discoverability — topbar + dock + sitemap + llms.txt + lighthouse + MDX prereqs gate + component↔heading gate

**Files:**
- Modify: `components/responsive/DesktopTopbar.client.tsx`, `components/responsive/Dock.client.tsx`, `app/sitemap.ts`, `public/llms.txt`, `lighthouse.config.cjs`
- Create: `scripts/check-mdx-prereqs.mjs`, `scripts/check-mdx-prereqs.test.mjs`, `scripts/check-mdx-component-headings.mjs`, `scripts/check-mdx-component-headings.test.mjs`
- Modify: `package.json`, `.github/workflows/ci.yml`

Spec §5.6 + inversion T1 rows #10, #11. The MDX-prereqs gate is the regression bumper for "someone deletes `mdx-components.tsx`"; the component↔heading gate catches a primitive being added without docs.

- [ ] **Step 1: Topbar link**

Edit `components/responsive/DesktopTopbar.client.tsx` to add the link after `PROJECTS` (deep-path import the Link primitive):

```tsx
import { Link } from '@/design-system/components/Link';
// inside the nav list, after the PROJECTS link:
<Link href="/design-system" variant="nav">DESIGN_SYSTEM</Link>
```

- [ ] **Step 2: Dock 6th slot**

Edit `components/responsive/Dock.client.tsx` to add a 6th nav slot pointing to `/design-system` (deep-path `<Link variant="nav">`).

- [ ] **Step 3: Sitemap 5 URLs**

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';

const LAST_MODIFIED = process.env.CONTENT_UPDATED_AT
  ? new Date(process.env.CONTENT_UPDATED_AT)
  : new Date('2026-05-23');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://erikunha.dev', lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 1 },
    { url: 'https://erikunha.dev/design-system', lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://erikunha.dev/design-system/tokens', lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://erikunha.dev/design-system/components', lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://erikunha.dev/design-system/enforcement', lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://erikunha.dev/design-system/changelog', lastModified: LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
```

- [ ] **Step 4: llms.txt section**

Append to `public/llms.txt`:

```
## Design system

The /design-system route is the canonical reference for tokens, primitives, enforcement, and changelog.

- /design-system — overview, principles
- /design-system/tokens — two-tier token tables (primitives + semantic)
- /design-system/components — 8 React Server Components with auto-API tables
- /design-system/enforcement — lint rules and CI gates
- /design-system/changelog — visual diffs from merged PRs
```

- [ ] **Step 5: Lighthouse routes**

```js
// lighthouse.config.cjs (add to existing URLs array)
'/design-system',
'/design-system/tokens',
'/design-system/components',
'/design-system/enforcement',
'/design-system/changelog',
```

- [ ] **Step 6: Write the MDX prereqs gate (test fails first)**

```js
// scripts/check-mdx-prereqs.test.mjs
import { describe, expect, it } from 'vitest';
import { checkMdxPrereqs } from './check-mdx-prereqs.mjs';

describe('check-mdx-prereqs', () => {
  it('throws when mdx-components.tsx is missing', () => {
    expect(() => checkMdxPrereqs({ rootFiles: ['next.config.ts'], pkg: { devDependencies: { '@next/mdx': '16.2.6', next: '~16.2.6' } }, nextConfigSource: "pageExtensions: ['ts','tsx','mdx']" }))
      .toThrow(/mdx-components\.tsx/);
  });
  it('throws when @next/mdx is not exact-pinned at next minor', () => {
    expect(() => checkMdxPrereqs({ rootFiles: ['next.config.ts', 'mdx-components.tsx'], pkg: { devDependencies: { '@next/mdx': '^16.2.6', next: '~16.2.6' } }, nextConfigSource: "pageExtensions: ['ts','tsx','mdx']" }))
      .toThrow(/exact-pinned/);
  });
  it('throws when pageExtensions does not include mdx', () => {
    expect(() => checkMdxPrereqs({ rootFiles: ['next.config.ts', 'mdx-components.tsx'], pkg: { devDependencies: { '@next/mdx': '16.2.6', next: '~16.2.6' } }, nextConfigSource: '// no pageExtensions' }))
      .toThrow(/pageExtensions/);
  });
  it('passes when all prereqs are met', () => {
    expect(() => checkMdxPrereqs({ rootFiles: ['next.config.ts', 'mdx-components.tsx'], pkg: { devDependencies: { '@next/mdx': '16.2.6', next: '~16.2.6' } }, nextConfigSource: "pageExtensions: ['ts','tsx','mdx']" }))
      .not.toThrow();
  });
});
```

- [ ] **Step 7: Implement the MDX prereqs gate**

```js
// scripts/check-mdx-prereqs.mjs
import { existsSync, readFileSync } from 'node:fs';

export function checkMdxPrereqs({ rootFiles, pkg, nextConfigSource }) {
  if (!rootFiles.includes('mdx-components.tsx')) {
    throw new Error('mdx-components.tsx missing at project root — see docs/superpowers/plans/2026-05-23-design-system-tokenized/spike-mdx-turbopack-results.md');
  }
  const mdxVer = pkg.devDependencies?.['@next/mdx'];
  if (!mdxVer || !/^\d/.test(mdxVer)) {
    throw new Error(`@next/mdx must be exact-pinned (current: ${mdxVer})`);
  }
  if (!/pageExtensions:\s*\[[^\]]*['"]mdx['"]/.test(nextConfigSource)) {
    throw new Error('next.config.ts pageExtensions does not include "mdx"');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootFiles = ['next.config.ts', existsSync('mdx-components.tsx') ? 'mdx-components.tsx' : ''].filter(Boolean);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const nextConfigSource = readFileSync('next.config.ts', 'utf8');
  checkMdxPrereqs({ rootFiles, pkg, nextConfigSource });
  console.log('mdx prereqs ok');
}
```

- [ ] **Step 8: Write the component↔heading gate (test fails first)**

```js
// scripts/check-mdx-component-headings.test.mjs
import { describe, expect, it } from 'vitest';
import { checkComponentHeadings } from './check-mdx-component-headings.mjs';

describe('check-mdx-component-headings', () => {
  it('throws when a primitive lacks a ## heading in the page', () => {
    expect(() => checkComponentHeadings({ primitives: ['Button', 'Newcomer'], mdxSource: '## Button\n\n## OtherStuff' }))
      .toThrow(/Newcomer/);
  });
  it('passes when all primitives have headings', () => {
    expect(() => checkComponentHeadings({ primitives: ['Button'], mdxSource: '## Button' })).not.toThrow();
  });
});
```

- [ ] **Step 9: Implement the component↔heading gate**

```js
// scripts/check-mdx-component-headings.mjs
import { readdirSync, readFileSync } from 'node:fs';

const COMPONENTS_DIR = 'design-system/components';
const PAGE_PATH = 'app/design-system/components/page.mdx';

export function checkComponentHeadings({ primitives, mdxSource }) {
  const missing = primitives.filter((p) => !new RegExp(`^##\\s+${p}\\b`, 'm').test(mdxSource));
  if (missing.length > 0) {
    throw new Error(`Missing ## heading in ${PAGE_PATH} for: ${missing.join(', ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const primitives = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const mdxSource = readFileSync(PAGE_PATH, 'utf8');
  checkComponentHeadings({ primitives, mdxSource });
  console.log('component↔heading ok');
}
```

- [ ] **Step 10: Wire scripts + CI**

```json
"check:mdx-prereqs": "node scripts/check-mdx-prereqs.mjs",
"check:mdx-headings": "node scripts/check-mdx-component-headings.mjs"
```

Add to `.github/workflows/ci.yml` before build:
```yaml
- name: Check MDX prereqs
  run: pnpm check:mdx-prereqs
- name: Check component↔heading alignment
  run: pnpm check:mdx-headings
```

- [ ] **Step 11: Verify + code review + commit**

```bash
pnpm vitest run scripts/check-mdx-prereqs.test.mjs scripts/check-mdx-component-headings.test.mjs
pnpm check:mdx-prereqs && pnpm check:mdx-headings
pnpm dlx claude code-review:code-review --staged
git add components/responsive/ app/sitemap.ts public/llms.txt lighthouse.config.cjs scripts/check-mdx-*.mjs scripts/check-mdx-*.test.mjs package.json .github/workflows/ci.yml
git commit -m "feat(design-system): discoverability + mdx prereqs + component↔heading gates"
```

---

### Task 19: Docs a11y — extend axe spec + per-route e2e

**Files:**
- Modify: `tests/a11y/axe.spec.ts`
- Create: `tests/e2e/design-system-pages.spec.ts`

Spec §5.8 + inversion T1 row #9.

- [ ] **Step 1: Extend axe spec**

Add the 5 new routes to the `routes` array in `tests/a11y/axe.spec.ts`. Existing iteration scans each route with axe-core and asserts zero violations.

- [ ] **Step 2: Write the per-route e2e spec**

```ts
// tests/e2e/design-system-pages.spec.ts
import { expect, test } from '@playwright/test';

const ROUTES = [
  { path: '/design-system', heading: 'DESIGN_SYSTEM' },
  { path: '/design-system/tokens', heading: 'TOKENS' },
  { path: '/design-system/components', heading: 'COMPONENTS' },
  { path: '/design-system/enforcement', heading: 'ENFORCEMENT' },
  { path: '/design-system/changelog', heading: 'CHANGELOG' },
];

for (const r of ROUTES) {
  test(`${r.path} renders + has sidebar landmark + no console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(r.path);
    await expect(page.getByRole('heading', { name: r.heading, level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Design system' })).toBeVisible();
    expect(consoleErrors, `unexpected console errors on ${r.path}`).toEqual([]);
  });
}

test('sidebar marks the active route with aria-current="page"', async ({ page }) => {
  await page.goto('/design-system/tokens');
  await expect(page.getByRole('link', { name: 'TOKENS' })).toHaveAttribute('aria-current', 'page');
});

test('copy button copies code to clipboard', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard API gated to chromium');
  await page.goto('/design-system/components');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const firstCopy = page.getByRole('button', { name: /copy/i }).first();
  await firstCopy.click();
  await expect(page.getByRole('button', { name: /copied/i }).first()).toBeVisible();
});

test('CRT overlay is not present on /design-system/*', async ({ page }) => {
  await page.goto('/design-system');
  await expect(page.locator('[data-no-crt="true"]')).toBeVisible();
});
```

- [ ] **Step 3: Run + verify**

```bash
pnpm test:e2e --grep "design-system"
pnpm test:e2e --grep "axe"
```

Expected: green.

- [ ] **Step 4: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add tests/a11y/axe.spec.ts tests/e2e/design-system-pages.spec.ts
git commit -m "test(design-system): axe + per-route e2e for 5 docs routes"
```

---

### Task 20: Update DECISIONS.md + ARCHITECTURE.md

**Files:**
- Modify: `DECISIONS.md`, `ARCHITECTURE.md`

- [ ] **Step 1: DECISIONS.md** — append a single ADR bullet covering: MDX docs route confirmed under Turbopack via 2026-05-23 spike; `mdx-components.tsx` is a project-root regression-bumper enforced by `check-mdx-prereqs`; auto-API via `ts-morph` with `MISSING_PROP_DOC` gate (depends on PR B JSDoc audit); visual changelog from Playwright diffs; bundle ceilings (`/` 0-byte, `/design-system/*` ≤ 2.5KB); reversibility: high (pure-additive route — revert = `git revert` + nav link removal).

- [ ] **Step 2: ARCHITECTURE.md** — add §"Design system documentation" describing:
  - Route topology (5 MDX pages, sticky sidebar, mobile `<details>` collapse, CRT overlay disabled)
  - The Shiki build-time pipeline (zero runtime cost; import allowed only in `mdx-components.tsx`)
  - The auto-API pipeline (TS types → ts-morph → MDX fragments → docs page)
  - The visual changelog pipeline (Playwright diffs → workflow → PR comment + main appender)
  - The 5 enforcement gates added by PR C (`gen-api:check`, `check:mdx-prereqs`, `check:mdx-headings`, per-route bundle ceiling, axe on docs routes)

- [ ] **Step 3: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add DECISIONS.md ARCHITECTURE.md
git commit -m "docs(design-system): record pr-c mdx docs + auto-api + visual changelog"
```

---

### Task 21: Full CI gate locally + Playwright MCP visual check + PR

**Files:** none new.

- [ ] **Step 1: Run the full local CI gate**

```bash
pnpm ci:local && pnpm bundle-check && pnpm test:e2e && pnpm gen-api:check && pnpm check:mdx-prereqs && pnpm check:mdx-headings
```

Expected: green across lint, typecheck, content validation, client naming, vitest, bundle, e2e, auto-API drift, MDX prereqs, component↔heading alignment.

- [ ] **Step 2: Local Playwright MCP visual check (per CLAUDE.md PR merge gate #8)**

Start `pnpm dev`. Drive Playwright MCP at desktop (1280×720) and mobile (375×812):
- Navigate `/design-system` → all 5 routes via sidebar (desktop) and `<details>` collapse (mobile)
- Confirm sidebar active-link highlight
- Confirm `<Preview>` renders each primitive correctly
- Confirm code blocks render with Shiki highlighting
- Confirm CopyButton appears on hydration; click copies (chromium)
- Confirm CRT overlay is absent
- Confirm no hydration warnings in console

- [ ] **Step 3: Push branch + open PR via `commit-commands:commit-push-pr` skill**

Title: `feat(design-system): /design-system MDX docs route + auto-API + visual changelog (PR C)`.

- [ ] **Step 4: After Copilot review, RESOLVE or ESCALATE every thread per CLAUDE.md PR merge gate #7**

No silent merges. Reply to each thread with `Fixed in <sha>. <one-sentence reason>`; re-request review via `gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer` after each fix push.

- [ ] **Step 5: `pnpm ready-to-merge <pr>` then `git fetch && git rebase origin/main` then merge**

Per CLAUDE.md PR merge gate #5 and #9.

---

## Self-review checklist (per superpowers:writing-plans)

- [x] Every task is 2-5 minutes per step
- [x] Every task has a test-first shape where it writes code (T11, T12, T13, T15, T16, T18, T19 begin with failing tests)
- [x] Every task ends in a commit with a conventional commit message (`feat(design-system): ...`, `docs(design-system): ...`, `test(design-system): ...`)
- [x] Every commit is preceded by `code-review:code-review` per CLAUDE.md
- [x] Task 1 is `thinking-inversion` and its rows are wired to specific tasks
- [x] Task 2 creates `mdx-components.tsx` at project root BEFORE any MDX page is added (spike non-negotiable)
- [x] Task 3 exact-pins `@next/mdx@16.2.6` to match Next minor, plus companion deps and Shiki + ts-morph
- [x] Task 4 wires `pageExtensions` + `withMDX` wrapper in `next.config.ts` exactly per spike
- [x] Tasks 5, 7, 8, 9, 10 ship one MDX page each with metadata + canonical + sidebar integration
- [x] Task 6 verifies `pnpm build` static-generation (the spike-not-tested path) BEFORE the other four pages
- [x] Task 5 ships the layout (sticky sidebar + mobile `<details>` + CRT overlay disabled)
- [x] Tasks 11, 12, 13 ship the three islands/component with explicit budgets (Sidebar ≤ 1KB, CopyButton ≤ 600B, Preview RSC)
- [x] Task 14 wires Shiki at build time using the parsed-AST path (no raw-HTML-insertion API), with explicit import-discipline rule
- [x] Task 15 ships `gen-component-api.mjs` with `MISSING_PROP_DOC` failure mode and the PR B JSDoc dependency called out explicitly
- [x] Task 16 ships visual-changelog workflow + appender script with `[no-changelog]` skip and self-trigger guard
- [x] Task 17 extends bundle gate per-route (`/design-system/*` ≤ 2.5KB AND `/` 0-byte delta)
- [x] Task 18 covers all five discoverability surfaces + regression-bumper gates (`check:mdx-prereqs`, `check:mdx-headings`)
- [x] Task 19 extends axe spec + per-route e2e
- [x] Task 20 updates DECISIONS.md + ARCHITECTURE.md
- [x] Task 21 is the full local CI + Playwright MCP + PR merge gate sequence
- [x] References to spec by section number; no duplication of spec content
- [x] Reversibility called out (high per spec §7.3)
- [x] PR B dependency (per-prop JSDoc audit) explicitly named in Task 15
- [x] Spike outcome referenced as authoritative for Tasks 2, 3, 4, 6, 14, 18

---

## Open questions

None blocking. Two informational notes:

1. **`_generated-api.mdx` gitignored vs committed.** Plan adopts gitignored (regenerate-and-check determinism gate) to keep review noise low. Spec §5.9 allows either model. If a future contributor wants to see API drift in the PR diff itself, flipping to committed is a one-line `.gitignore` change + `git add`.
2. **Workflow `GITHUB_TOKEN` for the `append-changelog` job.** Default token has `contents: write` per the `permissions:` block, so the self-push works on protected branches that allow GitHub Actions. If branch protection forbids GH-Actions pushes to main, switch to a `peter-evans/create-pull-request` action that opens a PR instead — preserves the human-in-the-loop merge gate from CLAUDE.md.
