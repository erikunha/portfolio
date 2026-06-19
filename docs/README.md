# Engineering Knowledge Base

> Canonical engineering documentation for this repository. Reverse-engineered from the code, not summarized from the existing prose. If a statement here disagrees with the code, the code wins and this doc is a bug.

## What this is

A single-page personal portfolio and **reference web system** for Erik Cunha, built as a deliberate engineering reference system. The product is not just the site you see; the **architecture, enforcement, and documentation are themselves the deliverable**. Every decision is meant to hold up as something another team could adopt verbatim.

- **Stack:** Next.js 16 (App Router, `cacheComponents`/PPR) · React 19 · TypeScript strict · Tailwind v4 (`@theme`) · pnpm · Vercel Edge.
- **Shape:** one page (`/`) composed of ~20 terminal-themed sections, plus a `/design-system/*` MDX docs surface and ~10 `/api/*` handlers (including an AI "ask Erik" endpoint and a read-only MCP server).
- **Aesthetic:** Matrix/brutalist terminal - pure black, lime signal-green, JetBrains Mono, CRT overlays.

## How to use these docs

Read in order for onboarding; jump by topic once productive.

| # | Doc | Covers |
|---|---|---|
| - | [README.md](./README.md) (this file) | Index, executive summary, repo map |
| 01 | [architecture.md](./01-architecture.md) | High-level architecture, repo structure, layers, dependency graph |
| 02 | [domain.md](./02-domain.md) | What the product is, users, the content-as-domain model, entities |
| 03 | [rendering-and-data-flow.md](./03-rendering-and-data-flow.md) | Routing tree, RSC/PPR rendering pipeline, end-to-end data flows + sequence diagrams |
| 04 | [components-and-state.md](./04-components-and-state.md) | Component hierarchy, sections, design system, state ownership |
| 05 | [api-and-integrations.md](./05-api-and-integrations.md) | `defineHandler`, API routes, external integrations, security surface |
| 06 | [ai-development.md](./06-ai-development.md) | How AI participates in development: CLAUDE.md, hooks, skills, rules, MCP, the review/verification/learning system |
| 07 | [workflows.md](./07-workflows.md) | Local dev, build, testing, CI/CD, releases, debugging |
| 08 | [performance-and-accessibility.md](./08-performance-and-accessibility.md) | Perf budgets + techniques, a11y architecture |
| 09 | [hidden-knowledge.md](./09-hidden-knowledge.md) | Tribal knowledge, surprising behaviors, conventions |
| 10 | [findings-and-debt.md](./10-findings-and-debt.md) | Architecture evaluation, technical-debt map |
| 11 | [onboarding.md](./11-onboarding.md) | Onboarding path for new contributors |

### Canonical docs that already exist (not duplicated here)

These live at the repo root and remain authoritative. This knowledge base **routes to them**, it does not copy them:

- **`ARCHITECTURE.md`** - the original system-design deep dive (the "why" narrative, trade-offs, "what I'd revisit").
- **`STANDARDS.md`** - the engineering bar: 12 domain chapters, each naming its enforcement mechanism.
- **`DECISIONS.md`** - the running ADR log (~70 dated decisions with reversibility notes).
- **`CLAUDE.md`** + **`.claude/rules/*.md`** - the AI-agent instruction surface (see doc 06).

## Executive summary

- **Default-RSC, static-first.** `app/page.tsx` composes ~20 server components; almost no JS ships. Interactivity is a small set of explicitly-named **client islands** (`*.client.tsx`). Several sections are dynamically rendered per-request via PPR + `<Suspense>` only because they branch on mobile/desktop server-side.
- **Content is typed data, validated at build.** Every section is driven by a `content/*.ts` module whose Zod schema parses at import time; `pnpm validate-content` fails the build on any violation. Copy never lives in JSX.
- **The API layer is a disciplined BFF.** A `defineHandler` envelope enforces a fixed `rate-limit → parse → validate → handle` order; `/api/ask` is a bespoke streaming handler with a multi-layer security/budget pipeline. State lives in Upstash Redis; everything **fails open** so a Redis outage never 500s a user.
- **State is deliberately minimal.** Exactly one React Context (breakpoint), no global store, no URL state. Motion preference lives in the DOM (`body[data-motion]`), and islands coordinate via window `CustomEvent`s, not shared React state.
- **The development platform is itself engineered.** Mechanical gates (hooks that `exit 2`, a transcript-verified review battery, a findings ledger, a learning loop) enforce the standards. This is documented in doc 06 and is a first-class part of the system.

## Repository map (top level)

```
portfolio/
├── app/                  Next.js App Router: routes, layouts, API handlers, design-system MDX
│   ├── page.tsx          the single-page composition root (RSC)
│   ├── layout.tsx        root layout: fonts, JSON-LD, motion bootstrap, Vercel RUM
│   ├── api/              ~10 route handlers (ask, contact, healthz, psi-refresh, mcp, ...)
│   ├── css/              Tailwind v4 entry + @theme tokens + base/crt/animations/components layers
│   └── design-system/    MDX docs site for the design system
├── components/           sections/ (20 RSC sections) · client/ (islands) · responsive/ (chrome) · AppShell · ErrorBoundary
├── design-system/        8 reusable primitives (Badge, Button, ...) + cx util
├── content/              typed content modules + central Zod schema registry + eval corpus
├── lib/                  BFF/server core: env, defineHandler, rate-limit, ask/*, telemetry, integrations
├── proxy.ts              Next middleware: per-request CSP + Reporting-Endpoints
├── next.config.ts        cacheComponents, typedRoutes, static security headers, MDX pipeline
├── scripts/             ~40 gate/tooling scripts (validate-content, check-*, review-*, ask-eval, ...)
├── tests/               Playwright e2e, a11y (axe), visual regression
├── .claude/             AI-agent platform: hooks, skills, rules, agents, settings
├── .github/workflows/   CI (ci.yml), CodeQL, mutation, smoke, claude (AI reviewer pilot)
└── ARCHITECTURE.md · STANDARDS.md · DECISIONS.md · CLAUDE.md   (canonical root docs)
```

See [01-architecture.md](./01-architecture.md) for the layered view and dependency graph.
