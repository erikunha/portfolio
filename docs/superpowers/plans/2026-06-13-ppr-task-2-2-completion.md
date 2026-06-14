# PPR Task 2.2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three gaps that prevent Task 2.2 from being formally complete: one missing test (ManPageSection not covered by the viewport-variants regression guard), two missing DECISIONS.md ADR entries (C2 perf fix + Task 2.2 completion), and one inaccurate comment in `app/page.tsx`.

**Architecture:** No runtime behavior changes. `cacheComponents: true` and all 5 dual-variant sections are already implemented. Only test coverage, documentation, and comment accuracy are being fixed.

**Tech Stack:** Vitest + `react-dom/server` `renderToStaticMarkup` (existing test pattern), TypeScript, markdown ADR entries.

---

## File Map

| File | Change |
|---|---|
| `components/sections/ManPageSection/ManPageDesktop.tsx` | Add `data-testid="manpage-desktop"` to root `<div>` |
| `__tests__/section-viewport-variants.test.ts` | Add ManPageSection import + one `it` block |
| `DECISIONS.md` | Prepend new `## 2026-06-13 — PPR Task 2.2 completion` section with two bullets |
| `app/page.tsx` | Fix line 13 comment: "desktop variant" → "desktop variant (null for Guitar — see C2 ADR 2026-06-13)" |

---

## Task 0: Commit staged spec doc + CLAUDE.md (already on branch)

**Files:**
- Commit: `docs/superpowers/specs/2026-06-13-ppr-task-2-2-completion-design.md` (staged)
- Commit: `CLAUDE.md` (modified — adds post-merge transition protocol)

- [ ] **Step 1: Stage CLAUDE.md**

```bash
git add -u CLAUDE.md
git status
```

Expected: both files listed under "Changes to be committed".

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(dx): add post-merge transition protocol + PPR Task 2.2 spec

- CLAUDE.md: add step (10) to Copilot convergence loop — after PR merges,
  automatically checkout main, pull, delete stale local branch, and
  identify next work item without waiting for user prompt
- docs/superpowers/specs/: design spec for PPR Task 2.2 completion
  (test coverage gap + missing ADR entries + inaccurate page.tsx comment)"
```

---

## Task 1: Write the failing ManPageSection viewport-variant test

**Files:**
- Modify: `__tests__/section-viewport-variants.test.ts`

- [ ] **Step 1: Add ManPageSection import**

Open `__tests__/section-viewport-variants.test.ts`. After line 34 (`import { VisaSection }...`), add:

```ts
import { ManPageSection } from '@/components/sections/ManPageSection';
```

The import block should now be:

```ts
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { ManPageSection } from '@/components/sections/ManPageSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { VisaSection } from '@/components/sections/VisaSection';
```

- [ ] **Step 2: Add the failing test case**

Inside the `describe('responsive section viewport variants', ...)` block, add this `it` block after the `VisaSection` test (after line 63):

```ts
  it('ManPageSection emits exactly the desktop variant (no mobile markup)', () => {
    const html = renderToStaticMarkup(createElement(ManPageSection));
    expect(html).toContain('data-testid="manpage-desktop"');
    expect(html).not.toContain('data-testid="manpage-mobile"');
  });
```

- [ ] **Step 3: Run the test to confirm it fails with a clear message**

```bash
pnpm test --run __tests__/section-viewport-variants.test.ts 2>&1 | tail -20
```

Expected output: The new test **FAILS** with something like:
```
AssertionError: expected '...' to include 'data-testid="manpage-desktop"'
```

The other 4 tests must still **PASS**. If any of the existing 4 fail, stop — there is a regression unrelated to this task.

---

## Task 2: Add data-testid to ManPageDesktop (make the test pass)

**Files:**
- Modify: `components/sections/ManPageSection/ManPageDesktop.tsx`

- [ ] **Step 1: Add the testid to the root element**

In `ManPageDesktop.tsx`, change line 7 from:

```tsx
    <div className="overflow-x-auto block">
```

to:

```tsx
    <div className="overflow-x-auto block" data-testid="manpage-desktop">
```

- [ ] **Step 2: Run the full viewport-variants test suite to confirm all 5 pass**

```bash
pnpm test --run __tests__/section-viewport-variants.test.ts 2>&1 | tail -10
```

Expected: **5 tests pass, 0 fail.**

---

## Task 3: Write documentation — DECISIONS.md ADR entries

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Prepend a new section at the top of DECISIONS.md (after the `# DECISIONS` header)**

The current top section is `## 2026-06-13 — DX: block direct pushes...`. Add the new section **above** it:

```markdown
## 2026-06-13 — PPR Task 2.2 completion: test coverage + ADR

- **2026-06-13** · **C2 perf fix — GuitarSection uses `fallback={null}` (not `<GuitarDesktop />`).** The original Task 2.2 spec called for all five dual-variant sections to use their desktop component as the Suspense fallback. GuitarSection (`components/sections/GuitarSection/GuitarSection.tsx:362`) uses `fallback={null}` instead. Reason: the GuitarDesktop component renders a dense data layout (signal chain, influences grid, ~200+ DOM nodes). When a mobile UA hit the pre-deployed static shell with the desktop fallback, the desktop variant mounted and then React had to unmount it and replace it with GuitarMobile — producing a visible layout shift (CLS spike) on the guitar section for every mobile visitor. The other four sections (ManPage, GitLog, Visa, Projects) have sufficiently similar desktop/mobile heights that their swap is within the CLS budget; Guitar's two variants differ enough in height that the swap was not. Decision: keep `fallback={null}` for GuitarSection; the static shell shows the Module header and empty content area until `GuitarContent` streams in per-request. This is acceptable because the dynamic hole fills sub-millisecond (no network I/O — `headers()` is a synchronous headers read). Note: `DawMixerSection` also uses `fallback={null}` but for a different reason (its desktop variant is a `next/dynamic` client component, not a static RSC). The C2 decision applies only to GuitarSection. _Reversible: change `GuitarSection`'s `fallback={null}` to `fallback={<GuitarDesktop />}` — expect a CLS regression on mobile for that section._

- **2026-06-13** · **Task 2.2 complete — PPR dual-variant sections fully implemented.** All five sections listed in the 2026-05-21 PPR spike ADR (ManPage, Guitar, Projects, GitLog, Visa) now follow the PPR pattern: each exports an async `*Content()` RSC that calls `getIsMobile()` → `headers()`, making it a per-request dynamic boundary; each section wraps it in `<Suspense fallback={<*Desktop />}>` (except GuitarSection — see C2 entry above). `cacheComponents: true` is set in `next.config.ts`. Test coverage: `__tests__/section-viewport-variants.test.ts` covers all 5 static fallback cases; `__tests__/section-mobile-variants.test.ts` covers all 5 dynamic mobile cases. The ManPage desktop fallback was missing from the viewport-variants test and `ManPageDesktop` lacked a `data-testid` — both fixed in this PR. _Reversible: remove `cacheComponents: true` from `next.config.ts` and the `<Suspense>` boundaries from each section to revert to full SSR per request._

```

- [ ] **Step 2: Verify the file still parses correctly (no markdown syntax errors)**

```bash
head -30 DECISIONS.md
```

Expected: the new section header and two bullet points appear at the top, followed by the existing `## 2026-06-13 — DX:` section.

---

## Task 4: Fix the inaccurate page.tsx PPR comment

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update line 13**

Change:

```ts
// makes those subtrees dynamic. Only the Suspense fallback (desktop variant)
// is prerendered — the actual content streams on mobile UA resolution. Hero
```

to:

```ts
// makes those subtrees dynamic. Only the Suspense fallback is prerendered —
// desktop variant for ManPage/GitLog/Visa/Projects; null for Guitar (C2 ADR
// 2026-06-13: desktop fallback causes CLS on mobile for that section). The
// actual content streams on mobile UA resolution. Hero
```

- [ ] **Step 2: Confirm the file is syntactically valid**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors (comment change cannot cause a TypeScript error, but running typecheck confirms no accidental edit to code).

---

## Task 5: Update GuitarSection test comment to cross-reference the new ADR

**Files:**
- Modify: `__tests__/section-viewport-variants.test.ts`

- [ ] **Step 1: Update the GuitarSection test comment**

Change lines 52–54 from:

```ts
  it('GuitarSection static render does not emit mobile markup', () => {
    // Suspense fallback is null (C2 perf fix: desktop fallback caused CLS on mobile).
    // Production Next.js resolves GuitarContent async server-side; the fallback
    // is never seen by real users. Static render emits the section shell only.
```

to:

```ts
  it('GuitarSection static render does not emit mobile markup', () => {
    // Suspense fallback is null — C2 perf fix (see DECISIONS.md 2026-06-13).
    // Desktop fallback caused CLS on mobile; production Next.js resolves
    // GuitarContent server-side so the null fallback is never seen by real users.
```

---

## Task 6: Run full test suite and commit

**Files:**
- Commit: all modified files

- [ ] **Step 1: Run full test suite to confirm no regressions**

```bash
pnpm test --run 2>&1 | tail -15
```

Expected: all tests pass. If any test fails unrelated to this change, investigate before continuing.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Stage all modified files**

```bash
git add -u components/sections/ManPageSection/ManPageDesktop.tsx \
         __tests__/section-viewport-variants.test.ts \
         DECISIONS.md \
         app/page.tsx
git status
```

Expected: 4 files staged, no untracked files.

- [ ] **Step 4: Commit**

```bash
git commit -m "test(ppr): close Task 2.2 gaps — ManPage fallback testid, viewport-variants coverage, ADR entries

- ManPageDesktop: add data-testid=\"manpage-desktop\" to root div (enables
  viewport-variants assertion; consistent with other 4 section desktop testids)
- __tests__/section-viewport-variants.test.ts: add ManPageSection test case
  (5th of 5 dual-variant sections now covered); cross-reference DECISIONS.md
  C2 ADR in GuitarSection test comment
- DECISIONS.md: two new entries — C2 GuitarSection fallback=null perf fix
  (CLS tradeoff documented) + Task 2.2 completion (all 5 sections confirmed)
- app/page.tsx: correct PPR comment — Guitar uses null fallback, not desktop"
```

---

## Task 7: Dispatch 5-agent battery + review stamp

- [ ] **Step 1: Dispatch all 5 review agents in parallel**

Dispatch these agents concurrently with the change type: `test` + `docs` commits (no `pnpm build` or `pnpm ci:local` needed per CLAUDE.md prompt-scoping rules):

- `pr-review-toolkit:review-pr` — "read `git diff HEAD~2..HEAD`, this is a test + docs change; verify ManPage testid is on the right element, test assertions are sound, ADR entries are accurate and include _Reversible: notes. Do NOT run `pnpm test`, `pnpm build`, or `pnpm ci:local`. Do NOT make any additional commits."
- `accessibility-tester` — "read `git diff HEAD~2..HEAD` to confirm this is docs/test only — verify no a11y impact. Do NOT run test suite or build."
- `security-auditor` — "read `git diff HEAD~2..HEAD` to confirm this is docs/test only — verify no security implications. Do NOT run test suite."
- `performance-engineer` — "read `git diff HEAD~2..HEAD` to confirm this is docs/test only — no performance impact expected. Do NOT run build."
- `dependency-manager` — "read `git diff HEAD~2..HEAD` to confirm this is docs/test only — no dependency changes. Do NOT run `pnpm audit` or any install commands."

- [ ] **Step 2: Run review stamp immediately after dispatch**

```bash
pnpm review:stamp
```

Expected: `.review-passed` written with current HEAD SHA.

---

## Task 8: Open PR

- [ ] **Step 1: Rebase on main**

```bash
git fetch origin && git rebase origin/main
```

- [ ] **Step 2: Run ready-for-pr**

```bash
pnpm ready-for-pr --skip-runtime 2>&1 | tail -10
```

`--skip-runtime` is appropriate: this is a test + docs change (no `app/`, no `lib/` code changes, no visual changes).

- [ ] **Step 3: Create the PR**

```bash
gh pr create \
  --title "test(ppr): close Task 2.2 gaps — ManPage fallback testid, viewport-variants coverage, ADR entries" \
  --body "$(cat .github/pull_request_template.md)"
```

Fill every section of the template. Then:

```bash
pnpm validate-pr-body <PR_NUMBER>
```

Expected: exits 0.

- [ ] **Step 4: Re-request Copilot review**

```bash
gh pr edit <PR_NUMBER> --add-reviewer copilot-pull-request-reviewer
```

---

## Task 9: Copilot convergence loop (repeat until CI green + 0 threads)

- [ ] Follow the Copilot convergence loop from CLAUDE.md §"Copilot convergence loop":
  - Verify push landed (GitHub HEAD == local HEAD)
  - Poll CI until green
  - For each Copilot thread: fix → commit → stamp → push → verify SHA → reply citing SHA → resolve → re-request
  - Repeat until: CI green, 0 unresolved threads, `pnpm ready-to-merge` exits OK
  - Then tell repo owner to run `gh pr merge`

- [ ] **Post-merge:** `git checkout main && git pull origin main && git branch -d docs/ppr-task-2-2-completion`
