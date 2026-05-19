# Mobile LCP Strict 1800ms Campaign Spec — Design

> Validated through `superpowers:brainstorming` 2026-05-19. Closes the largest documented budget miss in CLAUDE.md: mobile LCP measured at 3069ms vs the locked 1800ms target (1.7x over). Supersedes the informal "Perf-Fix #2" follow-up filed in DECISIONS.md 2026-05-19 under Spec 1.5 mobile LHCI ship.

## 1. Goal

Drive mobile Lighthouse LCP from the calibrated 3069ms baseline (median of 3 runs against Vercel preview on simulated 4G + 4x CPU) to the CLAUDE.md-locked 1800ms target, then re-tighten the mobile LHCI gate to that target. Ship as a measurement-gated campaign of one-contributor-per-PR.

## 2. Non-goals

- Desktop LCP (already passes; gate stays where it is).
- Real-user-monitoring (RUM) optimization as a primary metric. Vercel Speed Insights stays on as an informative signal; the Lighthouse synthetic on Moto G4 + 4G + 4x CPU is the gate.
- Re-evaluating the locked stack. No framework swap, no edge runtime change, no CSS architecture rewrite beyond what individual PRs require.
- INP / CLS optimization. They pass already; this spec touches them only if a fix in this campaign regresses them.
- Routing changes. Single-page composition stays.

## 3. Background context

### Current state

| Metric | Mobile measured | Mobile target | Gap |
|---|---|---|---|
| LCP | 3069ms (median, 3 runs) | 1800ms | -1271ms |
| CLS | passes | 0.05 | within budget |
| INP | passes | 200ms | within budget |
| Performance score | 0.9 (calibrated gate) | 0.95 | -0.05 |

The current gate at `lighthouserc.mobile.json` is calibrated at 3400ms LCP + 0.9 Performance, set in PR #20 to match the measured baseline (see DECISIONS.md "2026-05-19 - Spec 1.5 Mobile LHCI ship").

### What's already in place

- **Inline critical CSS** in `app/layout.tsx` (PR #10): tokens, base, hero, layout above-fold. Drift-protected by `__tests__/critical-css-drift.test.ts`.
- **Hero RSC**: above-fold hero rendered server-side, zero JS for first paint.
- **SSR UA mobile branching** (PR #26): only the matching desktop or mobile DOM tree renders; eliminated ~440 hidden mobile nodes on desktop runs and vice versa.
- **`react/cache` memoization** of UA detection across the request (PR #26).
- **27% CSS reduction** from removing Tailwind v4 (2026-05-18).

### Why this is hard

`app/layout.tsx:90` documents the constraint: `import './globals.css'` always emits a blocking `<link>` under Next 15's CSS pipeline. The inline critical CSS reaches the parser earlier in the HTML stream but cannot unblock the link itself. Closing 1271ms therefore requires more than one fix.

### Why a single PR is the wrong shape

A 1271ms gap is too large to attribute to one contributor. Real-world LCP composition (per typical Lighthouse breakdown for this kind of site) is roughly:

- TTFB: 100-300ms
- Server response + HTML download: 200-500ms
- Render-blocking CSS: 200-600ms
- Render-blocking JS (none significant here)
- Font loading: 100-500ms (FOIT/FOUT delay against the LCP text element)
- LCP element render delay: 50-200ms

Numbers above are typical ranges, not this site's measured contributors. **Task 0** (below) replaces them with the actual breakdown.

## 4. Validated design decisions (from brainstorming)

| Question | Decision |
|---|---|
| Success target | Strict 1800ms mobile LCP (no soft target, no best-effort) |
| Delivery shape | Measurement-gated multi-PR campaign, one contributor per PR |
| Gate ratchet | After each PR merges, lower `largest-contentful-paint` threshold in `lighthouserc.mobile.json` to (new measured median + ~5% safety margin) |
| Discovery as Task 0 | Yes - run fresh Lighthouse on Vercel preview, extract LCP element + contributor backlog before specing fixes |
| CSS-in-JS as a tool | Out. Rejected per CLAUDE.md "things considered and rejected". |
| Route-specific CSS chunks | Out. Single-page composition means there's only one route to chunk. |
| Hard stop circuit-breaker | 6 PRs OR 4 weeks, whichever hits first. After that, re-calibrate via ADR with residual-gap analysis. |

## 5. Architecture

The campaign is a sequence of independently-shippable PRs, each addressing one named LCP contributor, with measurement-and-ratchet between every PR.

```
  +---------------+        +-------------------+        +-----------------+
  |   Task 0:     |  ----> | Task 1..N:        |  ----> | Final           |
  |   Discovery   |        | One contributor   |        | calibration PR  |
  |               |        | per PR, measure   |        | (gate = 1800ms) |
  |               |        | and ratchet gate  |        | or residual ADR |
  +---------------+        +-------------------+        +-----------------+
         |                          ^
         v                          |
  Ranked backlog                    |
  of contributors                   |
  (loops back to                    |
  re-prioritize)                    |
         +--------------------------+
```

The campaign is data-driven from Task 0 onward. The PR sequence below is the **best current guess**; Task 0's output may re-rank them.

### How this spec is executed

This is a **campaign spec**, not a single-PR spec. `superpowers:writing-plans` is invoked once per executable phase, not once for the whole campaign:

1. First invocation: produces an implementation plan for **Task 0 (Discovery)** only.
2. After Task 0 commits its findings to section 12 of this spec, the spec is re-read and `writing-plans` is invoked again to produce the plan for PR-1.
3. After PR-1 merges and ratchets the gate, the cycle repeats for PR-2, and so on.

This keeps every implementation plan small (one PR's worth of work) and data-informed by the previous PR's measurement.

## 6. Task 0 - Discovery

### Purpose

Replace this spec's "likely contributors" guesses with actual measured contributors so subsequent PRs are scoped against real data, not assumptions.

### Inputs

- Current main HEAD (latest merge: PR #27 `a70ead4`)
- Vercel preview deployment of main HEAD
- `lighthouserc.mobile.json` (existing config; 3 runs, simulated 4G + 4x CPU on Moto G4)

### Steps

1. Trigger Vercel preview deployment of current main (manual deploy or push an empty discovery branch).
2. Run `pnpm lhci:mobile` with the preview URL as the target. Three runs, median sampling per existing config.
3. Save the JSON reports to `.lighthouseci/` and extract:
   - `audits.largest-contentful-paint.numericValue` (median across runs)
   - `audits.largest-contentful-paint-element.details.items[0]` - the LCP element node
   - `audits.largest-contentful-paint.details.items[0].subItems` - render delay + load delay breakdown
   - `audits.render-blocking-resources.details.items[*]` + their `wastedMs`
   - `audits.font-display.details.items[*]` + any failing font URLs
   - `audits.preload-fonts.score`
   - `audits.server-response-time.numericValue`
   - `audits.unused-css-rules.details.overallSavingsBytes` and `.wastedPercent`
   - `audits.unused-javascript.details.items[*]` (already known from PR #26)
   - `audits.uses-text-compression.score`
   - `audits.uses-rel-preload.score`
   - `audits.critical-request-chains` for the critical chain depth

### Outputs

A **ranked contributor backlog** appended to this spec as section 12 (post-discovery), containing:

| Rank | Contributor | Measured contribution | Estimated savings | Proposed fix | Risk |
|---|---|---|---|---|---|
| 1 | (e.g.) globals.css render-blocking | 600ms wasted on critical chain | 400-600ms | preload+onload swap | FOUC below fold |
| 2 | ... | | | | |

The backlog becomes the PR sequence. Each row becomes Tasks 1..N below.

### Exit criterion

Task 0 is done when section 12 of this spec is filled in and committed, and the ranked backlog has at least 3 contributors with non-zero estimated savings (otherwise the LCP gap is mysteriously composed of small-cuts and the campaign shape may need to change).

## 7. PR template (Tasks 1..N)

Every campaign PR follows this template:

### 7.1 Per-PR scope

- One contributor from the backlog.
- One LHCI gate ratchet (or zero, if measurement shows no improvement and we decide to abandon that contributor).
- One DECISIONS.md bullet documenting hypothesis, measured contribution, fix, post-fix measurement, and gate update.

### 7.2 Per-PR sequence

1. **Hypothesis**: state the contributor and its measured contribution from Task 0 (or post-fix data from earlier in the campaign).
2. **Implementation**: smallest possible change that addresses the contributor.
3. **Tests**:
   - Existing visual regression suite (4-project matrix) must stay green - catches FOUC.
   - Existing critical-CSS drift test must stay green.
   - Add unit tests only where new logic is introduced.
4. **Measurement on Vercel preview**:
   - 3 Lighthouse mobile runs against preview URL via `pnpm lhci:mobile` (locally), or fresh CI run on the PR's preview deployment.
   - Record median LCP pre and post.
5. **Gate ratchet**: update `lighthouserc.mobile.json` `largest-contentful-paint` `maxNumericValue` to (post-fix median + 5% safety margin). Performance-score gate stays unless post-fix median bumps it.
6. **ADR**: one bullet in DECISIONS.md following the established 2026-05-19 pattern.

### 7.3 Per-PR acceptance criteria

- Median post-fix LCP is **lower than pre-fix median** by at least 50ms (otherwise the change isn't producing measurable improvement, even after variance).
- LHCI mobile gate stays green on the new threshold (within the PR's CI run).
- Visual regression matrix stays green.
- No new biome / typecheck / vitest errors.

If a PR's measurement shows no improvement, the PR may still merge **without a gate ratchet** - the implementation may be a prerequisite for a later fix in the chain. But it must explicitly state this in the commit message and DECISIONS.md.

## 8. Likely PR sequence (pre-Task-0 estimate; data-driven after)

This is the best guess based on what's documented; Task 0 may re-rank.

### PR-1: CSS defer (`preload+onload swap` on `globals.css`)

- **Hypothesis**: `import './globals.css'` emits a blocking `<link>`; deferring it via `<link rel="preload" as="style" onload="this.rel='stylesheet'">` unblocks the rendering pipeline.
- **Implementation sketch**: 
  - Remove `import './globals.css'` from `app/layout.tsx`.
  - Emit `globals.css` to `public/` as part of the build (either via a build script, or by using `next/font/local`-style asset emission, or by manually placing the compiled CSS - investigate during PR-1).
  - Add `<link rel="preload" as="style" href="/globals.css" onload="this.rel='stylesheet'">` plus `<noscript>` fallback in `app/layout.tsx`.
  - Critical CSS inline stays (it carries first-paint).
- **Expected savings**: 200-600ms (variance high; Task 0 narrows).
- **Primary risk**: FOUC on below-fold sections as `globals.css` loads. Visual regression matrix catches this; if it flakes too hard, expand inline critical CSS to cover more.

### PR-2: Font loading optimization

- **Hypothesis**: `next/font/local` loads JetBrains Mono and Geist Black. If either is on the LCP text element's critical path, font swap delay contributes to LCP.
- **Implementation sketch**:
  - Verify `font-display` strategy on each font (`optional`, `swap`, `fallback`, or `block` - already shipped 2026-05-19 `display:optional` change for CLS reasons; confirm not regressing).
  - Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the font on the LCP element.
  - Consider subsetting the display font (Geist Black) to the actual glyphs used in "THE MATRIX HAS YOU." headline.
- **Expected savings**: 100-400ms.
- **Primary risk**: Subsetting risks missing glyphs if content changes. Add a content-grep test that asserts the subset covers all rendered display-font glyphs.

### PR-3: LCP element render path

- **Hypothesis**: depends on Task 0. If the LCP element is the boot animation, deferring its hydration may help. If it's a text element rendered by a client island, converting to RSC may help.
- **Implementation sketch**: Task-0-driven.
- **Expected savings**: 50-300ms.
- **Primary risk**: behavior regressions; visual regression + Vitest suite catch.

### PR-4: JS hydration deferral

- **Hypothesis**: even with RSC, client islands hydrate after first paint; the hydration burst on a 4x-CPU mobile may extend LCP if the LCP element is mounted by a client island.
- **Implementation sketch**: profile each island's hydration cost; defer non-critical islands via `dynamic({ ssr: false })` or `next/dynamic` patterns; consider splitting bundle further.
- **Expected savings**: 50-200ms.
- **Primary risk**: client-only fallback content (motion indicator, matrix dialog) may flicker. Acceptance test: visual regression + manual smoke.

### PR-5: TTFB / Vercel region

- **Hypothesis**: Vercel preview routes via the closest edge node; if measurement runs from a region distant from the edge, server-response-time inflates.
- **Implementation sketch**: confirm Vercel edge region configuration; consider `vercel.json` region pinning; verify that `headers()` calls (used for SSR UA branching) don't add measurable overhead.
- **Expected savings**: 50-200ms.
- **Primary risk**: region pinning can hurt users in other regions. Need RUM data (Vercel Speed Insights) to validate global impact.

### PR-6 (contingency): CRT compositing layer

- **Hypothesis**: layered fixed-position effects (scanlines, sub-pixel mask, grain, scan beam, flicker) form a top compositing layer that can defer paint of the LCP element if `will-change` / `transform` boundaries are misaligned.
- **Implementation sketch**: Task-0-driven; only ship if Task 0 implicates effects.
- **Expected savings**: 0-200ms.
- **Primary risk**: aesthetic regression; the CRT effects are core to the brand. Reduce, never remove. Visual regression catches.

## 9. Gate ratchet strategy

After each PR merges, the **next** PR (or a tiny "ratchet-only" PR) updates `lighthouserc.mobile.json`:

```json
{
  "assertions": {
    "largest-contentful-paint": ["error", { "maxNumericValue": <new_median_plus_5_percent> }]
  }
}
```

The ratchet is **down-only** (never up). If post-fix median is higher than pre-fix median, the PR doesn't ratchet (and explains in DECISIONS.md why the fix still merged - usually because it's a prereq for a chained fix).

### Why ratchet incrementally and not set to 1800ms upfront

Setting the gate to 1800ms upfront means every PR-1 through PR-(N-1) is "fixing a CI-failing build" - intolerable UX. The incremental ratchet gives every PR a green-CI shipping experience while still pushing the floor down.

### Why a 5% safety margin

Lighthouse run-to-run variance on synthetic mobile is typically ±150ms even with median-of-3. A 5% margin (~100-150ms at this LCP range) absorbs noise without giving up too much budget.

## 10. Stopping conditions

### Success: gate at 1800ms

- Mobile LHCI gate at `maxNumericValue: 1800` (or lower, with safety margin)
- Green CI on 3 consecutive runs against latest main
- Final calibration PR records the journey in DECISIONS.md and closes the spec

### Convergence without success: residual gap

If after addressing all backlog contributors, the gate floor stabilizes above 1800ms:

- Run a final 3-run measurement, record the floor and per-contributor savings
- Write a residual-gap ADR in DECISIONS.md explaining:
  - What we shipped
  - What we tried that didn't move the number
  - The residual contributor(s) we can't address without architectural change
  - Recommended escape hatches (Vercel hardware bump, image format support, etc.) with cost estimates
- Close the spec with the gate calibrated to the new floor + safety margin, and re-open the CLAUDE.md budget conversation as a separate decision

### Circuit breaker: 6 PRs or 4 weeks

If we hit 6 campaign PRs without reaching 1800ms, or 4 calendar weeks elapse since this spec is committed, force a re-calibration ADR with the same residual-gap analysis as above. Prevents the campaign from dragging.

## 11. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Lighthouse run-to-run variance | `numberOfRuns: 3` median sampling + 5% gate safety margin |
| FOUC after CSS defer if critical CSS insufficient | 4-project visual regression matrix + critical-CSS drift Vitest; expand critical CSS inline if needed |
| Visual regression false positives from CRT layer changes | Existing volatile-mask infrastructure (`tests/e2e/_helpers/volatileMasks.ts`); add masks per-PR if needed |
| Font preload competing with other resources | Task 0 measures; each PR measures pre/post; sequence by data not assumption |
| LCP element changes mid-campaign | Task 0 + post-PR remeasurement detects this; if LCP element shifts, re-rank backlog |
| Mobile-only fix regresses desktop | Existing `lighthouserc.json` (desktop) gate catches; CI runs both |
| Subsetting font misses a glyph as content changes | Content-grep test asserts subset coverage |
| Region pinning helps Lighthouse but hurts global RUM | Vercel Speed Insights data review before merging PR-5 |
| Gate ratchet creates flakey CI as variance fluctuates | 5% safety margin; if a green PR flakes red within a week, widen the margin temporarily and document |
| Campaign drags beyond 4 weeks | Hard circuit breaker (section 10) |

## 12. Discovery findings (TBD - filled by Task 0)

_To be populated as the first action of this campaign. Until then, all PR sequencing in section 8 is provisional._

| Rank | Contributor | Measured contribution | Estimated savings | Proposed fix | Risk |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |

## 13. Out-of-spec follow-ups

- Re-tighten `errors-in-console` LHCI assertion to `error` (filed in DECISIONS.md 2026-05-19; PR #21 fixed the source, gate stays warn until a separate cleanup PR). Not in this campaign.
- Address dom-size score floor of 0.5. Documented as architecturally unreachable for an 18-section portfolio (DECISIONS.md 2026-05-19); not in scope.
- Address unused-javascript framework bootstrap. Documented as Next App Router structural; not in scope.

## 14. Related docs

- `CLAUDE.md` section "Performance budgets" - the locked 1800ms target this campaign honors
- `DECISIONS.md` 2026-05-19 entries under "Spec 1.5 Mobile LHCI ship" - the calibrated 3400ms gate this campaign replaces
- `lighthouserc.mobile.json` - the gate config this campaign ratchets
- `docs/superpowers/specs/2026-05-18-mobile-lcp-perf-fix-design.md` - the earlier (Spec 1) mobile LCP design that shipped inline critical CSS and Hero RSC
- `tests/e2e/visual.spec.ts` + snapshots - the visual regression matrix that catches FOUC
- `__tests__/critical-css-drift.test.ts` - the critical CSS drift gate
