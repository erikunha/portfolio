# Visual Tweaks Part A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the seven Part A visual tweaks from `docs/superpowers/specs/2026-07-08-visual-tweaks-nav-sidebar-design.md` (A1 green-400 recolors, A2 LiveCam mobile scale-down, A3 influences size-up, A4 mobile shell chip size-up) as PR 1.

**Architecture:** className-only edits to five section components plus one client island. No logic, no new tokens, no new files. The two-token-plus-muted palette is untouched: every recolor uses the existing `text-primary-400` token (`#4ade80`). Verification is visual (Playwright MCP inspection + regenerated CI baselines) — the repo deliberately has no unit tests asserting Tailwind classes (behavioral-assertions-only policy), so no unit-test edits are required or added.

**Tech Stack:** Next.js 16 / Tailwind v4 utility classes / Playwright visual baselines.

**Architect gate:** PASS 2026-07-09, with three binding conditions absorbed below: (a) `LivePerfSection.tsx:95` sibling recolor, (b) `GuitarSection.tsx` InfluencesList lines 126 + 109 mobile-size consistency, (c) line-targeted edits only — never a file-wide replace of `text-tertiary-50` in `GitLogSection.tsx` (it styles author/date metadata that must stay gray).

## Global Constraints

- Token only: `text-primary-400`. Never raw `text-green-400`, never hex.
- Mobile changes are additive `max-md:`/`md:` variants — desktop rendering of A2/A4 must be pixel-identical.
- Where the spec writes `max-md:text-[10px]` → `max-md:text-xs` and the base class is already `text-xs`, drop the `max-md:` variant entirely (identical result, no redundant class).
- Commit per scope block (`/commit` skill before every commit); scope required by commitlint.
- Visual baselines impacted: `tests/visual/visual.spec.ts` tests 3+4 (`#sec-shell`, via A4) and test 5 (`#sec-hottest-takes`, via A1.4). Darwin + linux regen, batched into ONE push.
- Playwright MCP inspection at 1280×720 and 375×812 BEFORE baseline regen.
- 5-agent battery + `pnpm review:stamp` before push; `pnpm ready-for-pr` before `gh pr create`.

---

### Task 1: A1 — green-400 recolor (5 section files)

**Files:**
- Modify: `components/sections/LivePerfSection/LivePerfSection.tsx:59,95`
- Modify: `components/sections/AiMetricsSection/AiMetricsSection.tsx:61,72,83,94`
- Modify: `components/sections/GitLogSection/GitLogSection.tsx:60,103,147`
- Modify: `components/sections/HottestTakesSection/HottestTakesSection.tsx:41,42`
- Modify: `components/sections/UnknownsSection/UnknownsSection.tsx:34`

**Interfaces:** none — className strings only.

- [ ] **Step 1: LivePerf — both footer render sites (main + StrategyFallback loading state)**

Replace all (exactly 2 occurrences, both are the footer style group):

```
old: text-secondary-200 text-xs max-md:text-[10px] tracking-[0.14em]
new: text-primary-400 text-xs max-md:text-[10px] tracking-[0.14em]
```

- [ ] **Step 2: AiMetrics — all four metric captions**

Replace all (exactly 4 occurrences, all captions incl. "end-to-end · slowest 5% of answers"):

```
old: text-secondary-200 text-sm max-md:text-xs leading-[1.5] mt-auto
new: text-primary-400 text-sm max-md:text-xs leading-[1.5] mt-auto
```

- [ ] **Step 3: GitLog — the three commit-body spans ONLY (no file-wide replace)**

Line 60 (mobile card):

```
old: <span className="text-tertiary-50">{c.body.join(' ')}</span>
new: <span className="text-primary-400">{c.body.join(' ')}</span>
```

Lines 103 + 147 (desktop root + non-root; identical string, replace_all — exactly 2 occurrences):

```
old: <span className="text-tertiary-50">{line}</span>
new: <span className="text-primary-400">{line}</span>
```

GUARD: `text-tertiary-50` also styles author name (58/76/118), dates (82/123), role (58) and the `<pre>`/`<ul>` wrappers (167/186) — those stay unchanged. Verify with `grep -c 'text-tertiary-50' components/sections/GitLogSection/GitLogSection.tsx` → expect 7 after the edit (was 10).

- [ ] **Step 4: HottestTakes footer — container div and `>` prefix span**

Line 41:

```
old: text-primary-500 font-bold text-xs tracking-[0.06em] mt-[14px] pt-3 border-t border-primary-quiet max-[768px]:text-xs
new: text-primary-400 font-bold text-xs tracking-[0.06em] mt-[14px] pt-3 border-t border-primary-quiet max-[768px]:text-xs
```

Line 42 (disambiguate from the `$` span at line 14 by including the child):

```
old: <span className="text-primary-500 mr-1.5">{'>'}</span>
new: <span className="text-primary-400 mr-1.5">{'>'}</span>
```

- [ ] **Step 5: Unknowns footer span**

Line 34:

```
old: <span className="text-primary-500 font-bold text-xs md:text-[13px]">
new: <span className="text-primary-400 font-bold text-xs md:text-[13px]">
```

(The `-` list-marker spans at 16/28 are a different style group — unchanged.)

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm check` → expect clean. Run `pnpm lint:contrast` → expect pass (primary-400 on #000 ≈ 12:1).

- [ ] **Step 7: Commit** (via `/commit` skill)

```bash
git add components/sections/LivePerfSection/LivePerfSection.tsx components/sections/AiMetricsSection/AiMetricsSection.tsx components/sections/GitLogSection/GitLogSection.tsx components/sections/HottestTakesSection/HottestTakesSection.tsx components/sections/UnknownsSection/UnknownsSection.tsx
git commit -m "feat(sections): recolor caption/footer style groups to primary-400"
```

### Task 2: A2 — LiveCam block smaller on mobile

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.tsx:146,150,175` (`LiveCam` — shared by desktop + mobile renders)

- [ ] **Step 1: header bar (146)**

```
old: <div className="flex justify-between px-[9px] py-[6px] text-xs text-primary-400 bg-black/60 tracking-[0.12em] border-b border-[var(--color-primary-quiet)]">
new: <div className="flex justify-between px-[9px] py-[6px] max-md:px-[7px] max-md:py-1 text-xs max-md:text-[10px] text-primary-400 bg-black/60 tracking-[0.12em] border-b border-[var(--color-primary-quiet)]">
```

- [ ] **Step 2: photo container (150)**

```
old: min-h-[200px]
new: min-h-[200px] max-md:min-h-[140px]
```

(unique string in file)

- [ ] **Step 3: caption bar (175)**

```
old: <div className="px-[9px] py-[6px] text-xs text-primary-400 bg-black/65 tracking-[0.12em] border-t border-[var(--color-primary-quiet)]">
new: <div className="px-[9px] py-[6px] max-md:px-[7px] max-md:py-1 text-xs max-md:text-[10px] text-primary-400 bg-black/65 tracking-[0.12em] border-t border-[var(--color-primary-quiet)]">
```

- [ ] **Step 4: Verify + Commit** (via `/commit` skill)

Run: `pnpm typecheck && pnpm check` → clean.

```bash
git add components/sections/GuitarSection/GuitarSection.tsx
git commit -m "feat(guitar): scale live-cam block down on mobile"
```

### Task 3: A3 — Influences list bigger (proportionally)

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.tsx:32,109,121,126,130`

- [ ] **Step 1: strength bars (32)**

```
old: cls: cn('block w-[6px] h-[10px] bg-primary-500', i >= filled && 'opacity-[0.22]'),
new: cls: cn('block w-[7px] h-[12px] bg-primary-500', i >= filled && 'opacity-[0.22]'),
```

(`SignalBars` uses `w-[7px] h-[10px]` — distinct string, not touched.)

- [ ] **Step 2: header row (109) — drop the mobile 10px downgrade (architect condition b)**

```
old: <div className="flex justify-between text-xs max-md:text-[10px] text-primary-400 tracking-[0.16em] mb-3">
new: <div className="flex justify-between text-xs text-primary-400 tracking-[0.16em] mb-3">
```

- [ ] **Step 3: row container (121)**

```
old: 'text-tertiary-50 text-xs max-md:text-[10px]',
new: 'text-tertiary-50 text-xs',
```

- [ ] **Step 4: rank span (126) — architect condition b**

```
old: <span className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.1em]">
new: <span className="text-primary-400 text-xs tracking-[0.1em]">
```

- [ ] **Step 5: name span (130)**

```
old: <span className={cn('font-mono md:text-[13px]', inf.active && 'md:text-sm')}>
new: <span className={cn('font-mono md:text-sm', inf.active && 'md:text-[15px]')}>
```

- [ ] **Step 6: Verify + Commit** (via `/commit` skill)

Run: `pnpm typecheck && pnpm check` → clean.

```bash
git add components/sections/GuitarSection/GuitarSection.tsx
git commit -m "feat(guitar): enlarge influences list text and strength bars"
```

### Task 4: A4 — mobile shell command chips bigger

**Files:**
- Modify: `components/client/InteractiveShell/InteractiveShell.tsx:473` (mobile toolbar button; desktop toolbar at 443 is `!isMobile` + `max-md:hidden` — unchanged)

- [ ] **Step 1: chip className**

```
old: className="border border-[var(--color-primary-subtle)] text-primary-500 px-2 py-1 font-mono text-xs max-md:text-[10px] tracking-[0.1em] rounded-[2px] min-h-[28px] inline-flex items-center cursor-pointer bg-transparent active:bg-[var(--color-primary-quiet)]"
new: className="border border-[var(--color-primary-subtle)] text-primary-500 px-2 py-1 max-md:px-3 font-mono text-xs tracking-[0.1em] rounded-[2px] min-h-[28px] max-md:min-h-[40px] inline-flex items-center cursor-pointer bg-transparent active:bg-[var(--color-primary-quiet)]"
```

className-only diff — no logic, refs, or state in this file may change (INP-critical island).

- [ ] **Step 2: Verify + Commit** (via `/commit` skill)

Run: `pnpm typecheck && pnpm check && pnpm test --run 2>&1 | tail -5` → clean, all tests pass (InteractiveShell has behavioral tests; confirm none broke).

```bash
git add components/client/InteractiveShell/InteractiveShell.tsx
git commit -m "feat(shell): enlarge mobile command chips to 40px tap targets"
```

### Task 5: Playwright MCP visual inspection (before any test/baseline work)

- [ ] **Step 1:** `pnpm dev`, inspect at 1280×720: LivePerf footer, AiMetrics captions, GitLog bodies, HottestTakes footer, Unknowns footer green-400; LiveCam + influences + chips UNCHANGED vs pre-edit desktop.
- [ ] **Step 2:** inspect at 375×812: LiveCam visibly smaller (140px min, 10px bars); influences rows at 12px with aligned rank column, no wrap/overflow in the 36px rank column; chips ≥40px tall, no toolbar overflow.
- [ ] **Step 3:** anything unexpected → fix first (systematic-debugging), re-inspect. Only then proceed.

### Task 6: Visual baseline regen (darwin + linux, ONE commit)

- [ ] **Step 1:** Invoke `.claude/skills/visual-baseline-regen` and follow it: darwin regen against a prod build for shell (tests 3+4) + hottest-takes (test 5) across affected projects; linux regen via the `update_visual_baselines` CI dispatch + artifact download.
- [ ] **Step 2:** Inspect every changed PNG before committing (inspect-before-commit rule).
- [ ] **Step 3:** Commit (via `/commit` skill): `git add tests/visual/**` → `test(visual): regen shell + hottest-takes baselines for part-a tweaks`

### Task 7: Gates → push → PR

- [ ] **Step 1:** `pnpm ci:local` (piped, tail) → green.
- [ ] **Step 2:** Dispatch the 5-agent battery in parallel (code-commit scoping: targeted checks on the six changed files; "Do NOT make any additional commits — verification-only"). Then `pnpm review:stamp`; resolve findings via `battery-synthesis` / `pnpm review:findings` if any Critical/Important.
- [ ] **Step 3:** ONE push of all commits (baseline batch rule).
- [ ] **Step 4:** `pnpm pr-size` → expect green (small diff). `pnpm ready-for-pr` → green.
- [ ] **Step 5:** `pr-review-toolkit:review-pr` against the diff; fix Critical/Important.
- [ ] **Step 6:** `gh pr create` from `.github/pull_request_template.md` (every section filled; Visual changes = YES with baseline note) → `pnpm validate-pr-body <pr>`.

## Failure-mode checklist (from thinking-inversion)

- [x] Sites located by string, not stale line numbers (ground-truthed 2026-07-09)
- [ ] Whole style groups recolored (LivePerf:95, both HottestTakes nodes, all 3 GitLog bodies)
- [ ] No file-wide `text-tertiary-50` replace in GitLog (grep count = 7 after)
- [ ] Desktop pixel-unchanged for A2/A4 (MCP check at 1280×720)
- [ ] Mobile overflow check for A3/A4 (MCP check at 375×812)
- [ ] Baselines: darwin + linux regenerated, inspected, single push
- [ ] Battery + stamp before push

## Pre-mortem mitigations (on the plan tasks)

- [ ] P0: linux baseline dispatch must run on the SHA that contains the tweak commits — verify workflow SHA before committing artifacts (ordering per `visual-baseline-regen` skill)
- [ ] P1: desktop shell baselines must NOT diff (desktop toolbar untouched) — a desktop diff means the mobile change leaked; investigate before committing
- [ ] P1: 40px tap target is a spec-cited user decision (2026-07-08) — cite in battery dispatch; `justify` in ledger if flagged
- [ ] P1: re-run visual spec 2× locally after regen (mid-stream snapshot stability)
