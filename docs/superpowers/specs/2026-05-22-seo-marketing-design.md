# SEO & Marketing Improvements — 2026 Hiring Campaign

**Date:** 2026-05-22
**Branch target:** `feat/p1-ai-2026` (or new branch from main)
**Reversibility:** Fully reversible. All changes are content/metadata — no behavior, no routing.
**Goal:** Maximize job-search conversion for Staff/Principal IC roles at AI-forward product companies. Optimize across all three layers: search discovery, human conversion (3-second scan), and machine-readable sourcing (AI talent platforms).

---

## Scope

Approach A (entity-first infrastructure) + recruiter stat bar from Approach B. Approach C (content velocity / `/notes` route) is flagged as a follow-on spec.

Five sections, all approved:

1. Identity claim — canonical title propagated everywhere
2. JSON-LD Person schema — new structured data layer
3. `public/llms.txt` — overhaul from 6 lines to 120 lines
4. Hero stat bar — 4-stat above-the-fold conversion element
5. Technical plumbing — sitemap, robots.txt, meta, OG image

---

## Section 1 — Identity Claim

**Canonical title:** `Erik Cunha — Staff Full-Stack Engineer · Applied AI`

Rationale:
- `Staff` targets the destination seniority without overclaiming Principal (harder to cold-claim).
- `Full-Stack` retained — at Staff level it signals architectural ownership across layers, not generalism. Resume evidence backs it (PCI-DSS payment systems, LLM streaming endpoint, Redis rate limiting, RSC architecture).
- `Applied AI` is the 2026 differentiator keyword. Separating it with `·` makes it co-equal, not subordinate.

**Propagation map:**
```
content/man-page.ts          ← canonical seniority source (already targets Staff/Principal)
app/layout.tsx               ← <title> + meta description
app/opengraph-image.tsx      ← visual headline string
components/JsonLd.tsx        ← Person.jobTitle (new component)
public/llms.txt              ← H1 + summary blockquote
/api/erik.json               ← HiringProfile seniority field
```

---

## Section 2 — JSON-LD Person Schema

New RSC component `components/JsonLd.tsx` renders `<script type="application/ld+json">` in `<head>`. Data sourced from new export `content/seo.ts` (content discipline — no copy in JSX).

Imported and rendered in `app/layout.tsx` inside the `<head>` metadata layout.

**Full schema:**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Erik Henrique Alves Cunha",
  "alternateName": "Erik Cunha",
  "jobTitle": "Staff Full-Stack Engineer · Applied AI",
  "url": "https://erikunha.dev",
  "email": "erikhenriquealvescunha@gmail.com",
  "telephone": "+5519998394086",
  "knowsLanguage": [
    { "@type": "Language", "name": "Portuguese", "alternateName": "Native" },
    { "@type": "Language", "name": "English", "alternateName": "C1" },
    { "@type": "Language", "name": "French", "alternateName": "A2" }
  ],
  "nationality": { "@type": "Country", "name": "Brazil" },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Campinas",
    "addressRegion": "São Paulo",
    "addressCountry": "BR"
  },
  "sameAs": [
    "https://linkedin.com/in/erikunha",
    "https://github.com/erikunha"
  ],
  "worksFor": {
    "@type": "Organization",
    "name": "Betsson Group",
    "url": "https://www.betssongroup.com"
  },
  "description": "Full-Stack Engineer with 8+ years specializing in Applied AI systems and high-scale production architecture. Currently shipping LLM, RAG, and multi-agent features at Betsson Group (PCI-DSS, €1B+ ARR, 40M+ transactions/yr). Impact across e-commerce (8M+ MAU), banking (70M+ customers), and healthcare. Track record: -97.5% API latency, -98% CSS bundle, -52% TTI. Staff/Principal-track, targeting AI-forward product companies worldwide.",
  "knowsAbout": [
    "LLM Engineering", "Retrieval-Augmented Generation (RAG)",
    "Generative AI", "Multi-Agent Orchestration",
    "AI Application Architecture", "Anthropic Claude",
    "Prompt Engineering", "Prompt Caching",
    "Streaming LLM Responses", "Function Calling",
    "Context Window Management", "LLM Cost Optimization",
    "AI Evaluation",
    "TypeScript", "TypeScript Strict Mode",
    "React 19", "React Server Components", "Next.js App Router",
    "Angular", "RxJS", "NgRx", "Redux",
    "StencilJS", "Web Components", "Vue.js", "Ionic",
    "SSR/SSG", "Micro-Frontend Architecture",
    "Node.js", "Express.js", "REST API Design",
    "WebSocket", "Python", "Docker",
    "AWS", "Amazon S3", "CloudFront", "AWS CodePipeline",
    "PostgreSQL", "MongoDB", "Redis", "SQL",
    "Rate Limiting Architecture", "Backend for Frontend (BFF)",
    "Clean Architecture", "Domain-Driven Design (DDD)",
    "Nx Monorepo", "Component-Driven Architecture",
    "PCI-DSS Systems", "Financial Technology",
    "Healthcare Technology", "iGaming", "Banking Technology",
    "E-commerce Platforms", "EdTech",
    "Performance Engineering", "Core Web Vitals",
    "Web Accessibility (WCAG 2.1 AA)", "ARIA",
    "CI/CD Pipelines", "GitHub Actions",
    "Test-Driven Development", "Playwright", "Jest",
    "React Testing Library", "MSW",
    "Edge Computing"
  ],
  "hasOccupation": {
    "@type": "Occupation",
    "name": "Full-Stack Software Engineer",
    "occupationLocation": { "@type": "City", "name": "Remote / Worldwide" },
    "skills": "TypeScript, React, Angular, Next.js, Node.js, Python, LLM Engineering, RAG, Multi-Agent Systems, PCI-DSS, AWS, Docker, Performance Engineering",
    "experienceRequirements": "8+ years"
  },
  "alumniOf": [
    {
      "@type": "CollegeOrUniversity",
      "name": "Cornerstone International Community College of Canada (CICCC)",
      "address": { "@type": "PostalAddress", "addressLocality": "Vancouver", "addressCountry": "CA" }
    },
    {
      "@type": "CollegeOrUniversity",
      "name": "Centro Universitário Salesiano de São Paulo (UNISAL)",
      "address": { "@type": "PostalAddress", "addressLocality": "Campinas", "addressCountry": "BR" }
    }
  ],
  "hasCredential": [
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Angular Developer Certification",
      "credentialCategory": "certification",
      "recognizedBy": { "@type": "Organization", "name": "Alain Chautard — Google Developer Expert, Angular" }
    },
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Verified International Academic Qualifications",
      "credentialCategory": "certification",
      "recognizedBy": { "@type": "Organization", "name": "World Education Services (WES)" }
    }
  ],
  "memberOf": {
    "@type": "Organization",
    "name": "DevOpsDays Campinas",
    "description": "Conference organizer — speaker sourcing, program curation, 10+ talks across DevOps, cloud, and platform engineering"
  },
  "seeks": {
    "@type": "JobPosting",
    "title": "Senior, Staff, or Principal Engineer — Applied AI Systems & Full-Stack",
    "employmentType": "FULL_TIME",
    "jobLocationType": "TELECOMMUTE",
    "description": "Targeting Applied AI engineering roles (Senior, Staff, or Principal IC) at AI-forward product companies. Currently based in Brazil (UTC-3), working remotely for an EU-regulated company. Open to fully remote worldwide or relocation with visa sponsorship. 8+ years across regulated industries. WES-verified credentials, English C1."
  }
}
```

**Files to create/modify:**
- `content/seo.ts` — new, exports `personSchema` as typed TS object
- `components/JsonLd.tsx` — new RSC, renders the script tag
- `app/layout.tsx` — imports `<JsonLd />`, adds to `<head>`

---

## Section 3 — llms.txt Overhaul

Replace `public/llms.txt` entirely. Target: 120 lines of structured, scannable machine-readable signal. Format follows the llmstxt.org spec (H1 + blockquote summary + H2 sections + links).

**Full content:**

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

**File to modify:** `public/llms.txt` — full replacement.

---

## Section 4 — Hero Stat Bar

**Placement:** Below the "THE MATRIX HAS YOU." headline, above the fold at 1280×720.

**Content (4 stats):**

| Number | Label |
|---|---|
| €1B+ ARR | cashier platform |
| 8M+ MAU | e-commerce |
| -97.5% API latency | performance |
| 12-agent AI | platform |

**Aesthetic:**
- Numbers: `var(--signal)` (#00FF41), large mono
- Labels: `var(--fg)` (#E6FFE6), small mono, subdued opacity
- 1px `var(--signal)` borders, `border-radius: 0` — fits brutalist grid
- Desktop: 4-column single row. Mobile: 2×2 grid.
- Zero client JS — static RSC

**Content source:** New `heroStats` export added to `content/perf-receipts.ts`.

**Files to create/modify:**
- `content/perf-receipts.ts` — add `heroStats` export
- `components/HeroStats.tsx` — new RSC, renders stat grid
- `app/css/hero.css` — add `.hero-stats` grid styles (or existing hero section CSS file)
- `app/page.tsx` (or hero section component) — render `<HeroStats />` below headline

---

## Section 5 — Technical Plumbing

### 5a. `app/sitemap.ts`

```ts
// Change:
lastModified: new Date('2025-05-01')
// To:
lastModified: new Date()
```

Every Vercel build now emits a fresh `lastModified`, signaling an actively maintained site to crawlers.

### 5b. `public/robots.txt`

Add explicit allow entries for AI sourcing and search bots:

```txt
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

### 5c. `app/layout.tsx` — title + meta description

```ts
title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI'

description: 'Full-Stack Engineer, 8+ yrs. LLM, RAG, multi-agent in production. €1B+ ARR, 8M+ MAU. Targeting Staff/Principal at AI-forward companies. Brazil, remote.'
```

Description is 153 characters — fits Google SERP snippet without truncation (limit ~155). Leads with AI keywords, closes with availability + location.

### 5d. `app/opengraph-image.tsx` — headline string

```ts
// Change:
'Senior Full-Stack Engineer, Frontend'
// To:
'Staff Full-Stack Engineer · Applied AI'
```

---

## Files Summary

| File | Action |
|---|---|
| `content/seo.ts` | Create — exports `personSchema` typed object |
| `content/perf-receipts.ts` | Modify — add `heroStats` export |
| `components/JsonLd.tsx` | Create — RSC, renders JSON-LD script tag |
| `components/HeroStats.tsx` | Create — RSC, renders 4-stat grid |
| `app/layout.tsx` | Modify — import JsonLd, update title + description |
| `app/opengraph-image.tsx` | Modify — update headline string |
| `app/page.tsx` (or hero section) | Modify — render HeroStats below headline |
| `app/css/hero.css` (or equiv.) | Modify — add .hero-stats grid styles |
| `app/sitemap.ts` | Modify — dynamic lastModified |
| `public/llms.txt` | Replace — full overhaul |
| `public/robots.txt` | Modify — add AI bot allowlist + Sitemap directive |

---

## Out of Scope (follow-on spec)

- `/notes` or `/writing` route — content velocity / E-E-A-T play (Approach C)
- LinkedIn profile keyword alignment
- GitHub README update
- Resume PDF keyword optimization

---

## Definition of Done

- [ ] `pnpm typecheck` passes
- [ ] `pnpm check` passes (Biome)
- [ ] `pnpm validate-content` passes (Zod schema validation)
- [ ] `pnpm build` succeeds
- [ ] JSON-LD validates at schema.org validator
- [ ] HeroStats visible above fold at 1280×720 and 375×812 (Playwright MCP check)
- [ ] `llms.txt` accessible at `https://erikunha.dev/llms.txt`
- [ ] `robots.txt` includes Sitemap directive and AI bot allowlist
- [ ] `sitemap.xml` `lastModified` reflects build date
- [ ] OG image updated (verify via og:image meta tag in built HTML)
