# Content Data Update — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surgical content update to align the site with the current resume, fix date/employer errors, correct the AI project framing, and sync the shell knowledge base — without touching layout, components, or styles.

**Architecture:** Pure data surgery. All changes are in `content/*.ts`, three section components (hardcoded strings only), two API route files, one layout file, and one OG image file. No schema changes, no new components, no new dependencies.

**Tech Stack:** TypeScript, Zod-validated content modules, Next.js App Router metadata API.

---

## Decisions made during brainstorming

| Decision | Resolved value |
|---|---|
| Title — body | Senior Frontend Engineer |
| Title — meta/OG/JSON-LD | Senior Frontend Engineer (was Staff/Principal) |
| Employer timeline scope | 7 entries — Venturus merged, Monde omitted |
| AI project card | GitHub Copilot subagent framing, remove langchain/internal |
| Backend in npm-stack | Add EXPRESS, POSTGRES, MONGO |
| now.ts Reading | "AI Engineering · Chip Huyen — applied LLM eval in prod" |
| Updated dates | 2026-05-15 everywhere |

---

## Files to modify

| File | Change type |
|---|---|
| `content/employers.ts` | Full restructure — 7 entries, corrected dates, split Encora/Zup |
| `content/man-page.ts` | tagline + date |
| `content/now.ts` | Reading field + Updated date |
| `content/shell-commands.ts` | whoami text |
| `content/projects.ts` | AI_AGENT_MESH description, stats, mobileMeta |
| `content/npm-stack.ts` | Add EXPRESS, POSTGRES, MONGO tiles |
| `app/layout.tsx` | All "Staff/Principal" → "Senior Frontend Engineer" (9 occurrences) |
| `app/opengraph-image.tsx` | alt text |
| `app/api/ask/route.ts` | SYSTEM prompt full rewrite |
| `app/api/erik.json/route.ts` | Employer list, receipts |
| `components/sections/ReadmeSection.tsx` | Desktop H1 line only |
| `components/sections/ManPageSection.tsx` | Two hardcoded seniority strings |
| `components/sections/Hero.tsx` | sr-only h1 text |

---

## Change 1 — `content/employers.ts`

Replace the entire array with 7 entries:

```ts
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

---

## Change 2 — `content/man-page.ts`

```ts
export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'senior frontend engineer',
  version: 'v8.0',
  date: '2026-05-15',
});
```

---

## Change 3 — `content/now.ts`

```ts
export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)' },
  { k: 'Reading',   v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building',  v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated',   v: '2026-05-15' },
]);
```

---

## Change 4 — `content/shell-commands.ts`

whoami entry:
```ts
{ commands: ['whoami'], kind: 'output', text: 'erik — senior frontend engineer' },
```

---

## Change 5 — `content/projects.ts`

AI_AGENT_MESH entry (replace only this entry, leave all others untouched):

```ts
{
  name: 'AI_AGENT_MESH',
  mobileName: 'ai_agent_mesh/',
  description:
    'GitHub Copilot 12-subagent system — codegen, review, debugging, arch validation. Path-scoped instructions + prompt workflows, shipped team-wide at Betsson.',
  mobileDescription:
    'Copilot 12-subagent system at Betsson — code review, doc-gen, spec-to-PR. -40% onboarding via 35-page arch knowledge system. Built and maintains the agents. Also uses Claude API for personal tooling (this portfolio\'s shell).',
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

---

## Change 6 — `content/npm-stack.ts`

Add three entries after NODE (keep all existing entries, insert after the NODE tile):

```ts
{ label: 'EXPRESS',  path: 'M4 12h16M4 6h16M4 18h10' },
{ label: 'POSTGRES', path: 'M12 3C7 3 4 6 4 9v6c0 3 3 6 8 6s8-3 8-6V9c0-3-3-6-8-6zM4 12c0 2.5 3.5 5 8 5s8-2.5 8-5' },
{ label: 'MONGO',    path: 'M12 3v18M9 5.5C9 5.5 7 8 7 12s2 6.5 5 7c3-.5 5-3 5-7s-2-6.5-5-6.5z' },
```

---

## Change 7 — `app/layout.tsx`

Replace all 9 occurrences of `Staff/Principal Frontend Engineer` with `Senior Frontend Engineer`.

Also update the long descriptions:
- `'Staff/Principal Frontend Engineer with 8+ years...'` → `'Senior Frontend Engineer with 8+ years...'`
- Keywords array: keep `'Staff Engineer'` and `'Principal Engineer'` in the keywords list (they're search terms, not identity claims).

---

## Change 8 — `app/opengraph-image.tsx`

```ts
export const alt = 'Erik Cunha — Senior Frontend Engineer';
```

---

## Change 9 — `app/api/ask/route.ts` (SYSTEM prompt)

Replace the SYSTEM text block with a richer, accurate knowledge base:

```ts
const SYSTEM: Anthropic.Messages.TextBlockParam[] = [
  {
    type: 'text',
    text: `You are an AI proxy on Erik Cunha's portfolio site (erikunha.com.br). Answer questions about Erik concisely and accurately.

## Identity
- Senior Frontend Engineer (frontend-heavy full-stack), 8+ years
- Based in Brazil. Open to remote / relocation.
- Work auth: EU/Malta (authorized), Canada (co-op graduate), Brazil (citizen)
- Available immediately. Contact: erikhenriquealvescunha@gmail.com
- GitHub: github.com/erikunha | LinkedIn: linkedin.com/in/erikunha

## Current role
Betsson Group (Malta, EU) — Senior Frontend Engineer, 2025–present.
PCI-DSS payment/cashier platform. 40M+ transactions/year. €1B+ revenue. 15+ regulated markets.
Stack: Angular, TypeScript, RxJS, NgRx, StencilJS, React, Ember, Web Components, Nx Monorepo.
Built a 12-subagent GitHub Copilot system for the team (codegen, review, arch validation).
Authored 35-page frontend architecture knowledge system — reduced onboarding time ~40%.

## Past employers (chronological, newest first)
- Canon Medical Systems (2023–2025): Angular + Nx + Clean Architecture for hospital ops platform.
  -33% JS bundle, -98% CSS bundle, +52% TTI, ~100% WCAG 2.1 AA.
- Grupo SBF / Nike Brazil & Centauro (2021–2023): React/Next.js, 8M+ MAU.
  -32% page load, +10% conversion across 20+ A/B experiments. WebAR try-on.
- Encora / VMware Pathfinder (2021): Angular, NgRx, AWS. 2.1M+ labs delivered globally.
- Zup Innovation / Itaú bank (2020–2021): Angular Web Components, micro-frontend architecture.
  Brazil's largest bank, 70M+ customers.
- Venturus (2019–2020): Angular dashboards for highway ops + Node/PostgreSQL backend.
  Reporting endpoint: 40s → <1s (-97.5% latency).
- MB Labs (2018–2019): Cross-platform EdTech app, 5 OSes, -80% cost vs native.

## Core stack
Frontend: Angular, React, Next.js, TypeScript, RxJS, NgRx, StencilJS, Web Components
Backend: Node.js, Express, REST APIs, PostgreSQL, MongoDB
Testing: Jest, Playwright, React Testing Library, WireMock
Cloud: AWS (S3, CloudFront, CodePipeline, EC2), Docker, GitHub Actions
AI: Claude API (this portfolio), GitHub Copilot subagents (Betsson team tooling)

## Key numbers
- 40M+ transactions/year at Betsson
- €1B+ revenue platform
- 8M+ monthly users at Grupo SBF
- -97.5% API latency at Venturus (40s → <1s)
- -98% CSS bundle at Canon Medical
- +10% conversion at Grupo SBF

## Targeting
Open to: Senior, Staff, Principal, Tech Lead roles. Fintech, healthcare, platform, DX.
Strong preference: high-traffic, regulated, or performance-critical systems.

Be direct and honest. Do not fabricate information. Keep answers under 200 words unless the question demands more detail.`,
    cache_control: { type: 'ephemeral' },
  },
];
```

---

## Change 10 — `app/api/erik.json/route.ts`

Update employers list and add missing receipts:

```ts
employers: [
  { name: 'Betsson Group',          role: 'Senior Frontend Engineer', domain: 'fintech/PCI-DSS',      current: true },
  { name: 'Canon Medical Systems',  role: 'Senior Angular Engineer',  domain: 'healthcare'                          },
  { name: 'Grupo SBF',              role: 'Frontend Engineer',        domain: 'e-commerce (Nike BR)'               },
  { name: 'Encora (VMware)',        role: 'Frontend Engineer',        domain: 'consulting/enterprise'               },
  { name: 'Zup Innovation (Itaú)', role: 'Frontend Engineer',        domain: 'fintech/banking'                     },
  { name: 'Venturus',               role: 'Full-stack Engineer',      domain: 'engineering consultancy'             },
  { name: 'MB Labs',                role: 'Software Engineer',        domain: 'edtech/mobile'                       },
],

receipts: {
  tx_volume_per_year:       '40M+',
  revenue_platform:         '€1B+ ARR',
  a11y_score:               '~100/100',
  perf_delta_js:            '-33%',
  perf_delta_css:           '-98%',
  tti_improvement:          '+52%',
  page_load_reduction:      '-32%',
  conversion_uplift:        '+10%',
  api_latency_reduction:    '-97.5% (40s → <1s, Venturus)',
  onboarding_reduction:     '-40% (Betsson, arch knowledge system)',
},
```

---

## Change 11 — `components/sections/ReadmeSection.tsx`

Line 8 only:
```ts
{ text: '# Erik Henrique Alves Cunha — Senior Frontend Engineer', cls: 'h1' },
```

---

## Change 12 — `components/sections/ManPageSection.tsx`

Two strings:

**Line 36** (description block):
```ts
{`\n       Senior frontend engineer, 8+ years. Started full-stack,
```

**Line 44** (seniority flag value):
```ts
       Senior through Staff/Principal track.\n\n`}
```
(keep the "through" — the MAN page uses it as a range flag, not an identity claim)

**Line 48** (short flag):
```ts
{'    Senior → Staff/Principal\n       '}
```

---

## Change 13 — `components/sections/Hero.tsx`

Line 285:
```tsx
<h1 className="sr-only">Erik Henrique Alves Cunha — Senior Frontend Engineer</h1>
```

---

## Testing

After all changes:

```bash
pnpm build          # Zod validates all content schemas at build time — fails fast on any type error
pnpm vitest run     # All existing tests must still pass (no schema changes, no behavior changes)
```

No new tests needed — this is pure content surgery with no logic changes. The build-time Zod validation is the safety net.

---

## Commit strategy

Three commits to keep history clean:

1. `content(employers): fix dates, split Encora/Zup, merge Venturus, correct AI framing`
2. `content(title): align Senior Frontend Engineer across all surfaces`
3. `content(shell): update ask knowledge base, npm-stack backend, now/reading fields`
