# Career Content Sync — Raylu.ai (June 2026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync every surface of erikunha.dev from Betsson-current to Raylu.ai-current (06/2026), per the owner's spec + resume, with zero surfaces implying current Betsson employment.

**Architecture:** Content-only sync across Zod-validated `content/*.ts` modules, the ask-pipeline knowledge (system prompt + eval corpus/calibration), SEO/structured data, and one minimal content hoist (hero employer name). No component architecture, styling, or layout changes. Ends with a full darwin+linux visual-baseline regen (hero + hottest-takes change; git-log/projects height changes shift every baselined section below them).

**Tech Stack:** Next.js 16 RSC, Zod content schemas, Vitest, Playwright visual baselines, ai-eval harness (Vercel AI Gateway).

## Global Constraints

- Source of truth: owner spec (this session) + `/Users/erikhenriquealvescunha/Downloads/Erik_Cunha_Full_Stack_React.docx`. **No invented metrics** — qualitative slots only for Raylu work.
- Role title convention on site: `SR FRONTEND ENGINEER` (spec); resume header says "Senior Software Engineer" — flagged in PR body, spec wins.
- Do NOT change: perf-receipts numbers (ONBOARDING -40% @ Betsson stays), community/guitar/mixer sections, eval METRICS display, shell component architecture, any styling/layout.
- Bare-code policy (no prose comments) and no-magic-values rule apply to all touched code.
- Today's date literal: `2026-07-11`. Raylu start: 06/2026. Betsson tenure: 03/2025 – 05/2026.
- All content changes must pass `pnpm validate-content` (Zod, build-time).
- Betsson grep allowlist (final verification): `git-log.ts` (history commit), `man-page.ts` ("shipped at Betsson"), `perf-receipts.ts`, `unknowns.ts`, `projects.ts` (cashier + AI_AGENT_MESH cards, past tense), `hottest-takes.ts` (takes 03/07/08/09, past tense), `employers.ts` (dated 2025 → 2026 entry), `ask-eval-*`/`system-prompt.ts` (prior-role framing), shell-commands blame/history outputs if any. Zero hits may imply CURRENT employment.
- iGaming grep: zero hits anywhere after sync.

---

### Task 1: Hero — NOW: Raylu.ai + fifth chip (content hoist)

**Files:**
- Create: `content/hero.ts`
- Modify: `components/sections/Hero/Hero.tsx:34,88` (+ chip list markup, both renders)
- Modify: `content/schemas.ts` (add `HeroContentSchema`)

**Interfaces:**
- Produces: `heroContent: { currentEmployer: string; platformChip: string }` from `content/hero.ts`, Zod-parsed.

- [ ] **Step 1:** Add to `content/schemas.ts`:
```ts
export const HeroContentSchema = z.object({
  currentEmployer: z.string().min(1),
  platformChip: z.string().min(1),
});
export type HeroContent = z.infer<typeof HeroContentSchema>;
```
- [ ] **Step 2:** Create `content/hero.ts`:
```ts
import { z } from 'zod';
import { type HeroContent, HeroContentSchema } from './schemas';

export const heroContent: HeroContent = HeroContentSchema.parse({
  currentEmployer: 'Raylu.ai',
  platformChip: 'platform / headless DataTable',
});
```
- [ ] **Step 3:** In `Hero.tsx`, import `heroContent`; replace both `NOW: <b ...>Betsson</b>` with `NOW: <b ...>{heroContent.currentEmployer}</b>`; append a fifth chip rendering `heroContent.platformChip` matching the existing chip markup exactly (both desktop and mobile renders — copy the sibling chip element's classes verbatim).
- [ ] **Step 4:** Run `pnpm validate-content && pnpm typecheck && pnpm vitest run components/sections` — all green; `grep -n "Betsson" components/sections/Hero/Hero.tsx` returns nothing.
- [ ] **Step 5:** Commit: `feat(hero): NOW Raylu.ai + platform chip; hoist employer copy to content`

### Task 2: README, ~/.now, shell now-line (shared const)

**Files:**
- Modify: `content/readme.ts:6`, `content/now.ts`, `content/shell-commands.ts:32`

**Interfaces:**
- Produces: `export const NOW_CURRENTLY = 'shipping a headless DataTable platform · Raylu.ai (AI-native B2B SaaS)'` from `content/now.ts`; consumed by `shell-commands.ts`.

- [ ] **Step 1:** `readme.ts:6` → `'Brazilian 8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, global e-commerce, and AI-native B2B SaaS.'`
- [ ] **Step 2:** `now.ts`: add `export const NOW_CURRENTLY = 'shipping a headless DataTable platform · Raylu.ai (AI-native B2B SaaS)';` above `nowRows`; use it for the `Currently` row value; `Updated` → `'2026-07-11'`.
- [ ] **Step 3:** `shell-commands.ts:32`: import `NOW_CURRENTLY` from `./now` and use it as the `text` value (replaces the duplicated Betsson string).
- [ ] **Step 4:** Run `pnpm validate-content && pnpm vitest run __tests__ --silent 2>&1 | tail -3` — green.
- [ ] **Step 5:** Commit: `feat(now): Raylu current-work line shared across ~/.now and shell`

### Task 3: git-log — v9.0 RAYLU_AI HEAD commit

**Files:**
- Modify: `content/git-log.ts` (prepend entry; edit Betsson deco)

- [ ] **Step 1:** Prepend to the parsed array:
```ts
  {
    hash: 'b2e6a19f4c8d3057e1a9b6c2d8f40e73a5c1908d',
    deco: '(HEAD -> main, tag: v9.0, origin/main)',
    date: 'Mon Jun 8 09:15:00 2026 -0300',
    branch: 'career/raylu',
    type: 'career',
    company: 'RAYLU_AI',
    role: 'SR FRONTEND ENGINEER · Remote',
    body: [
      'wanted platform ownership in AI-native B2B SaaS; building',
      'a headless DataTable platform — versioned ViewState, URL-backed state.',
    ],
  },
```
- [ ] **Step 2:** Betsson entry `deco` → `'(tag: v8.0)'`.
- [ ] **Step 3:** `pnpm validate-content && pnpm vitest run components/sections/GitLogSection 2>/dev/null; pnpm vitest run __tests__ 2>&1 | tail -3` — green.
- [ ] **Step 4:** Commit: `feat(career): v9.0 RAYLU_AI head commit in git log`

### Task 4: employers.ts — Raylu entry + Betsson end date

**Files:**
- Modify: `content/employers.ts`

- [ ] **Step 1:** Prepend:
```ts
  {
    dates: '2026 → present',
    company: 'RAYLU.AI',
    role: 'Senior Frontend Engineer',
    reason:
      'Frontend platform for AI-native B2B SaaS · headless DataTable platform on TanStack Table · versioned ViewState contract · deterministic URL-backed state with codecs · pluggable view persistence · WAI-ARIA a11y standards · RFC/ADR-driven practices.',
  },
```
- [ ] **Step 2:** Betsson entry `dates` → `'2025 → 2026'`.
- [ ] **Step 3:** `pnpm validate-content` green.
- [ ] **Step 4:** Commit: `feat(career): Raylu.ai entry in employers blame log`

### Task 5: projects — DATATABLE_PLATFORM card + cashier past tense

**Files:**
- Modify: `content/projects.ts`

- [ ] **Step 1:** Add as FIRST card (schema: name, mobileName, description, mobileDescription, stats, mobileMeta, perm?):
```ts
  {
    name: 'DATATABLE_PLATFORM',
    mobileName: 'datatable_platform/',
    description:
      'Headless DataTable platform — versioned ViewState contract, URL-backed state, pluggable persistence for AI-native B2B SaaS.',
    mobileDescription:
      'Headless DataTable platform. Versioned ViewState, URL-backed state, pluggable persistence.',
    stats: [
      { label: 'CONTRACT', value: 'VERSIONED VIEWSTATE' },
      { label: 'STATE', value: 'URL-BACKED + CODECS' },
      { label: 'STACK', value: 'REACT 19 / NEXT 15 / TANSTACK' },
    ],
    mobileMeta: [
      { label: 'contract', value: 'versioned viewstate' },
      { label: 'state', value: 'url-backed + codecs' },
      { label: 'stack', value: 'react 19 · tanstack' },
    ],
    perm: 'drwxr-xr-x',
  },
```
  (Match the existing cards' mobileMeta label casing before committing — copy the sibling card's convention verbatim if it differs.)
- [ ] **Step 2:** Cashier card description: `'PCI-DSS cashier handling 40M+ transactions/yr at Betsson.'` → `'PCI-DSS cashier that handled 40M+ transactions/yr at Betsson.'` (same edit in its mobileDescription if present-tense).
- [ ] **Step 3:** `pnpm validate-content && pnpm vitest run components/sections/ProjectsSection 2>&1 | tail -3` — green.
- [ ] **Step 4:** Commit: `feat(projects): DATATABLE_PLATFORM card; cashier card to past tense`

### Task 6: man page — v9.0 + Raylu closing line

**Files:**
- Modify: `content/man-page.ts:6,7,9`

- [ ] **Step 1:** `version: 'v9.0'`, `date: '2026-07-11'`; description ending `'...Spec-driven 12-agent AI platform in production. Betsson (Malta, EU).'` → `'...Spec-driven 12-agent AI platform shipped at Betsson. Now: frontend platform, Raylu.ai (remote).'` (keep the existing line-wrap style with `\n` + spaces).
- [ ] **Step 2:** `pnpm validate-content` green.
- [ ] **Step 3:** Commit: `feat(man): v9.0 — Raylu current, Betsson historical`

### Task 7: visa — Malta honest status + languages stay in seo task

**Files:**
- Modify: `content/visa.ts` (EU MALTA row only)

- [ ] **Step 1:** EU (MALTA) row → `status: 'PRIOR_EXPERIENCE'`, `statusShort: 'PRIOR_EXP'`, `evidence: 'prior employer (Betsson, 2025–2026)'`. (Owner-authorized fallback; flag in PR for correction if authorization is retained.)
- [ ] **Step 2:** `pnpm validate-content` green.
- [ ] **Step 3:** Commit: `fix(visa): Malta row reflects prior employment, not active authorization`

### Task 8: hottest takes — tense pass (03, 07, 08, 09)

**Files:**
- Modify: `content/hottest-takes.ts:21,46,58` (line 52 already past)

- [ ] **Step 1:** Take 03 (line 21): `'On the cashier, a single Playwright trace replaces 40 brittle component tests and tells me'` → `'On the Betsson cashier, a single Playwright trace replaced 40 brittle component tests and told me'`.
- [ ] **Step 2:** Take 07 (line 46): `'Stencil at Betsson works because Angular, React, and Ember are all actually downstream'` → `'Stencil at Betsson worked because Angular, React, and Ember were all actually downstream'`.
- [ ] **Step 3:** Take 09 (line 58): `'That is how I run the 12-agent Copilot system at Betsson: every agent gates on a written spec before touching a file.'` → `'That is how I ran the 12-agent Copilot system at Betsson: every agent gated on a written spec before touching a file.'`
- [ ] **Step 4:** `pnpm validate-content && grep -n "at Betsson" content/hottest-takes.ts` — all remaining hits read as past.
- [ ] **Step 5:** Commit: `fix(takes): Betsson references to past tense`

### Task 9: SEO + structured data + hiring profile

**Files:**
- Modify: `content/seo.ts` (worksFor, description, keywords, knowsLanguage), `app/layout.tsx` (keywords if present), `lib/hiring-profile.ts:74-79`

- [ ] **Step 1:** `seo.ts` worksFor block → `{ '@type': 'Organization', name: 'Raylu.ai' }` (match existing shape exactly); description `'Currently shipping ... Betsson Group ...'` → `'Currently building the frontend platform for AI-native B2B SaaS at Raylu.ai — headless DataTable platform, versioned ViewState contract, URL-backed state.'`
- [ ] **Step 2:** Remove `'iGaming'` from keywords; add `'TanStack Table'`, `'Headless UI Platform'`, `'B2B SaaS'`. Mirror in `app/layout.tsx` keywords if a separate list exists (`grep -n "iGaming\|keywords" app/layout.tsx`).
- [ ] **Step 3:** `knowsLanguage` Spanish `A2` → `B1` (keep FR A2).
- [ ] **Step 4:** `lib/hiring-profile.ts`: Betsson entry `current: false`, dates `'2025–2026'`; add Raylu entry `current: true`, dates `'2026–present'`, title per site convention, remote.
- [ ] **Step 5:** Verify OG/Twitter descriptions name no current employer: `grep -n "openGraph\|twitter" -A4 app/layout.tsx content/seo.ts | grep -i "betsson\|raylu"` → no hits (or only the intended JSON-LD).
- [ ] **Step 6:** `pnpm validate-content && pnpm typecheck && pnpm vitest run __tests__ 2>&1 | tail -3` green; `grep -rn "iGaming" content/ app/ lib/` → zero.
- [ ] **Step 7:** Commit: `fix(seo): Raylu structured data; drop iGaming; ES B1; hiring profile current role`

### Task 10: ask pipeline knowledge — system prompt + corpus + calibration (invoke `ai-eval-update` skill first)

**Files:**
- Modify: `lib/ask/system-prompt.ts`, `content/ask-eval-corpus.ts`, `content/ask-eval-calibration.ts`

- [ ] **Step 1:** Invoke the `ai-eval-update` skill (repo rule for these files) and follow its corpus/calibration rules.
- [ ] **Step 2:** `system-prompt.ts`: "## Current role" block → Raylu.ai (Remote), Senior Frontend Software Engineer, Jun 2026–present, with 3-5 condensed resume bullets (headless DataTable platform on TanStack Table; versioned ViewState contract; deterministic URL-backed state with codecs; pluggable view persistence; WAI-ARIA a11y standards; RFC/ADR-driven practices; stack React 19/Next 15/TypeScript/TanStack). Move Betsson block to a "## Previous roles" position with dates `Mar 2025 – May 2026` (keep its facts; change tense).
- [ ] **Step 3:** Corpus + calibration: every `expect`/`idealAnswer` asserting Betsson-current → Raylu-current (Senior Frontend Software Engineer at Raylu.ai since June 2026; Betsson as prior role Mar 2025–May 2026). Format-only fixtures (stream-error sentinel tests) update employer name for consistency.
- [ ] **Step 4:** Run `pnpm vitest run __tests__ 2>&1 | tail -3` (unit layer) and, if `AI_GATEWAY_API_KEY` is available locally, `pnpm ask:eval 2>&1 | tail -10` — else state explicitly that CI's ai-eval job is the gate.
- [ ] **Step 5:** Commit: `feat(ask): sync assistant knowledge to Raylu-current; re-target eval corpus + calibration`

### Task 11: CV asset

**Files:**
- Replace: `public/erik-cunha-cv.pdf` (only if a conversion path exists)

- [ ] **Step 1:** Try `soffice --headless --convert-to pdf` (or `python3 ~/.claude/skills/docx/scripts/office/soffice.py`) on the resume docx into scratchpad; if LibreOffice is unavailable → **flag loudly in the PR body: stale CV ships unless owner provides the PDF export** and skip Steps 2-3.
- [ ] **Step 2:** Read the produced PDF visually; if formatting is broken, flag instead of shipping.
- [ ] **Step 3:** Replace `public/erik-cunha-cv.pdf`, commit: `feat(cv): updated resume export (Raylu)` — noting in the body it is a LibreOffice conversion pending owner's designed export.

### Task 12: visual baselines — full regen (darwin + linux), batched into ONE final push

**Files:**
- Modify: `tests/visual/visual.spec.ts-snapshots/*` (hero, hottest-takes certain; contact/shell likely via offset shift)

- [ ] **Step 1:** Follow `.claude/skills/visual-baseline-regen`: `pnpm build`, `DEPLOY_SALT=test pnpm start`, regen all four browser projects on `tests/visual/visual.spec.ts` with `--update-snapshots`.
- [ ] **Step 2:** Inspect EVERY changed PNG (Read) before staging — content must match the new copy, no rendering damage.
- [ ] **Step 3:** Dispatch `gh workflow run "CI" -f update_visual_baselines=true --ref <branch>`, download `visual-baselines-*` artifacts, copy each project's own changed `*-linux.png`, inspect.
- [ ] **Step 4:** Commit darwin+linux together: `test(visual): regen baselines for career-sync copy changes`.

### Task 13: verification + PR

- [ ] **Step 1:** `pnpm build && grep -ri "betsson" .next/server/app --include='*.html' -l | head` — then inspect each hit against the allowlist; `grep -ri "iGaming" .next/ | head` → zero.
- [ ] **Step 2:** `pnpm ci:local` green; `pnpm ready-for-pr` (includes gates:runtime).
- [ ] **Step 3:** 5-agent battery + `pnpm review:stamp`; push (single push incl. baselines).
- [ ] **Step 4:** PR from template; description groups every change by site section (spec requirement) + flags: CV status, visa PRIOR_EXPERIENCE assumption, resume-vs-spec title discrepancy, LAIbemage/OSS-contribution candidates logged not added. `pnpm validate-pr-body`, `/claude-review`.

### Task 14 (SEPARATE, after PR is open): PageSpeed mobile 81 investigation

- [ ] Own branch/commit per spec — profile mobile run (suspects: guitar-section images, mixer widgets, PSI variance vs lab), fix or ADR-accept. Never merged into a content commit.

## Failure-mode checklist (thinking-inversion → tasks)

1. Any surface still Betsson-current after sync → Task 13 grep + enumerated allowlist.
2. ask-eval gate red from prompt/corpus drift → Task 10 updates all three files coordinately; ai-eval-update skill; local/CI eval run.
3. Zod violation on new entries → every task runs `pnpm validate-content`.
4. Visual baselines stale (hero text/chip, takes tense, offset shifts from git-log/projects height) → Task 12 full regen, inspect-before-commit, one push.
5. Duplicated now-line drifting again → Task 2 shared `NOW_CURRENTLY` const.
6. Content inlined in TSX (hero) → Task 1 hoists to `content/hero.ts`.
7. Stale CV shipping silently → Task 11 flag-loudly path.
8. Invented metrics → Global Constraints; qualitative stat slots only.
9. JSON-LD/hiring-profile contradicting page → Task 9.
10. Chip addition breaking hero layout/CLS → Task 12 inspect hero baselines at all viewports; chip uses existing markup.
