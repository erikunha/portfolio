# SEO & Marketing 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate a unified "Staff Full-Stack Engineer · Applied AI" identity across all discovery and conversion surfaces — JSON-LD schema, llms.txt, hero stat bar, metadata, OG image, sitemap, and robots.txt.

**Architecture:** Content-first — `content/seo.ts` holds the JSON-LD object; `content/perf-receipts.ts` holds hero stat data. Two new RSC components (`HeroStats`) consume content exports. All other changes are single-file edits with no new abstractions.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Zod (content validation) · Vitest + `renderToStaticMarkup` (tests) · hand-rolled CSS in `app/css/_layout.css`

---

## File Map

| File | Action | Reason |
|---|---|---|
| `content/seo.ts` | **Create** | Typed JSON-LD Person schema — content discipline (no copy in JSX) |
| `content/perf-receipts.ts` | **Modify** | Add `heroStats` export (4 above-fold stats) |
| `components/HeroStats.tsx` | **Create** | RSC that renders 4-stat grid from `heroStats` |
| `components/sections/Hero.tsx` | **Modify** | Render `<HeroStats />`, update tagline copy |
| `app/css/_layout.css` | **Modify** | Add `.hero-stats` grid styles |
| `app/layout.tsx` | **Modify** | Update title, description, keywords, OG, Twitter; import JSON-LD from `content/seo.ts` |
| `app/opengraph-image.tsx` | **Modify** | Update `alt` export + subtitle string |
| `app/sitemap.ts` | **Modify** | Dynamic `lastModified: new Date()` |
| `public/robots.txt` | **Modify** | AI bot allowlist + verify Sitemap directive |
| `public/llms.txt` | **Replace** | Full 120-line structured overhaul |
| `__tests__/HeroStats.test.ts` | **Create** | Structural + a11y tests for HeroStats RSC |

---

## Task 1: `content/seo.ts` — Person schema data

**Files:**
- Create: `content/seo.ts`
- Modify: `app/layout.tsx` (import + replace inline object)

- [ ] **Step 1: Create `content/seo.ts`**

```ts
// content/seo.ts
// JSON-LD Person schema — sourced here, consumed by app/layout.tsx.
// No Zod: this is static config, not user-facing content. pnpm typecheck is the gate.

export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Erik Henrique Alves Cunha',
  alternateName: 'Erik Cunha',
  jobTitle: 'Staff Full-Stack Engineer · Applied AI',
  url: 'https://erikunha.dev',
  email: 'erikhenriquealvescunha@gmail.com',
  telephone: '+5519998394086',
  knowsLanguage: [
    { '@type': 'Language', name: 'Portuguese', alternateName: 'Native' },
    { '@type': 'Language', name: 'English', alternateName: 'C1' },
    { '@type': 'Language', name: 'French', alternateName: 'A2' },
  ],
  nationality: { '@type': 'Country', name: 'Brazil' },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Campinas',
    addressRegion: 'São Paulo',
    addressCountry: 'BR',
  },
  sameAs: [
    'https://linkedin.com/in/erikunha',
    'https://github.com/erikunha',
  ],
  worksFor: {
    '@type': 'Organization',
    name: 'Betsson Group',
    url: 'https://www.betssongroup.com',
  },
  description:
    'Full-Stack Engineer with 8+ years specializing in Applied AI systems and high-scale production architecture. Currently shipping LLM, RAG, and multi-agent features at Betsson Group (PCI-DSS, €1B+ ARR, 40M+ transactions/yr). Impact across e-commerce (8M+ MAU), banking (70M+ customers), and healthcare. Track record: -97.5% API latency, -98% CSS bundle, -52% TTI. Staff/Principal-track, targeting AI-forward product companies worldwide.',
  knowsAbout: [
    'LLM Engineering',
    'Retrieval-Augmented Generation (RAG)',
    'Generative AI',
    'Multi-Agent Orchestration',
    'AI Application Architecture',
    'Anthropic Claude',
    'Prompt Engineering',
    'Prompt Caching',
    'Streaming LLM Responses',
    'Function Calling',
    'Context Window Management',
    'LLM Cost Optimization',
    'AI Evaluation',
    'TypeScript',
    'TypeScript Strict Mode',
    'React 19',
    'React Server Components',
    'Next.js App Router',
    'Angular',
    'RxJS',
    'NgRx',
    'Redux',
    'StencilJS',
    'Web Components',
    'Vue.js',
    'Ionic',
    'SSR/SSG',
    'Micro-Frontend Architecture',
    'Node.js',
    'Express.js',
    'REST API Design',
    'WebSocket',
    'Python',
    'Docker',
    'AWS',
    'Amazon S3',
    'CloudFront',
    'AWS CodePipeline',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'SQL',
    'Rate Limiting Architecture',
    'Backend for Frontend (BFF)',
    'Clean Architecture',
    'Domain-Driven Design (DDD)',
    'Nx Monorepo',
    'Component-Driven Architecture',
    'PCI-DSS Systems',
    'Financial Technology',
    'Healthcare Technology',
    'iGaming',
    'Banking Technology',
    'E-commerce Platforms',
    'EdTech',
    'Performance Engineering',
    'Core Web Vitals',
    'Web Accessibility (WCAG 2.1 AA)',
    'ARIA',
    'CI/CD Pipelines',
    'GitHub Actions',
    'Test-Driven Development',
    'Playwright',
    'Jest',
    'React Testing Library',
    'MSW',
    'Edge Computing',
  ],
  hasOccupation: {
    '@type': 'Occupation',
    name: 'Full-Stack Software Engineer',
    occupationLocation: { '@type': 'City', name: 'Remote / Worldwide' },
    skills:
      'TypeScript, React, Angular, Next.js, Node.js, Python, LLM Engineering, RAG, Multi-Agent Systems, PCI-DSS, AWS, Docker, Performance Engineering',
    experienceRequirements: '8+ years',
  },
  alumniOf: [
    {
      '@type': 'CollegeOrUniversity',
      name: 'Cornerstone International Community College of Canada (CICCC)',
      address: { '@type': 'PostalAddress', addressLocality: 'Vancouver', addressCountry: 'CA' },
    },
    {
      '@type': 'CollegeOrUniversity',
      name: 'Centro Universitário Salesiano de São Paulo (UNISAL)',
      address: { '@type': 'PostalAddress', addressLocality: 'Campinas', addressCountry: 'BR' },
    },
  ],
  hasCredential: [
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Angular Developer Certification',
      credentialCategory: 'certification',
      recognizedBy: {
        '@type': 'Organization',
        name: 'Alain Chautard — Google Developer Expert, Angular',
      },
    },
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Verified International Academic Qualifications',
      credentialCategory: 'certification',
      recognizedBy: { '@type': 'Organization', name: 'World Education Services (WES)' },
    },
  ],
  memberOf: {
    '@type': 'Organization',
    name: 'DevOpsDays Campinas',
    description:
      'Conference organizer — speaker sourcing, program curation, 10+ talks across DevOps, cloud, and platform engineering',
  },
  seeks: {
    '@type': 'JobPosting',
    title: 'Senior, Staff, or Principal Engineer — Applied AI Systems & Full-Stack',
    employmentType: 'FULL_TIME',
    jobLocationType: 'TELECOMMUTE',
    description:
      'Targeting Applied AI engineering roles (Senior, Staff, or Principal IC) at AI-forward product companies. Currently based in Brazil (UTC-3), working remotely for an EU-regulated company. Open to fully remote worldwide or relocation with visa sponsorship. 8+ years across regulated industries. WES-verified credentials, English C1.',
  },
} as const;
```

- [ ] **Step 2: Update `app/layout.tsx` — replace inline `personJsonLd` with import**

Find the existing `const personJsonLd = JSON.stringify({...})` block (lines ~86–106) and replace:

```ts
import { personSchema } from '@/content/seo';

// remove the old personJsonLd const block entirely, replace with:
const personJsonLd = JSON.stringify(personSchema);
```

The `<script type="application/ld+json">{personJsonLd}</script>` line in JSX stays unchanged.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add content/seo.ts app/layout.tsx
git commit -m "feat(seo): add person schema to content/seo.ts, import in layout"
```

---

## Task 2: `content/perf-receipts.ts` — heroStats export

**Files:**
- Modify: `content/perf-receipts.ts` (add `heroStats`)
- Note: `StatSchema` already exists in `content/schemas.ts` — reuse it.

- [ ] **Step 1: Add `heroStats` export to `content/perf-receipts.ts`**

At the top of the file, extend the existing schemas import to include `StatSchema` (`z` is already imported):

```ts
// existing line — add StatSchema:
import { type PerfReceipt, PerfReceiptSchema, StatSchema } from './schemas';

// add type alias after imports:
type Stat = z.infer<typeof StatSchema>;
```

Then add after the existing `perfReceipts` export:

```ts
export const heroStats: Stat[] = z.array(StatSchema).parse([
  { value: '€1B+ ARR', label: 'cashier platform' },
  { value: '8M+ MAU', label: 'e-commerce' },
  { value: '-97.5% latency', label: 'API performance' },
  { value: '12-agent AI', label: 'platform' },
]);
```

- [ ] **Step 2: Verify content validates**

```bash
pnpm validate-content
```

Expected: exits 0, no schema violations.

- [ ] **Step 3: Commit**

```bash
git add content/perf-receipts.ts
git commit -m "feat(seo): add heroStats export to perf-receipts"
```

---

## Task 3: `HeroStats` component (TDD)

**Files:**
- Create: `__tests__/HeroStats.test.ts`
- Create: `components/HeroStats.tsx`

- [ ] **Step 1: Write failing test — `__tests__/HeroStats.test.ts`**

```ts
// __tests__/HeroStats.test.ts
// Structural test: HeroStats RSC renders 4 stat items from heroStats content export.
// Uses renderToStaticMarkup + DOMParser — same pattern as roletyper-a11y.test.ts.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroStats } from '@/components/HeroStats';
import { heroStats } from '@/content/perf-receipts';

function getDOM() {
  const html = renderToStaticMarkup(createElement(HeroStats));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroStats entry', () => {
    const items = getDOM().querySelectorAll('.hero-stats__item');
    expect(items).toHaveLength(heroStats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('.hero-stats__value');
    expect(values).toHaveLength(heroStats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('.hero-stats__label');
    expect(labels).toHaveLength(heroStats.length);
  });

  it('first stat value matches heroStats[0].value', () => {
    const first = getDOM().querySelector('.hero-stats__value');
    expect(first?.textContent).toBe(heroStats[0]?.value);
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('.hero-stats');
    expect(container?.getAttribute('aria-label')).toBe('Impact at scale');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
pnpm test --run __tests__/HeroStats.test.ts
```

Expected: FAIL — `Cannot find module '@/components/HeroStats'`

- [ ] **Step 3: Create `components/HeroStats.tsx`**

```tsx
// components/HeroStats.tsx — RSC, no 'use client'. Zero JS shipped.
import { heroStats } from '@/content/perf-receipts';

export function HeroStats() {
  return (
    <div className="hero-stats" aria-label="Impact at scale">
      {heroStats.map((stat) => (
        <div key={stat.label} className="hero-stats__item">
          <span className="hero-stats__value">{stat.value}</span>
          <span className="hero-stats__label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test --run __tests__/HeroStats.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add __tests__/HeroStats.test.ts components/HeroStats.tsx
git commit -m "feat(seo): HeroStats RSC + tests — 4-stat above-fold grid"
```

---

## Task 4: CSS + Hero.tsx integration

**Files:**
- Modify: `app/css/_layout.css` (add `.hero-stats` styles after `.hero__ctas`)
- Modify: `components/sections/Hero.tsx` (render `<HeroStats />`, update tagline)

- [ ] **Step 1: Add `.hero-stats` styles to `app/css/_layout.css`**

Find the `.hero__ctas` block (around line 541) and add after `.hero__cta--secondary:hover` rule:

```css
  /* ── Hero stat bar — 4-stat above-fold impact grid ── */
  .hero-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid var(--signal-dim);
    margin-top: 12px;
  }

  .hero-stats__item {
    display: flex;
    flex-direction: column;
    padding: 7px 10px;
    border-right: 1px solid var(--signal-dim);
  }

  .hero-stats__item:last-child {
    border-right: none;
  }

  .hero-stats__value {
    color: var(--signal);
    font-size: var(--fs-sm);
    font-weight: 700;
    letter-spacing: 0.04em;
    font-family: var(--font-mono-stack);
    line-height: 1.3;
  }

  .hero-stats__label {
    color: var(--fg);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    opacity: 0.65;
    font-family: var(--font-mono-stack);
    line-height: 1.3;
  }
```

Add mobile override inside the existing `@media (max-width: 768px)` block in `app/css/_responsive.css` (line ~152, where `.hero--mobile` rules live):

```css
  .hero-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .hero-stats__item:nth-child(2) {
    border-right: none;
  }

  .hero-stats__item:nth-child(1),
  .hero-stats__item:nth-child(2) {
    border-bottom: 1px solid var(--signal-dim);
  }
```

- [ ] **Step 2: Update `components/sections/Hero.tsx`**

Two changes:

**a) Update tagline text in both desktop and mobile variants** — find and replace both occurrences of:

```tsx
Senior Full-Stack Engineer, Frontend · 8+ yrs in building systems to support business
            operations · fintech (PCI-DSS), healthcare, global e-commerce
```

Replace with:

```tsx
Staff Full-Stack Engineer · Applied AI · 8+ yrs building regulated, high-scale systems
            across iGaming (PCI-DSS), healthcare, and e-commerce
```

**b) Import and render `<HeroStats />`** — add import at top:

```tsx
import { HeroStats } from '../HeroStats';
```

In the desktop `hero__bio` aside, add `<HeroStats />` after the `hero__status` block and before `hero__ctas`:

```tsx
<aside className="hero__bio">
  <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
  <p className="hero__tagline">
    Staff Full-Stack Engineer · Applied AI · 8+ yrs building regulated, high-scale systems
    across iGaming (PCI-DSS), healthcare, and e-commerce
  </p>
  <p className="hero__meta">
    <span>LOC: <b>Brazil</b></span>
    <span>NOW: <b>Betsson</b></span>
    <span>EN/PT/FR</span>
  </p>
  <p className="hero__status">
    <span className="hero__status-dot" aria-hidden="true" />
    OPEN_TO_RELOCATION · WORLDWIDE
  </p>
  <HeroStats />
  <div className="hero__ctas">
    {/* ... existing CTAs unchanged ... */}
  </div>
</aside>
```

In the mobile section, add `<HeroStats />` after `hero__status` and before `hero__ctas` the same way.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run
```

Expected: all pass including HeroStats tests.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/css/_layout.css components/sections/Hero.tsx
git commit -m "feat(seo): hero stat bar + tagline update — Staff Full-Stack · Applied AI"
```

---

## Task 5: `app/layout.tsx` — metadata update

**Files:**
- Modify: `app/layout.tsx` (title, description, keywords, OG, Twitter)

- [ ] **Step 1: Update the `metadata` export**

Replace the existing `metadata` object fields (keep all other fields like `icons`, `robots`, `alternates` unchanged):

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://erikunha.dev'),
  title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
  description:
    'Full-Stack Engineer, 8+ yrs. LLM, RAG, multi-agent in production. €1B+ ARR, 8M+ MAU. Targeting Staff/Principal at AI-forward companies. Brazil, remote.',
  keywords: [
    'Staff Engineer',
    'Principal Engineer',
    'Full-Stack Engineer',
    'Applied AI',
    'LLM Engineering',
    'RAG',
    'Multi-Agent Systems',
    'Angular',
    'React',
    'Next.js',
    'Node.js',
    'TypeScript',
    'PCI-DSS',
    'Healthcare',
    'E-commerce',
    'iGaming',
  ],
  authors: [{ name: 'Erik Henrique Alves Cunha', url: 'https://erikunha.dev' }],
  creator: 'Erik Henrique Alves Cunha',
  // ... icons, openGraph, twitter, robots, alternates below
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://erikunha.dev',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · 8+ yrs · LLM · RAG · Angular · React · Next.js · Node.js',
    siteName: 'erikunha.dev',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Erik Cunha Portfolio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · Angular · React · Next.js · Node.js · TypeScript',
    images: ['/og-image.png'],
  },
  // icons, robots, alternates — unchanged
};
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck && pnpm check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(seo): update metadata title, description, keywords, OG, Twitter"
```

---

## Task 6: `app/opengraph-image.tsx` — identity update

**Files:**
- Modify: `app/opengraph-image.tsx`

- [ ] **Step 1: Update `alt` export and subtitle string**

```ts
// Change:
export const alt = 'Erik Cunha — Senior Full-Stack Engineer, Frontend';
// To:
export const alt = 'Erik Cunha — Staff Full-Stack Engineer · Applied AI';
```

```tsx
// Change the subtitle div (color: '#c8facc'):
Senior Full-Stack Engineer, Frontend
// To:
Staff Full-Stack Engineer · Applied AI
```

- [ ] **Step 2: Verify**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/opengraph-image.tsx
git commit -m "feat(seo): update OG image title — Staff Full-Stack Engineer · Applied AI"
```

---

## Task 7: Sitemap + robots.txt + llms.txt

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `public/robots.txt`
- Replace: `public/llms.txt`

- [ ] **Step 1: Fix `app/sitemap.ts` — dynamic lastModified**

```ts
// Change the fallback:
lastModified: process.env.CONTENT_UPDATED_AT
  ? new Date(process.env.CONTENT_UPDATED_AT)
  : new Date('2025-05-01'),

// To:
lastModified: process.env.CONTENT_UPDATED_AT
  ? new Date(process.env.CONTENT_UPDATED_AT)
  : new Date(),
```

- [ ] **Step 2: Update `public/robots.txt` — add AI bot allowlist**

Full file content:

```
User-agent: *
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: YouBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: https://erikunha.dev/sitemap.xml
```

- [ ] **Step 3: Replace `public/llms.txt`**

Full file content:

```markdown
# Erik Cunha — Staff Full-Stack Engineer · Applied AI

> Full-Stack Software Engineer with 8+ years shipping production AI systems
> and high-scale frontend architecture. Currently building LLM, RAG, and
> multi-agent features at Betsson Group (PCI-DSS, €1B+ ARR, 40M+ tx/yr,
> EU-regulated). Impact at scale: 8M+ MAU e-commerce (Nike Brazil), 70M+
> banking customers (Itaú Unibanco), enterprise healthcare (Canon Medical).
> Targeting Senior, Staff, or Principal IC roles at AI-forward product
> companies. Based in Brazil (UTC-3), fully remote, open to relocation with
> sponsorship. English C1, WES-verified.

## Availability

- Status: Actively exploring new opportunities
- Location: Campinas, São Paulo, Brazil (UTC-3)
- Remote: Yes — currently working remotely for an EU-regulated company
- Relocation: Open, requires visa sponsorship
- Target role: Senior / Staff / Principal IC — Applied AI & Full-Stack
- Work authorization: Brazilian national. WES-verified academic credentials. English C1.
- Contact: erikhenriquealvescunha@gmail.com | +5519998394086

## AI Engineering

Shipping production LLM, RAG, and multi-agent systems since 2024:

- Streaming LLM endpoint: Vercel AI Gateway + Anthropic Claude Haiku 4.5,
  ephemeral prompt caching, cost tracking, token budget management
- Multi-agent orchestration: 12-agent GitHub Copilot system deployed to
  engineering team at Betsson Group — automating code generation, review,
  debugging, testing, and architectural validation across a €1B+ ARR platform
- Prompt engineering at production scale: structured output, tool use,
  function calling, context window management
- RAG pipeline design, GenAI feature integration, AI evaluation loops
- AI cost optimization: prompt caching strategies, model selection for
  latency/cost trade-offs

Keywords: LLM Engineering · RAG · Generative AI · Multi-Agent Orchestration ·
Anthropic Claude · Function Calling · Context Window Management · Prompt Caching ·
Streaming LLM · AI Evaluation · LLM Cost Optimization

## Impact at Scale

- -97.5% API latency — reporting endpoints from ~40s → <1s (query + indexing)
- -98% CSS bundle reduction (Canon Medical Systems)
- -52% Time to Interactive improvement (Canon Medical Systems)
- -33% JavaScript bundle reduction (Canon Medical Systems)
- -32% page load reduction (Nike Brazil / Centauro)
- +10% conversion rate via 20+ A/B experiments (Nike Brazil)
- -80% platform delivery cost — shared cross-platform codebase (MB Labs)
- €1B+ ARR cashier platform (Betsson Group, 40M+ transactions/yr)
- 8M+ monthly active users (Nike Brazil + Centauro)
- 70M+ customers served (Itaú Unibanco banking platform)
- 12-agent AI system deployed to production engineering team

## Technical Skills

Applied AI: LLM Engineering · RAG · Generative AI · Multi-Agent Orchestration ·
Anthropic Claude · Prompt Engineering · Prompt Caching · Streaming LLM ·
Function Calling · Context Window Management · LLM Cost Optimization · AI Evaluation

Frontend: TypeScript (strict) · React 19 · React Server Components ·
Next.js 16 (App Router) · Angular · RxJS · NgRx · Redux · StencilJS ·
Web Components · Vue.js · Ionic · SSR/SSG · Micro-Frontend Architecture

Backend & APIs: Node.js · Express.js · REST APIs · WebSocket (STOMP/SockJS) ·
Python · Backend for Frontend (BFF)

Architecture: Clean Architecture (DDD 4-layer) · Nx Monorepo ·
Component-Driven Architecture · Reactive Architecture

Cloud & DevOps: AWS (S3 · CloudFront · EC2 · CodePipeline · CodeBuild) ·
Docker · NGINX · GitHub Actions · Jenkins · CI/CD

Data: PostgreSQL · MongoDB · Redis · SQL · SQLite

Testing: Playwright · Vitest · Jest · React Testing Library · MSW · WireMock

Performance & A11y: Core Web Vitals · WCAG 2.1 AA · ARIA · Lighthouse CI

## Professional Experience

| Period | Company | Role | Scale |
|---|---|---|---|
| 03/2025–present | Betsson Group (EU, remote from Brazil) | Senior Frontend SE | €1B+ ARR · 40M+ tx/yr · 15+ regulated markets |
| 04/2023–02/2025 | Canon Medical Systems (remote) | Senior SE Consulting | Enterprise healthcare · multi-site hospital ops |
| 12/2021–04/2023 | Grupo SBF — Nike Brazil / Centauro | React Developer | 8M+ MAU · LATAM's largest sports retailer |
| 01/2021–12/2021 | Encora — VMware Pathfinder | Frontend Engineer | 2.1M+ labs · multi-region |
| 04/2020–01/2021 | Zup Innovation — Itaú Unibanco | Frontend Engineer | 70M+ customers · Latin America's largest bank |
| 11/2019–04/2020 | Venturus — CCR AutoBAn | Frontend Engineer | 320km highway operations · real-time telemetry |
| 02/2019–11/2019 | Venturus — CGO Assessoria | Full Stack Engineer | -97.5% API latency · MEAN stack |
| 09/2018–02/2019 | MB Labs — SM Aprendizagem | Mobile Developer | 5-OS cross-platform · -80% delivery cost |
| 07/2018–09/2018 | MB Labs — Hondana | Full Stack Developer | Enterprise chatbot · Cia Hering · KPMG |
| 10/2017–05/2018 | Monde Sistemas | Frontend Engineer (Vue.js) | 2,200+ travel agencies |

## Industries

- iGaming / Regulated Markets — PCI-DSS, 15+ jurisdictions, €1B+ ARR
- E-commerce — 8M+ MAU, multi-brand, LATAM
- Banking / Fintech — 70M+ customers, digital banking
- Healthcare — enterprise hospital operations, WCAG 2.1 AA
- EdTech — 5-OS offline-first educational platform
- HR-tech / Corporate Training — enterprise chatbot (Cia Hering, KPMG)
- SaaS / CRM — travel agency management, 2,200+ clients
- Infrastructure / Logistics — highway ops dashboards, real-time telemetry

## Education

- Web Development Specialist Co-op Diploma — CICCC, Vancouver, Canada (2023–2024)
- Bachelor's in Information Systems — UNISAL, Campinas, Brazil (2015–2020)
- WES Verified International Academic Qualifications (2022)
- Angular Developer Certification — Alain Chautard, Google Developer Expert (2024)

## Languages

- Portuguese: Native
- English: C1
- French: A2

## Community

- DevOpsDays Campinas 2024 — Organizer
  Speaker sourcing and program curation, 10+ talks across DevOps,
  cloud infrastructure, and platform engineering

## Links

- [Portfolio](https://erikunha.dev): Live site with streaming AI terminal,
  performance receipts, and full project showcase
- [GitHub](https://github.com/erikunha): Open source projects
- [LinkedIn](https://linkedin.com/in/erikunha): Full professional history
- [Hiring profile API](https://erikunha.dev/api/erik.json): Machine-readable
  hiring profile (JSON)
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts public/robots.txt public/llms.txt
git commit -m "feat(seo): dynamic sitemap, AI bot allowlist, llms.txt overhaul"
```

---

## Task 8: Final gates + visual verification

- [ ] **Step 1: Run full CI gate**

```bash
pnpm ci:local
```

Expected: lint + typecheck + content validate + tests all pass.

- [ ] **Step 2: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Playwright MCP — desktop (1280×720)**

Navigate to `http://localhost:3000`. Verify:
- Hero section visible: tagline reads "Staff Full-Stack Engineer · Applied AI"
- Stat bar visible without scrolling: 4 stats rendered (€1B+ ARR, 8M+ MAU, -97.5% latency, 12-agent AI)
- `--signal` green on stat values, subdued labels below
- CTAs still visible

- [ ] **Step 4: Playwright MCP — mobile (375×812)**

Resize to 375×812. Verify:
- Stat bar renders 2×2 grid (not horizontal overflow)
- All 4 stats visible
- Tagline readable

- [ ] **Step 5: Verify JSON-LD in built HTML**

```bash
curl -s http://localhost:3000 | grep -A2 'application/ld+json'
```

Expected: `<script type="application/ld+json">` present with `Staff Full-Stack Engineer · Applied AI` in jobTitle.

- [ ] **Step 6: Open PR**

```bash
git push -u origin HEAD
```

Open PR targeting `main`. Title: `feat(seo): 2026 hiring campaign — JSON-LD, llms.txt, hero stat bar, metadata`
