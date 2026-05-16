# Content Data Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surgical content update to align the site with the current resume — fix dates, correct AI project framing, align all title surfaces to "Senior Frontend Engineer", and sync data fields.

**Architecture:** Pure data surgery across `content/*.ts`, three section components, one layout file, and one OG image file. No schema changes, no new components, no new dependencies. All content files are Zod-validated at build time — `pnpm build` is the primary safety gate.

**Tech Stack:** TypeScript, Zod-validated content modules, Next.js App Router metadata API.

**Already done (skip):**
- `app/api/ask/route.ts` — SYSTEM prompt full rewrite (committed `b199361`)
- `app/api/erik.json/route.ts` — employer list + receipts (committed `b199361`)

---

## Files to modify

| File | Change |
|---|---|
| `content/employers.ts` | Full replace — 7 entries, corrected dates, split Encora/Zup |
| `content/projects.ts` | AI_AGENT_MESH entry only — Copilot framing, remove langchain/internal |
| `app/layout.tsx` | 8× "Staff/Principal Frontend Engineer" → "Senior Frontend Engineer" |
| `app/opengraph-image.tsx` | `alt` export + inline subtitle string |
| `components/sections/ReadmeSection.tsx` | H1 line: "Software Engineer" → "Frontend Engineer" |
| `components/sections/ManPageSection.tsx` | Two seniority strings |
| `components/sections/Hero.tsx` | sr-only h1 |
| `content/shell-commands.ts` | whoami text |
| `content/man-page.ts` | tagline + date |
| `content/npm-stack.ts` | Add EXPRESS, POSTGRES, MONGO after NODE |
| `content/now.ts` | Reading field + Updated date |

---

## Task 1: Employer history and AI project framing

**Files:**
- Modify: `content/employers.ts` (full array replace)
- Modify: `content/projects.ts` (AI_AGENT_MESH entry only)

### Why this is first
The employer array and AI project entry are the biggest accuracy risk — wrong dates and the "langchain/internal" framing are visible to anyone reading the site. Fix them first so all subsequent commits build on accurate data.

- [ ] **Step 1: Replace `content/employers.ts` with 7-entry array**

Replace the entire file content starting at line 6 (the `export const employers` declaration). Replace the full array:

```ts
// content/employers.ts
// Career history — displayed in GitLogSection as a git blame / commit log.
import { z } from 'zod';
import { type BlameEntry, BlameEntrySchema } from './schemas';

export const employers: BlameEntry[] = z.array(BlameEntrySchema).parse([
  {
    dates: '2025 → present',
    company: 'BETSSON GROUP',
    role: 'Senior Frontend Engineer',
    reason:
      'PCI-DSS cashier · 40M+ tx/yr · €1B+ ARR · micro-frontends across Angular/React/Ember via Stencil · 12-subagent Copilot system · -40% onboarding via 35-page arch knowledge system.',
  },
  {
    dates: '2023 → 2025',
    company: 'CANON MEDICAL',
    role: 'Senior Angular Engineer',
    reason:
      "Angular + Nx + Clean Architecture. -33% JS, -98% CSS, +52% TTI, ~100% WCAG 2.1 AA. Cheapest culture audit I've ever run.",
  },
  {
    dates: '2021 → 2023',
    company: 'GRUPO SBF',
    role: 'Frontend Engineer · Nike BR / Centauro',
    reason:
      '8M+ MAU storefronts. -32% page load. +10% conversion across 20+ A/B experiments. WebAR uplift on add-to-cart.',
  },
  {
    dates: '2021 → 2021',
    company: 'ENCORA (VMware Pathfinder)',
    role: 'Frontend Engineer',
    reason:
      '2.1M+ cumulative labs delivered globally. Angular, NgRx, AWS CodePipeline/CloudFront. Zoom API integration.',
  },
  {
    dates: '2020 → 2021',
    company: 'ZUP / ITAÚ BANK',
    role: 'Frontend Engineer',
    reason:
      "Brazil's largest private bank. Angular Web Components, micro-frontend architecture, regulated banking UX.",
  },
  {
    dates: '2019 → 2020',
    company: 'VENTURUS',
    role: 'Full-stack Engineer',
    reason:
      'CCR AutoBAn highway ops dashboards (Angular/RxJS) + foreign trade platform: reporting 40s → <1s, -97.5% latency via query redesign + indexing.',
  },
  {
    dates: '2018 → 2019',
    company: 'MB LABS',
    role: 'Software Engineer',
    reason:
      'Shipped EdTech as Electron desktop across 5 OSes. -80% vs native, -40% build time via Ionic + Angular consolidation.',
  },
]);
```

- [ ] **Step 2: Update AI_AGENT_MESH entry in `content/projects.ts`**

Find the `AI_AGENT_MESH` object (starts at line 60) and replace it entirely. Leave all other entries (PAYMENT_ORCHESTRA, CARE_OPS_CONSOLE, COMMERCE_EDGE, EDTECH_OMNI) untouched.

Replace this block:
```ts
  {
    name: 'AI_AGENT_MESH',
    mobileName: 'ai_agent_mesh/',
    description:
      '12-agent multi-agent system + orchestration — codegen, review, debugging, architectural validation.',
    mobileDescription:
      '12-agent AI tooling mesh at Betsson — code review, doc-gen, spec-to-PR. -40% onboarding via a 35-page architecture knowledge system. Built the agents; also watched what they ship when nobody reads the diffs.',
    stats: [
      { label: 'AGENTS', value: '12 + ORCHESTRATOR' },
      { label: 'SCOPE', value: 'TEAM-WIDE' },
      { label: 'STACK', value: 'CUSTOM TOOLING' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'claude · langchain · internal' },
      { label: 'scale', value: '12 agents · 4 teams' },
      { label: 'status', value: 'internal' },
    ],
    perm: '-rwx------',
  },
```

With:
```ts
  {
    name: 'AI_AGENT_MESH',
    mobileName: 'ai_agent_mesh/',
    description:
      'GitHub Copilot 12-subagent system — codegen, review, debugging, arch validation. Path-scoped instructions + prompt workflows, shipped team-wide at Betsson.',
    mobileDescription:
      "Copilot 12-subagent system at Betsson — code review, doc-gen, spec-to-PR. -40% onboarding via 35-page arch knowledge system. Built and maintains the agents. Also uses Claude API for personal tooling (this portfolio's shell).",
    stats: [
      { label: 'SUBAGENTS', value: '12 + ORCHESTRATOR' },
      { label: 'SCOPE',     value: 'TEAM-WIDE' },
      { label: 'STACK',     value: 'COPILOT · PATH-SCOPED' },
    ],
    mobileMeta: [
      { label: 'stack',  value: 'copilot · subagents · claude' },
      { label: 'scale',  value: '12 agents · 4 teams' },
      { label: 'status', value: 'internal' },
    ],
    perm: '-rwx------',
  },
```

- [ ] **Step 3: Build to validate Zod schemas**

```bash
pnpm build
```

Expected: `✓ Compiled successfully` with no TypeScript or Zod errors. The build calls `.parse()` on every content export — a shape mismatch throws at this step with a clear Zod error message pointing to the field.

- [ ] **Step 4: Commit**

```bash
git add content/employers.ts content/projects.ts
git commit -m "content(employers): fix dates, split Encora/Zup, merge Venturus, correct AI framing"
```

---

## Task 2: Title alignment — "Senior Frontend Engineer" across all surfaces

**Files:**
- Modify: `app/layout.tsx` (8 occurrences)
- Modify: `app/opengraph-image.tsx` (2 occurrences)
- Modify: `components/sections/ReadmeSection.tsx` (line 8)
- Modify: `components/sections/ManPageSection.tsx` (lines 36, 44, 48)
- Modify: `components/sections/Hero.tsx` (line 285)
- Modify: `content/shell-commands.ts` (whoami text)
- Modify: `content/man-page.ts` (tagline field only — date is Task 3)

### Why this is second
All identity/title surfaces must be consistent before the site is reviewed by a recruiter. This is the highest-visibility change. Batching all title surfaces into one commit makes the diff easy to audit.

- [ ] **Step 5: Update `app/layout.tsx` — 8 title occurrences**

The file has 8 occurrences of `Staff/Principal Frontend Engineer`. Use the Edit tool with `replace_all: true` to change all at once. Do NOT change the keywords array entries (`'Staff Engineer'`, `'Principal Engineer'`) — those are search terms, not identity claims.

Change: `Staff/Principal Frontend Engineer` → `Senior Frontend Engineer`

This covers:
- `metadata.title` (line 26)
- `metadata.description` (line 28)
- `metadata.openGraph.title` (line 47)
- `metadata.openGraph.description` (line 49)
- `metadata.twitter.title` (line 55)
- `metadata.twitter.description` (line 56)
- `personJsonLd.jobTitle` (line 75)
- `personJsonLd.description` (line 77)

- [ ] **Step 6: Update `app/opengraph-image.tsx` — 2 occurrences**

Change line 4 (the exported `alt` string):
```ts
export const alt = 'Erik Cunha — Senior Frontend Engineer';
```

Change line 72 (the subtitle rendered in the OG image):
```tsx
        Senior Frontend Engineer
```

- [ ] **Step 7: Update `components/sections/ReadmeSection.tsx` line 8**

Change:
```ts
  { text: '# Erik Henrique Alves Cunha — Senior Software Engineer', cls: 'h1' },
```
To:
```ts
  { text: '# Erik Henrique Alves Cunha — Senior Frontend Engineer', cls: 'h1' },
```

- [ ] **Step 8: Update `components/sections/ManPageSection.tsx` — 3 strings**

**Line 36** (DESCRIPTION paragraph, first sentence):
Change: `Senior software engineer, 8+ years.`
To: `Senior frontend engineer, 8+ years.`

Full context:
```tsx
          {`\n       Senior frontend engineer, 8+ years. Started full-stack,
```

**Line 44** (end of DESCRIPTION block — keep "through" as a range, not identity):
Change: `Senior/Staff/Principal track.\n\n`
To: `Senior through Staff/Principal track.\n\n`

Full context:
```tsx
       Senior through Staff/Principal track.\n\n`}
```

**Line 48** (OPTIONS --seniority value):
Change: `Senior through Principal\n       `
To: `Senior → Staff/Principal\n       `

Full context:
```tsx
          {'    Senior → Staff/Principal\n       '}
```

- [ ] **Step 9: Update `components/sections/Hero.tsx` line 285**

Change:
```tsx
      <h1 className="sr-only">Erik Henrique Alves Cunha — Staff/Principal Frontend Engineer</h1>
```
To:
```tsx
      <h1 className="sr-only">Erik Henrique Alves Cunha — Senior Frontend Engineer</h1>
```

- [ ] **Step 10: Update `content/shell-commands.ts` — whoami text**

Change line 13:
```ts
    text: 'erik — senior software engineer, frontend specialization',
```
To:
```ts
    text: 'erik — senior frontend engineer',
```

- [ ] **Step 11: Update `content/man-page.ts` — tagline only**

Change:
```ts
  tagline: 'senior software engineer, frontend specialization',
```
To:
```ts
  tagline: 'senior frontend engineer',
```

Leave `date` as `'2026-05-13'` — that gets updated in Task 3.

- [ ] **Step 12: Build and test**

```bash
pnpm build && pnpm vitest run
```

Expected:
- `✓ Compiled successfully`
- `54 passed (54)` — all existing tests pass, no new tests needed (pure string content changes)

- [ ] **Step 13: Commit**

```bash
git add app/layout.tsx app/opengraph-image.tsx \
        components/sections/ReadmeSection.tsx \
        components/sections/ManPageSection.tsx \
        components/sections/Hero.tsx \
        content/shell-commands.ts content/man-page.ts
git commit -m "content(title): align Senior Frontend Engineer across all surfaces"
```

---

## Task 3: Data fields — npm-stack backend tiles, now reading, man-page date

**Files:**
- Modify: `content/npm-stack.ts` (add 3 tiles after NODE)
- Modify: `content/now.ts` (Reading + Updated fields)
- Modify: `content/man-page.ts` (date field only)

### Why this is last
These are the lowest-risk changes — adding tiles to an existing array and updating two date/string values. They don't affect any title or employer data, so they're cleanest to review in isolation.

- [ ] **Step 14: Add backend tiles to `content/npm-stack.ts`**

The current array has NODE at index 4 (line 9). Add three entries immediately after it:

```ts
  { label: 'NODE',       path: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { label: 'EXPRESS',    path: 'M4 12h16M4 6h16M4 18h10' },
  { label: 'POSTGRES',   path: 'M12 3C7 3 4 6 4 9v6c0 3 3 6 8 6s8-3 8-6V9c0-3-3-6-8-6zM4 12c0 2.5 3.5 5 8 5s8-2.5 8-5' },
  { label: 'MONGO',      path: 'M12 3v18M9 5.5C9 5.5 7 8 7 12s2 6.5 5 7c3-.5 5-3 5-7s-2-6.5-5-6.5z' },
  { label: 'RXJS',       path: 'M4 6h16M4 12h10M4 18h7' },
```

(Everything after NODE shifts down three positions; the `NpmTileSchema` has no fixed-length constraint, so Zod validates shape, not count.)

- [ ] **Step 15: Update `content/now.ts` — Reading and Updated**

Change the Reading row value:
```ts
  { k: 'Reading',   v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
```

Change the Updated row value:
```ts
  { k: 'Updated',   v: '2026-05-15' },
```

Full file after changes:
```ts
import { z } from 'zod';
import { type NowRow, NowRowSchema } from './schemas';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)' },
  { k: 'Reading',   v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building',  v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated',   v: '2026-05-15' },
]);
```

- [ ] **Step 16: Update `content/man-page.ts` — date field**

Change:
```ts
  date: '2026-05-13',
```
To:
```ts
  date: '2026-05-15',
```

Full file after changes:
```ts
import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'senior frontend engineer',
  version: 'v8.0',
  date: '2026-05-15',
});
```

- [ ] **Step 17: Build and test**

```bash
pnpm build && pnpm vitest run
```

Expected:
- `✓ Compiled successfully`
- `54 passed (54)`

- [ ] **Step 18: Commit**

```bash
git add content/npm-stack.ts content/now.ts content/man-page.ts
git commit -m "content(data): npm-stack backend tiles, now reading field, man-page date"
```

---

## Verification

After all three commits, run a final sanity check:

```bash
pnpm build && pnpm vitest run
```

Spot-check in browser (`pnpm dev`) — confirm:
1. GitLog section shows 7 entries with `2025 → present` for Betsson
2. Projects section shows `COPILOT · PATH-SCOPED` under AI_AGENT_MESH stats
3. npm-stack shows EXPRESS, POSTGRES, MONGO tiles
4. Shell `whoami` returns `erik — senior frontend engineer`
5. MAN page tagline and description both say "senior frontend engineer"
6. Page `<title>` in DevTools shows `Erik Cunha — Senior Frontend Engineer`
7. `~/.now` Reading shows Chip Huyen book
