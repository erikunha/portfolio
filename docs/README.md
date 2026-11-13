# Engineering Knowledge Base

> Engineering documentation for the routes, rendering model, integrations and development checks in this repository.

## What this is

A single-page personal portfolio and **reference web system** for Erik Cunha, built as a deliberate engineering reference system. The product is not just the site you see; the **architecture, enforcement, and documentation are themselves the deliverable**. Every decision is meant to hold up as something another team could adopt verbatim.
- **Stack:** Next.js 16 (App Router, `cacheComponents`/PPR) · React 19 · TypeScript strict · Tailwind v4 (`@theme`) · pnpm · Vercel (Fluid Compute).
- **Shape:** a homepage (`/`) composed of 9 terminal-themed section components plus a footer, reading views (`/summary`, `/cv`) with pt-BR twins (`/pt`, `/pt/cv`, `/pt/summary`), localized links (`/links`, `/links/en`), 18 design-system MDX pages and 11 `/api/*` handlers (including an AI "ask Erik" endpoint and a read-only MCP server).
- **Languages:** English at the bare address, pt-BR under `/pt` (`/links` is the pt-BR links page, `/links/en` the English one). The address alone picks the language.
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
| 06  | [ai-development.md](./06-ai-development.md)                               | How AI participates in development: AGENTS.md, hooks, skills, rules, MCP, the review/verification/learning system |
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
- **`AGENTS.md`** (imported by `CLAUDE.md`) + **`.claude/rules/*.md`** + **`.agents/skills/`** - the AI-agent instruction surface (see doc 06).
- **`REVIEW.md`** - what a review reports and what it skips. **`CONTRIBUTING.md`** - branch, commit and pull request flow.
- **`docs/handbook/`** - lessons, review and release flow, and the engineering standards narrative (see [handbook/README.md](./handbook/README.md)).

## Executive summary

- **Default-RSC, static-first.** `components/SiteHome.tsx` composes 9 section components and a footer. Client boundaries wrap server-rendered children and provide interactive islands. Only the DAW mixer (inside the guitar module) selects a device variant; the rest of the guitar module, Contact, and the mixer islands use synchronous responsive layouts; Measured streams ASK and PSI data separately. Client naming accepts `*.client.ts(x)`, `/client/` paths and Next error files.
- **Content is typed data, validated at build.** Typed `content/*.ts` modules supply section data. Zod schemas parse content at import time, and `pnpm validate-content` checks the content set in the local verify chain and CI.
- **The API layer is a disciplined BFF.** A `defineHandler` envelope enforces a fixed `rate-limit → parse → validate → handle` order; `/api/ask` is a bespoke streaming handler with a multi-layer security/budget pipeline. State lives in Upstash Redis. Rate limiting and dedup **fail open** so a Redis outage never 500s a user; the `/api/ask` budget reservation is the exception and **fails closed** with 503.
- **State is deliberately minimal.** One React context (section navigation, whose value never changes after the first render), no state-management library, no URL state. Viewport checks use the `useBreakpoint` hook (a `matchMedia` subscription), not a provider. External stores read through `useSyncExternalStore` hold the rest: `navigationStore` (current section, drawer, motion) and `messageStore`, shared by `ContactForm` and `ContactTimezone`. Motion preference lives in the DOM (`body[data-motion]`, persisted under the `erik.motion` localStorage key), and islands coordinate via window `CustomEvent`s, not shared React state.
- **The development platform is itself engineered.** Mechanical gates enforce the standards: git hooks at commit and push time, and a CI chain covering lint, types, content schemas, bundle size, performance, accessibility and security. Doc 06 distinguishes configured agent tooling, documented workflow and enforced checks.

## Repository map (top level)

```
portfolio/
├── app/                  Next.js App Router: routes, layouts, API handlers, design-system MDX
│   ├── (en)/             English routes and their root layout (html lang en-US); page.tsx is the composition root (RSC)
│   │   └── design-system/   18 MDX pages (overview, tokens, components, enforcement, changelog, foundations/*, primitives/*)
│   ├── (pt)/             pt-BR routes and their root layout (html lang pt-BR)
│   ├── _lib/             shared page-metadata builders (canonical, alternates, Open Graph)
│   ├── api/              11 route handlers (ask, contact, healthz, psi-refresh, mcp, ...)
│   └── css/              Tailwind v4 entry + @theme tokens + base/crt/animations/print/forced-colors + components-*.css layers
├── components/           sections/ (RSC sections and nested content) · client/ (islands) · responsive/ (chrome) · links/ (/links page) · reading/ (/cv and /summary) · ErrorPages/ · SiteShell · AppShell · ErrorBoundary · RootShell (fonts, JSON-LD, motion bootstrap, Vercel RUM shared by both root layouts)
├── design-system/        11 reusable primitives (Badge, BrandIcon, Button, CmdLine, Field, ...)
├── content/              typed content modules (English and pt-BR) + central Zod schema registry + eval corpus
├── lib/                  BFF/server core: env, server/ (defineHandler, body limits, cron auth), rate-limit, ask/*, eval/*, links/*, telemetry, integrations
├── proxy.ts              Next middleware: per-request CSP + Reporting-Endpoints
├── next.config.ts        cacheComponents, typedRoutes, static security headers, MDX pipeline
├── scripts/             gate/tooling scripts (validate-content, check-*, ask-eval, agent-eval, ci-predict, ...) and scripts/metrics (weekly delivery metrics)
├── __tests__/           Vitest suites that hold repo-wide invariants (docs counts, content parity, API behavior, meta checks)
├── evals/agents/        cases for the prompt-regression eval of fixed rule texts modelled on AGENTS.md
├── metrics/             rolling bands the weekly delivery-metrics job scores against
├── tests/               Playwright e2e, a11y (axe), visual regression, shared mocks
├── .agents/             canonical project skills (linked into .claude/skills)
├── .claude/             agent configuration: path-scoped rules, the read-only review agent, permissions baseline, skill links
├── .codex/              agent MCP configuration (mirrors .mcp.json)
├── .husky/              pre-commit, commit-msg and pre-push hooks
├── .github/workflows/   ci.yml plus CodeQL, mutation, post-deploy smoke, ask-eval, agent-eval, weekly-metrics, rollback-rehearsal, tool-pins, lockfile-resolution-probe, high-risk-label, claude and claude-review
└── ARCHITECTURE.md · STANDARDS.md · DECISIONS.md · AGENTS.md · REVIEW.md   (canonical root docs)
```

See [01-architecture.md](./01-architecture.md) for the layered view and dependency graph.
