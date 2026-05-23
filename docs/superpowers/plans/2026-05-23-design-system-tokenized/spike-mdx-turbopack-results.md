# MDX + Turbopack Spike Results

**Date:** 2026-05-23
**Branch tested:** `docs/design-system-plans`
**Stack:** Next.js 16.2.6 (Turbopack dev), React 19.2.6, pnpm
**Purpose:** verify `@next/mdx` is viable for `/design-system/*` MDX pages before writing PR C plan
**Outcome:** **WORKS** — proceed with PR C as specified; no eject-to-TSX fallback needed

---

## Verified

`/spike` page (an MDX file under `app/spike/page.mdx`) compiled and rendered successfully under Turbopack dev with:
- Plain text + headings rendered with project fonts and signal color
- `**bold**` + `*italic*` rendered
- Markdown code fences rendered as plain `<pre><code>` (no syntax highlighting — Shiki integration is a separate concern; per spec §5.2 it is build-time only and will be wired in PR C)
- A `<div style={{...}}>` JSX block inside MDX rendered with the inline styles applied (proves JSX-in-MDX works server-side)
- Page compiled in 2.5s on first request, served on subsequent requests under 200ms
- No Pages Router fallback errors, no Turbopack-specific compile failures, no React 19 RSC incompatibility once prerequisites in place

## Required prerequisites (PR C must include these in its task list)

1. **`mdx-components.tsx` at the project root.** Next 16 + App Router looks for this file to resolve the MDX component map at compile time. Without it, the runtime falls back to Pages Router internals (`pages/_app`, `pages/_error`, `pages/_document`) and the page errors with `TypeError: createContext only works in Client Components` plus `Module ... was instantiated because it was required from module ... but the module factory is not available` on the browser side. This file must exist BEFORE the first MDX page is committed.
   ```tsx
   // mdx-components.tsx (project root)
   import type { MDXComponents } from 'mdx/types';
   export function useMDXComponents(components: MDXComponents): MDXComponents {
     return { ...components };
   }
   ```

2. **`@next/mdx` exact-pinned at the same minor as `next`.** Tested at `16.2.6` matching `next@~16.2.6`. The version drift between `next` and `@next/mdx` is a known mismatch class (different MDX provider expectations). Per project convention (CLAUDE.md "Package + manager policy"), exact-pin via `pnpm add -DE @next/mdx@16.2.6`.

3. **`pageExtensions` in `next.config.ts`** must include `mdx`:
   ```ts
   const nextConfig: NextConfig = {
     pageExtensions: ['ts', 'tsx', 'mdx'],
     // ...existing config preserved
   };
   ```

4. **`createMDX` wrapper applied to `nextConfig` BEFORE `withBundleAnalyzer`:**
   ```ts
   import createMDX from '@next/mdx';
   const withMDX = createMDX({});
   export default analyze(withMDX(nextConfig));
   ```

5. **Companion deps for the React provider path:** `@mdx-js/loader@3.1.x` + `@mdx-js/react@3.1.x` — both auto-installed as transitive deps of `@next/mdx@16.2.6` in this spike. PR C should explicitly include both in `package.json` devDependencies for clarity and exact-pin enforcement.

## App Router constraints discovered

- **Directories prefixed with `_` are private and do NOT route** under App Router. The first spike attempt at `app/_spike/page.mdx` returned 404; renaming to `app/spike/page.mdx` resolved it. PR C's routes (`/design-system`, `/design-system/tokens`, etc.) already conform — no `_` prefixes — so this is informational only.
- The `mdx-components.tsx` file lives at the **project root**, not inside `app/`. Next 16 looks for `mdx-components.{js,jsx,ts,tsx}` adjacent to `next.config.ts`. Placing it under `app/mdx-components.tsx` would NOT be picked up.

## Out-of-spike observations (logged for PR C planner)

- The `mdx-components.tsx` provider hook returns the components map unchanged in this spike. PR C will populate it with project-specific MDX-element overrides (h1/h2/h3 → styled headings using design tokens, pre/code → Shiki-wrapped blocks with the project's terminal aesthetic, a → Link primitive once PR B lands, etc.). Plan C must scope this work and call out the PR B Link dependency for the `a` override.
- Code blocks rendered as plain `<pre><code>` without highlighting — expected. PR C wires Shiki at build time per spec §5.2 (zero runtime cost). Spike did not test Shiki integration.
- The dev server occasionally surfaced a stale-module error after restarts (`Module ... was instantiated because it was required from module [hmr-entry]`). This was tied to a session in which `mdx-components.tsx` did not yet exist — the bad state persisted until a hard restart. Once the file existed, no recurrence. Plan C should document this in the contributor docs.

## Build-vs-dev not tested

Spike covered Turbopack DEV only. The spec calls for static generation of MDX at build time (Next 16 supports this for App Router MDX since 14.x). PR C should include a verification task that runs `pnpm build` against an MDX page and confirms it static-generates correctly. Not a blocker — Next's MDX support targets both dev and build paths from the same plugin.

## Plan C dependency

PR C can proceed with MDX as the documentation surface as specified. **No fallback to TSX-compiled docs is required.** The MDX+Turbopack hard gate is unblocked.

PR C's plan must explicitly include `mdx-components.tsx` creation as Task 2 (after the inversion task), BEFORE any MDX page is added. Otherwise the first push to a feature branch will break the dev server in the way documented above.
