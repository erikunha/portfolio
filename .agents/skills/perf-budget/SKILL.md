---
name: perf-budget
description: Diagnose and fix a failing or shrinking performance budget in this repository (route-js-check, bundle-check, Lighthouse CI performance, LCP, INP, CLS or TBT). Use when a performance gate fails, when a change adds a client island or dependency, or before claiming a client-side change is free. Do not use for server-only changes.
---

# Performance budget

The budgets are enforced by `pnpm route-js-check`, `pnpm bundle-check`, `lighthouserc.json`,
`lighthouserc.mobile.json` and browser tests. The Lighthouse INP audit is off; the only INP guard is
the shell input keystroke check in `tests/e2e/cross-cutting.spec.ts` (Chromium). `__tests__/lighthouse-budgets.test.ts`
fails when a Lighthouse assertion is lowered, warned or turned off. Fix the measured property. Never raise a threshold, drop an audit or hide code from a checker.

## Which gate speaks

- `pnpm route-js-check` (after `pnpm build`) reads `.next/diagnostics/route-bundle-stats.json`,
  gzips each route's first-load chunks and compares them with the per-route cap. It also prints
  the app-owned part: total minus the measured framework floor.
- `pnpm bundle-check` sums chunks globally. It cannot see one route growing while another
  shrinks, so a green `bundle-check` says nothing about a per-route regression.
- If `route-js-check` reports a route lighter than the framework floor, the floor is stale. Build a
  bare hello-world app on the current Next and React, take its shared first-load JS, and move the
  floor and the cap together. Do not lower the floor to whatever passes.

## Finding the cost

1. Run `pnpm build && node scripts/check-route-js.mjs` on the base branch and on the change; compare
   per-route totals, not the global sum.
2. Open the failing route's chunk list in `.next/diagnostics/route-bundle-stats.json` and find the
   chunk that grew. Trace which import brought it: a `*.client.tsx` file, a barrel export, a
   dependency that ships to the client.
3. Prefer the cheapest fix in this order: render the part on the server; split the island and load
   it lazily near the viewport, outside first load; replace the dependency; remove the feature.

## Rules that decide the fix

- Static sections ship zero JS. A client file is named `*.client.tsx` and justifies its weight
  against the app-owned headroom.
- The Matrix dialog loop mutates `useRef.textContent`. Moving it to per-keystroke state breaks INP.
- Vercel Speed Insights and Web Analytics are the only analytics. Do not add another script.

## Running the gates together

`pnpm gates:runtime` builds, starts a server and runs Lighthouse (advisory), axe and the Chromium
cross-cutting and observability e2e specs. `pnpm gates:runtime --skip-build` reuses an existing `.next/`.

## Evidence

Report the route, the chunk, the before and after gzipped size from `route-js-check`, and the
Lighthouse category scores, from runs you made.
