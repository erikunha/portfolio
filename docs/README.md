# Engineering Knowledge Base

> Engineering documentation for the routes, rendering model, integrations and development checks in this repository.

## What this is

A single-page personal portfolio and **reference web system** for Erik Cunha, built as a deliberate engineering reference system. The product is not just the site you see; the **architecture, enforcement, and documentation are themselves the deliverable**. Every decision is meant to hold up as something another team could adopt verbatim.
- **Stack:** Next.js 16 (App Router, `cacheComponents`/PPR) · React 19 · TypeScript strict · Tailwind v4 (`@theme`) · pnpm · Vercel (Fluid Compute).
- **Shape:** a homepage (`/`) composed of 17 terminal-themed sections plus a footer, reading views (`/summary`, `/cv`), localized links (`/links`, `/links/en`), five design-system MDX pages and 11 `/api/*` handlers (including an AI "ask Erik" endpoint and a read-only MCP server).
- **Aesthetic:** Matrix/brutalist terminal - pure black, lime signal-green, JetBrains Mono, CRT overlays.

## How to use these docs

Read in order for onboarding; jump by topic once productive.

| #   | Doc                                                                       | Covers                                                                                                            |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| -   | [README.md](./README.md) (this file)                                      | Index, executive summary, repo map                                                                                |
| 01  | [architecture.md](./01-architecture.md)                                   | High-level architecture, repo structure, layers, dependency graph                                                 |
| 02  | [domain.md](./02-domain.md)                                               | What the product is, users, the content-as-domain model, entities                                                 |
| 03  | [rendering-and-data-flow.md](./03-rendering-and-data-flow.md)             | Routing tree, RSC/PPR rendering pipeline, end-to-end data flows + sequence diagrams                               |
| 04  | [components-and-state.md](./04-components-and-state.md)                   | Component hierarchy, sections, design system, state ownership                                                     |
| 05  | [api-and-integrations.md](./05-api-and-integrations.md)                   | `defineHandler`, API routes, external integrations, security surface                                              |
| 06  | [ai-development.md](./06-ai-development.md)                               | How AI participates in development: CLAUDE.md, hooks, skills, rules, MCP, the review/verification/learning system |
| 07  | [workflows.md](./07-workflows.md)                                         | Local dev, build, testing, CI/CD, releases, debugging                                                             |
| 08  | [performance-and-accessibility.md](./08-performance-and-accessibility.md) | Perf budgets + techniques, a11y architecture                                                                      |
| 09  | [hidden-knowledge.md](./09-hidden-knowledge.md)                           | Tribal knowledge, surprising behaviors, conventions                                                               |
| 10  | [findings-and-debt.md](./10-findings-and-debt.md)                         | Architecture evaluation, technical-debt map                                                                       |
| 11  | [onboarding.md](./11-onboarding.md)                                       | Onboarding path for new contributors                                                                              |

### Canonical docs that already exist (not duplicated here)

These live at the repo root and remain authoritative. This knowledge base **routes to them**, it does not copy them:
- **`ARCHITECTURE.md`** - the system-design deep dive (the "why" narrative, trade-offs, "what I'd revisit").
- **`STANDARDS.md`** - the engineering bar: 12 domain chapters, each naming its enforcement mechanism.
- **`DECISIONS.md`** - the running ADR log (append-only decisions with reversibility notes).
- **`CLAUDE.md`** + **`.claude/rules/*.md`** - the AI-agent instruction surface (see doc 06).

## Executive summary

- **Default-RSC, static-first.** `app/page.tsx` composes 17 section components and a footer. Client boundaries wrap server-rendered children and provide interactive islands. ManPage, Visa and DAW mixer select device variants through PPR and `<Suspense>`; Measured streams ASK and PSI data separately. Client naming accepts `*.client.ts(x)`, `/client/` paths and Next error files.
- **Content is typed data, validated at build.** Typed `content/*.ts` modules supply section data. Zod schemas parse content at import time, and `pnpm validate-content` checks the content set in the local verify chain and CI.
- **The API layer is a disciplined BFF.** A `defineHandler` envelope enforces a fixed `rate-limit → parse → validate → handle` order; `/api/ask` is a bespoke streaming handler with a multi-layer security/budget pipeline. State lives in Upstash Redis. Rate limiting and dedup **fail open** so a Redis outage never 500s a user; the `/api/ask` budget reservation is the exception and **fails closed** with 503.
- **State is deliberately minimal.** Exactly one React Context (breakpoint), no global store, no URL state. Motion preference lives in the DOM (`body[data-motion]`), and islands coordinate via window `CustomEvent`s, not shared React state.
- **The development platform is itself engineered.** Mechanical gates enforce the standards: git hooks at commit and push time, and a CI chain covering lint, types, content schemas, bundle size, performance, accessibility and security. Doc 06 distinguishes configured agent tooling, documented workflow and enforced checks.

## Repository map (top level)

```
portfolio/
├── app/                  Next.js App Router: routes, layouts, API handlers, design-system MDX
│   ├── page.tsx          the single-page composition root (RSC)
│   ├── layout.tsx        root layout: fonts, JSON-LD, motion bootstrap, Vercel RUM
│   ├── api/              11 route handlers (ask, contact, healthz, psi-refresh, mcp, ...)
│   ├── css/              Tailwind v4 entry + @theme tokens + base/crt/animations/components layers
│   └── design-system/    MDX docs site for the design system
├── components/           sections/ (RSC sections and nested content) · client/ (islands) · responsive/ (chrome) · AppShell · ErrorBoundary
├── design-system/        8 reusable primitives (Badge, Button, ...) + cx util
├── content/              typed content modules + central Zod schema registry + eval corpus
├── lib/                  BFF/server core: env, defineHandler, rate-limit, ask/*, telemetry, integrations
├── proxy.ts              Next middleware: per-request CSP + Reporting-Endpoints
├── next.config.ts        cacheComponents, typedRoutes, static security headers, MDX pipeline
├── scripts/             gate/tooling scripts (validate-content, check-*, ask-eval, ...)
├── tests/               Playwright e2e, a11y (axe), visual regression
├── .claude/             AI-agent platform: skills, rules, agents, commands, settings
├── .github/workflows/   CI (ci.yml), CodeQL, mutation, smoke, claude (AI reviewer pilot)
└── ARCHITECTURE.md · STANDARDS.md · DECISIONS.md · CLAUDE.md   (canonical root docs)
```

See [01-architecture.md](./01-architecture.md) for the layered view and dependency graph.
