# PPR Task 2.2 Completion — Design Spec

**Date:** 2026-06-13
**Status:** Approved

## Context

Task 2.2 (from the 2026-05-21 PPR spike ADR) specified: extract an async inner RSC per dual-variant section, have it call `headers()` via `getIsMobile()`, and wrap it in `<Suspense fallback={<DesktopVariant />}>`. This makes the static PPR shell include the desktop fallback; the dynamic hole fills per-request.

The implementation is complete in code (`cacheComponents: true` set, all 5 sections follow the pattern) but three documentation and test gaps remain.

## Gaps to Close

### Gap 1 — ManPageSection missing from viewport-variants test

`__tests__/section-viewport-variants.test.ts` covers GitLog, Guitar, Visa, and Projects but not ManPage. A comment in `branch-coverage-gaps.test.tsx` incorrectly claims coverage. `ManPageDesktop` also lacks a `data-testid`, making it impossible to assert its presence via `renderToStaticMarkup`.

### Gap 2 — Two missing DECISIONS.md ADR entries

1. **C2 perf fix for GuitarSection:** `GuitarSection` uses `fallback={null}` instead of `fallback={<GuitarDesktop />}`. The test file comment says "desktop fallback caused CLS on mobile" but no ADR was written. Decision must be documented so future maintainers don't treat it as a bug.

2. **Task 2.2 completion:** No ADR marks the task done. The DECISIONS.md only has the 2026-05-21 spike ADR (Task 2.1) and the deferred Task 2.2 spec. The completion needs an entry.

### Gap 3 — Inaccurate page.tsx comment

`app/page.tsx` line 13: "Only the Suspense fallback (desktop variant) is prerendered" — false for GuitarSection. Must reference the C2 ADR.

## Changes

### 1. `components/sections/ManPageSection/ManPageDesktop.tsx`
Add `data-testid="manpage-desktop"` to the root `<div className="overflow-x-auto block">`.

### 2. `__tests__/section-viewport-variants.test.ts`
Add one `it` block for ManPageSection following the same pattern as the existing four:
```ts
it('ManPageSection emits exactly the desktop variant (no mobile markup)', () => {
  const html = renderToStaticMarkup(createElement(ManPageSection));
  expect(html).toContain('data-testid="manpage-desktop"');
  expect(html).not.toContain('data-testid="manpage-mobile"');
});
```
Also add the ManPageSection import at the top of the file.

### 3. `DECISIONS.md`
Two new ADR entries under a new `## 2026-06-13 — PPR Task 2.2 completion` heading:
- **C2 GuitarSection perf fix:** `fallback={null}` rationale (CLS tradeoff), boundary (GuitarSection only, other 4 use desktop fallback), reversibility.
- **Task 2.2 complete:** Summary of the full pattern across all 5 sections, reference to the C2 fix, forward reference to this spec.

### 4. `app/page.tsx`
Update the PPR comment block (lines 6–16) to note that GuitarSection uses `fallback={null}` (see C2 ADR) rather than the desktop variant.

## What Does NOT Change

- `GuitarSection` Suspense fallback stays `null` — the C2 decision is sound.
- `DawMixerSection` also uses `fallback={null}` but for a different reason (desktop uses `next/dynamic`) — out of scope.
- No new runtime behavior. All changes are tests, comments, and documentation.

## Test Strategy

- `section-viewport-variants.test.ts` — the new ManPageSection case uses `renderToStaticMarkup` which only resolves the synchronous Suspense fallback; `next/headers` is already mocked in that file.
- Run `pnpm test --run` to verify all tests pass.
- No new E2E or visual regression tests needed — no runtime rendering change.

## Success Criteria

1. `pnpm test --run` green with the new ManPageSection viewport-variant test passing.
2. `DECISIONS.md` has both the C2 GuitarSection entry and the Task 2.2 completion entry.
3. `app/page.tsx` PPR comment accurately describes all 5 sections.
4. No runtime behavior change; `pnpm build` and `pnpm typecheck` pass.
